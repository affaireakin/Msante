'use client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export interface AdminUrgentItems {
  pendingPractitioners: number
  pendingOrganizations: number
  pendingCollaborators: number
  openDisputes: number
  urgentDisputes: number
  pendingAppeals: number
  suspendedUsers: number
  recentNoShows: number
  openTickets: number
}

async function fetchUrgentItems(): Promise<AdminUrgentItems> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: pendingPractitioners },
    { count: pendingOrganizations },
    { count: pendingInvitations },
    { count: pendingSecretaries },
    { count: openDisputes },
    { count: urgentDisputes },
    { count: pendingAppeals },
    { count: suspendedUsers },
    { count: recentNoShows },
    { count: openTickets },
  ] = await Promise.all([
    supabase.from('practitioners').select('*', { count: 'exact', head: true }).in('verification_status', ['pending', 'under_review']),
    supabase.from('organizations').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('invitations').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('practitioner_secretaries').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('disputes').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('disputes').select('*', { count: 'exact', head: true }).eq('status', 'open').eq('priority', 'urgent'),
    supabase.from('practitioner_appeals').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('account_status', 'suspended'),
    supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('status', 'no_show').gte('scheduled_at', sevenDaysAgo),
    supabase.from('tickets').select('*', { count: 'exact', head: true }).not('status', 'in', '("valide","deploye")'),
  ])

  return {
    pendingPractitioners: pendingPractitioners ?? 0,
    pendingOrganizations: pendingOrganizations ?? 0,
    pendingCollaborators: (pendingInvitations ?? 0) + (pendingSecretaries ?? 0),
    openDisputes: openDisputes ?? 0,
    urgentDisputes: urgentDisputes ?? 0,
    pendingAppeals: pendingAppeals ?? 0,
    suspendedUsers: suspendedUsers ?? 0,
    recentNoShows: recentNoShows ?? 0,
    openTickets: openTickets ?? 0,
  }
}

export function useAdminUrgentItems() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel('admin-urgent-items-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'practitioners' }, () => void queryClient.invalidateQueries({ queryKey: ['admin-urgent-items'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'organizations' }, () => void queryClient.invalidateQueries({ queryKey: ['admin-urgent-items'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invitations' }, () => void queryClient.invalidateQueries({ queryKey: ['admin-urgent-items'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'practitioner_secretaries' }, () => void queryClient.invalidateQueries({ queryKey: ['admin-urgent-items'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'disputes' }, () => void queryClient.invalidateQueries({ queryKey: ['admin-urgent-items'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'practitioner_appeals' }, () => void queryClient.invalidateQueries({ queryKey: ['admin-urgent-items'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => void queryClient.invalidateQueries({ queryKey: ['admin-urgent-items'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => void queryClient.invalidateQueries({ queryKey: ['admin-urgent-items'] }))
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [queryClient])

  return useQuery({
    queryKey: ['admin-urgent-items'],
    queryFn: fetchUrgentItems,
  })
}
