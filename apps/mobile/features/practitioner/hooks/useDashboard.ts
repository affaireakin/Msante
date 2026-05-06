import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'

export interface DashboardData {
  earningsThisMonth: number
  earningsTrend: number
  consultationsTotal: number
  rating: number
  todayAppointments: TodayAppointment[]
  recentActivity: ActivityItem[]
}

export interface TodayAppointment {
  id: string
  patientName: string
  patientInitials: string
  type: string
  scheduledAt: string
  status: string
}

export interface ActivityItem {
  id: string
  title: string
  body: string
  type: string
  createdAt: string
}

export function useDashboard(practitionerId: string, userId: string) {
  return useQuery({
    queryKey: ['practitioner-dashboard', practitionerId],
    queryFn: async (): Promise<DashboardData> => {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString()

      const [
        { data: paymentsThisMonth },
        { data: paymentsLastMonth },
        { count: consultationsTotal },
        { data: practitioner },
        { data: todayAppts },
        { data: notifications },
      ] = await Promise.all([
        supabase
          .from('payments')
          .select('amount')
          .eq('practitioner_id', practitionerId)
          .eq('status', 'completed')
          .gte('created_at', startOfMonth),
        supabase
          .from('payments')
          .select('amount')
          .eq('practitioner_id', practitionerId)
          .eq('status', 'completed')
          .gte('created_at', startOfLastMonth)
          .lte('created_at', endOfLastMonth),
        supabase
          .from('appointments')
          .select('*', { count: 'exact', head: true })
          .eq('practitioner_id', practitionerId)
          .eq('status', 'completed'),
        supabase
          .from('practitioners')
          .select('rating')
          .eq('id', practitionerId)
          .single(),
        supabase
          .from('appointments')
          .select('id, scheduled_at, status, notes, type, users!appointments_patient_id_fkey(full_name)')
          .eq('practitioner_id', practitionerId)
          .gte('scheduled_at', todayStart)
          .lte('scheduled_at', todayEnd)
          .in('status', ['confirmed', 'pending'])
          .order('scheduled_at', { ascending: true })
          .limit(5),
        supabase
          .from('notifications')
          .select('id, title, body, type, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(5),
      ])

      const earningsThisMonth = (paymentsThisMonth ?? []).reduce((s, p) => s + (p.amount ?? 0), 0)
      const earningsLastMonth = (paymentsLastMonth ?? []).reduce((s, p) => s + (p.amount ?? 0), 0)
      const earningsTrend =
        earningsLastMonth > 0
          ? Math.round(((earningsThisMonth - earningsLastMonth) / earningsLastMonth) * 100)
          : 0

      const todayAppointments: TodayAppointment[] = (todayAppts ?? []).map((a) => {
        const patient = a.users as unknown as { full_name: string } | null
        const name = patient?.full_name ?? 'Patient'
        const initials = name
          .split(' ')
          .map((n: string) => n[0])
          .join('')
          .slice(0, 2)
          .toUpperCase()
        return {
          id: a.id,
          patientName: name,
          patientInitials: initials,
          type: a.type === 'video' ? 'Video Call' : a.type === 'audio' ? 'Audio Call' : 'Chat',
          scheduledAt: a.scheduled_at,
          status: a.status,
        }
      })

      const recentActivity: ActivityItem[] = (notifications ?? []).map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        type: n.type,
        createdAt: n.created_at,
      }))

      return {
        earningsThisMonth,
        earningsTrend,
        consultationsTotal: consultationsTotal ?? 0,
        rating: (practitioner?.rating as number) ?? 0,
        todayAppointments,
        recentActivity,
      }
    },
    staleTime: 30_000,
    enabled: !!practitionerId,
  })
}
