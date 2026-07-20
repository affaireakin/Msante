'use client'
import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Dispute, DisputeEvent, DisputeStatus } from './types'

const DISPUTE_SELECT = `
  id, case_number, status, priority, reason, description, resolution_notes,
  patient_id, practitioner_id, assigned_to, created_at, updated_at,
  patient:patient_id(full_name, account_status),
  practitioner:practitioner_id(full_name),
  assignee:assigned_to(full_name)
`

export function useDisputesBoard() {
  const qc = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel('admin-incidents-disputes-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'disputes' }, () => void qc.invalidateQueries({ queryKey: ['admin-incidents-disputes'] }))
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [qc])

  const disputes = useQuery<Dispute[]>({
    queryKey: ['admin-incidents-disputes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('disputes').select(DISPUTE_SELECT).order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as Dispute[]
    },
  })

  const updateDisputeStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: DisputeStatus }) => {
      const { error } = await supabase.from('disputes').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-incidents-disputes'] }),
  })

  return { disputes, updateDisputeStatus }
}

export function useDisputeDetail(disputeId: string | null) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!disputeId) return
    const channel = supabase
      .channel(`dispute-detail-${disputeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dispute_events', filter: `dispute_id=eq.${disputeId}` },
        () => void qc.invalidateQueries({ queryKey: ['dispute-events', disputeId] }))
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [disputeId, qc])

  const events = useQuery<DisputeEvent[]>({
    queryKey: ['dispute-events', disputeId],
    enabled: !!disputeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dispute_events')
        .select('id, dispute_id, type, actor_role, content, created_at, metadata')
        .eq('dispute_id', disputeId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as DisputeEvent[]
    },
  })

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['admin-incidents-disputes'] })
    void qc.invalidateQueries({ queryKey: ['dispute-events', disputeId] })
  }

  const updateStatus = useMutation({
    mutationFn: async ({ status, notes }: { status: DisputeStatus; notes?: string }) => {
      const { error } = await supabase.from('disputes').update({
        status, ...(notes ? { resolution_notes: notes } : {}),
      }).eq('id', disputeId!)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const assignTo = useMutation({
    mutationFn: async ({ userId, userName }: { userId: string | null; userName: string | null }) => {
      const { error } = await supabase.from('disputes').update({ assigned_to: userId }).eq('id', disputeId!)
      if (error) throw error
      await supabase.from('dispute_events').insert({
        dispute_id: disputeId!, type: 'action_taken', actor_role: 'admin',
        content: userId ? `Litige assigné à ${userName}` : 'Litige désassigné',
      })
      if (userId) {
        await supabase.from('notifications').insert({
          user_id: userId, type: 'dispute_assigned', title: 'Litige assigné',
          body: 'Un litige vous a été assigné.', channel: 'push', data: { dispute_id: disputeId },
        })
      }
    },
    onSuccess: invalidate,
  })

  const suspendAccount = useMutation({
    mutationFn: async (patientId: string) => {
      const { error } = await supabase.from('users').update({ account_status: 'suspended' }).eq('id', patientId)
      if (error) throw error
      await supabase.from('dispute_events').insert({
        dispute_id: disputeId!, type: 'action_taken', actor_role: 'admin', content: 'Compte patient suspendu',
      })
    },
    onSuccess: invalidate,
  })

  const issueWarning = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('dispute_events').insert({
        dispute_id: disputeId!, type: 'action_taken', actor_role: 'admin',
        content: 'Avertissement formel émis', metadata: { action: 'warning' },
      })
      if (error) throw error
      await supabase.from('disputes').update({ status: 'under_review' }).eq('id', disputeId!)
    },
    onSuccess: invalidate,
  })

  const addComment = useMutation({
    mutationFn: async (text: string) => {
      const { error } = await supabase.from('dispute_events').insert({
        dispute_id: disputeId!, type: 'comment', actor_role: 'admin', content: text,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return { events, updateStatus, suspendAccount, issueWarning, addComment, assignTo }
}
