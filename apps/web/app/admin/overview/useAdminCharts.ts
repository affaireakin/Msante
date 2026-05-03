'use client'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface RevenueDay { date: string; revenue: number }
export interface UsersDay { date: string; count: number }
export interface AppointmentStatus { status: string; count: number }
export interface PaymentProvider { provider: string; count: number }

export interface AdminChartsData {
  revenue7d: RevenueDay[]
  users7d: UsersDay[]
  appointmentsByStatus: AppointmentStatus[]
  paymentsByProvider: PaymentProvider[]
}

async function fetchChartsData(): Promise<AdminChartsData> {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().split('T')[0]
  })

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  const sevenDaysAgoISO = sevenDaysAgo.toISOString()

  const [
    { data: payments },
    { data: users },
    { data: appointments },
    { data: allPayments },
  ] = await Promise.all([
    supabase
      .from('payments')
      .select('amount, created_at')
      .eq('status', 'completed')
      .gte('created_at', sevenDaysAgoISO),
    supabase
      .from('users')
      .select('created_at')
      .gte('created_at', sevenDaysAgoISO),
    supabase
      .from('appointments')
      .select('status'),
    supabase
      .from('payments')
      .select('provider'),
  ])

  // Revenue by day
  const revenueByDay: Record<string, number> = {}
  days.forEach((d) => { revenueByDay[d] = 0 })
  ;(payments ?? []).forEach((p) => {
    const day = (p.created_at as string).split('T')[0]
    if (day in revenueByDay) revenueByDay[day] += (p.amount as number) ?? 0
  })
  const revenue7d = days.map((date) => ({ date, revenue: Math.round(revenueByDay[date]) }))

  // Users by day
  const usersByDay: Record<string, number> = {}
  days.forEach((d) => { usersByDay[d] = 0 })
  ;(users ?? []).forEach((u) => {
    const day = (u.created_at as string).split('T')[0]
    if (day in usersByDay) usersByDay[day]++
  })
  const users7d = days.map((date) => ({ date, count: usersByDay[date] }))

  // Appointments by status
  const statusMap: Record<string, number> = {}
  ;(appointments ?? []).forEach((a) => {
    statusMap[a.status as string] = (statusMap[a.status as string] ?? 0) + 1
  })
  const appointmentsByStatus = Object.entries(statusMap).map(([status, count]) => ({ status, count }))

  // Payments by provider
  const providerMap: Record<string, number> = {}
  ;(allPayments ?? []).forEach((p) => {
    providerMap[p.provider as string] = (providerMap[p.provider as string] ?? 0) + 1
  })
  const paymentsByProvider = Object.entries(providerMap).map(([provider, count]) => ({ provider, count }))

  return { revenue7d, users7d, appointmentsByStatus, paymentsByProvider }
}

export function useAdminCharts() {
  return useQuery({
    queryKey: ['admin-charts'],
    queryFn: fetchChartsData,
    staleTime: 60_000,
  })
}
