'use client'
import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Ticket, TicketType, TicketPriority, TicketComment, TicketAttachment, TicketHistoryEntry } from './types'

const TICKET_SELECT = `
  id, title, description, type, priority, status, assignee_id, due_date, created_by, source, created_at, updated_at,
  assignee:users!tickets_assignee_id_fkey(full_name),
  creator:users!tickets_created_by_fkey(full_name)
`

export function useTickets() {
  const qc = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel('admin-tickets-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => void qc.invalidateQueries({ queryKey: ['admin-tickets'] }))
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [qc])

  const tickets = useQuery<Ticket[]>({
    queryKey: ['admin-tickets'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tickets').select(TICKET_SELECT).order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as Ticket[]
    },
  })

  const adminUsers = useQuery({
    queryKey: ['admin-team-members'],
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('id, full_name').eq('role', 'admin').order('full_name')
      if (error) throw error
      return data ?? []
    },
  })

  const createTicket = useMutation({
    mutationFn: async (input: { title: string; description: string; type: TicketType; priority: TicketPriority; assignee_id: string | null; due_date: string | null }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')
      const { data: ticket, error } = await supabase.from('tickets').insert({ ...input, created_by: user.id }).select('id').single()
      if (error) throw error
      if (input.assignee_id) {
        await supabase.from('notifications').insert({
          user_id: input.assignee_id, type: 'ticket_assigned', title: 'Ticket assigné',
          body: 'Un nouveau ticket vous a été assigné.', channel: 'push', data: { ticket_id: ticket.id },
        })
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-tickets'] }),
  })

  const updateTicket = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<Pick<Ticket, 'status' | 'assignee_id' | 'priority' | 'due_date' | 'title' | 'description'>>) => {
      const { error } = await supabase.from('tickets').update(patch).eq('id', id)
      if (error) throw error
      // Section 17 : notifier le responsable dès qu'un ticket lui est assigné,
      // au lieu de le laisser découvrir la charge de travail en ouvrant la page.
      if ('assignee_id' in patch && patch.assignee_id) {
        await supabase.from('notifications').insert({
          user_id: patch.assignee_id, type: 'ticket_assigned', title: 'Ticket assigné',
          body: 'Un ticket vous a été assigné.', channel: 'push', data: { ticket_id: id },
        })
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-tickets'] }),
  })

  return { tickets, adminUsers, createTicket, updateTicket }
}

export function useTicketDetail(ticketId: string | null) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!ticketId) return
    const channel = supabase
      .channel(`ticket-detail-${ticketId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ticket_comments', filter: `ticket_id=eq.${ticketId}` },
        () => void qc.invalidateQueries({ queryKey: ['ticket-comments', ticketId] }))
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [ticketId, qc])

  const comments = useQuery<TicketComment[]>({
    queryKey: ['ticket-comments', ticketId],
    enabled: !!ticketId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ticket_comments')
        .select('id, ticket_id, author_id, body, created_at, author:users!ticket_comments_author_id_fkey(full_name)')
        .eq('ticket_id', ticketId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as TicketComment[]
    },
  })

  const attachments = useQuery<TicketAttachment[]>({
    queryKey: ['ticket-attachments', ticketId],
    enabled: !!ticketId,
    queryFn: async () => {
      const { data, error } = await supabase.from('ticket_attachments').select('*').eq('ticket_id', ticketId!).order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  const history = useQuery<TicketHistoryEntry[]>({
    queryKey: ['ticket-history', ticketId],
    enabled: !!ticketId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ticket_history')
        .select('id, ticket_id, actor_id, field_changed, old_value, new_value, created_at, actor:users!ticket_history_actor_id_fkey(full_name)')
        .eq('ticket_id', ticketId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as TicketHistoryEntry[]
    },
  })

  const addComment = useMutation({
    mutationFn: async (body: string) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !ticketId) throw new Error('Non connecté')
      const { error } = await supabase.from('ticket_comments').insert({ ticket_id: ticketId, author_id: user.id, body })
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['ticket-comments', ticketId] }),
  })

  const uploadAttachment = useMutation({
    mutationFn: async (file: File) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !ticketId) throw new Error('Non connecté')
      const path = `${ticketId}/${Date.now()}_${file.name}`
      const { error: uploadError } = await supabase.storage.from('ticket-attachments').upload(path, file)
      if (uploadError) throw uploadError
      const { error } = await supabase.from('ticket_attachments').insert({ ticket_id: ticketId, file_url: path, file_name: file.name, uploaded_by: user.id })
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['ticket-attachments', ticketId] }),
  })

  const openAttachment = async (path: string) => {
    const { data } = await supabase.storage.from('ticket-attachments').createSignedUrl(path, 3600)
    if (data) window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  return { comments, attachments, history, addComment, uploadAttachment, openAttachment }
}
