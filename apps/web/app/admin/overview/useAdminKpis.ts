'use client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export interface AdminKpis {
  activeUsers30d: number
  revenueThisMonth: number
  pendingPractitioners: number
  noShowRate: number
}

async function fetchKpis(): Promise<AdminKpis> {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [
    { count: activeUsers },
    { data: revenueData },
    { count: pendingPractitioners },
    { count: noShowCount },
    { count: totalCount },
  ] = await Promise.all([
    supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('updated_at', thirtyDaysAgo),
    supabase
      .from('payments')
      .select('amount')
      .eq('status', 'completed')
      .gte('created_at', monthStart),
    supabase
      .from('practitioners')
      .select('*', { count: 'exact', head: true })
      .eq('verification_status', 'pending'),
    supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'no_show'),
    supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .not('status', 'in', '("pending","cancelled")'),
  ])

  const revenue = (revenueData ?? []).reduce((sum, p) => sum + (p.amount ?? 0), 0)
  const noShowRate = totalCount && totalCount > 0
    ? Math.round(((noShowCount ?? 0) / totalCount) * 100)
    : 0

  return {
    activeUsers30d: activeUsers ?? 0,
    revenueThisMonth: revenue,
    pendingPractitioners: pendingPractitioners ?? 0,
    noShowRate,
  }
}

export function useAdminKpis() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel('admin-kpis-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['admin-kpis'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['admin-kpis'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'practitioners' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['admin-kpis'] })
      })
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [queryClient])

  return useQuery({
    queryKey: ['admin-kpis'],
    queryFn: fetchKpis,
  })
}
