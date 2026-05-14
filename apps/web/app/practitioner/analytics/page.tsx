'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { supabase } from '@/lib/supabase'

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-6 space-y-4"
      style={{
        backgroundColor: 'rgba(255,255,255,0.60)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.80)',
      }}
    >
      <h3 className="text-xs font-bold text-[#006685] uppercase tracking-widest">{title}</h3>
      {children}
    </div>
  )
}

function KpiCard({
  label, value, sub, icon, trend,
}: {
  label: string
  value: string
  sub?: string
  icon: string
  trend?: number
}) {
  return (
    <div
      className="rounded-2xl p-5 flex items-start gap-4"
      style={{
        backgroundColor: 'rgba(255,255,255,0.60)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.80)',
      }}
    >
      <div className="w-10 h-10 rounded-xl bg-[#e5eeff] flex items-center justify-center flex-shrink-0">
        <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#006685' }}>{icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-[#6f787e] font-medium">{label}</p>
        <p className="text-xl font-black text-[#0b1c30] mt-0.5">{value}</p>
        {sub && <p className="text-xs text-[#6f787e] mt-0.5">{sub}</p>}
        {trend !== undefined && (
          <span className={`text-xs font-bold ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {trend >= 0 ? '+' : ''}{trend}% vs mois précédent
          </span>
        )}
      </div>
    </div>
  )
}

interface AnalyticsData {
  thisMonth: number
  lastMonth: number
  growth: number
  avgPerSession: number
  revenueChart: { month: string; revenue: number }[]
  typeChart: { name: string; value: number; color: string }[]
  noShowRate: number
  rebookingRate: number
  top5: { id: string; count: number }[]
  newCount: number
  recurringCount: number
}

function useAnalytics(practId: string | null) {
  return useQuery<AnalyticsData>({
    queryKey: ['practitioner-analytics', practId],
    enabled: !!practId,
    queryFn: async () => {
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString()
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString()

      const [
        { data: allPayments },
        { data: thisMonthPay },
        { data: lastMonthPay },
        { data: allAppts },
        { data: thisMonthAppts },
      ] = await Promise.all([
        supabase
          .from('payments')
          .select('amount, created_at')
          .eq('practitioner_id', practId!)
          .eq('status', 'completed')
          .gte('created_at', sixMonthsAgo),
        supabase
          .from('payments')
          .select('amount')
          .eq('practitioner_id', practId!)
          .eq('status', 'completed')
          .gte('created_at', monthStart),
        supabase
          .from('payments')
          .select('amount')
          .eq('practitioner_id', practId!)
          .eq('status', 'completed')
          .gte('created_at', lastMonthStart)
          .lte('created_at', lastMonthEnd),
        supabase
          .from('appointments')
          .select('patient_id, status, type, scheduled_at')
          .eq('practitioner_id', practId!),
        supabase
          .from('appointments')
          .select('patient_id, status, type')
          .eq('practitioner_id', practId!)
          .gte('scheduled_at', monthStart),
      ])

      // Revenue by month (6 months)
      const monthlyMap: Record<string, number> = {}
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const key = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
        monthlyMap[key] = 0
      }
      for (const p of allPayments ?? []) {
        const d = new Date(p.created_at as string)
        const key = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
        if (key in monthlyMap) monthlyMap[key] += (p.amount as number) ?? 0
      }
      const revenueChart = Object.entries(monthlyMap).map(([month, revenue]) => ({ month, revenue }))

      const thisMonth = (thisMonthPay ?? []).reduce((s, p) => s + ((p.amount as number) ?? 0), 0)
      const lastMonth = (lastMonthPay ?? []).reduce((s, p) => s + ((p.amount as number) ?? 0), 0)
      const growth = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : 0
      const completedThisMonth = (thisMonthAppts ?? []).filter(a => a.status === 'completed').length
      const avgPerSession = completedThisMonth > 0 ? Math.round(thisMonth / completedThisMonth) : 0

      // Session type breakdown
      const typeMap: Record<string, number> = { video: 0, audio: 0, presentiel: 0 }
      for (const a of allAppts ?? []) {
        if (a.status === 'completed') {
          const t = a.type as string
          if (t in typeMap) typeMap[t]++
        }
      }
      const typeChart = [
        { name: 'Vidéo', value: typeMap['video'], color: '#006685' },
        { name: 'Audio', value: typeMap['audio'], color: '#82d8ff' },
        { name: 'Présentiel', value: typeMap['presentiel'], color: '#ffde5c' },
      ].filter(t => t.value > 0)

      // No-show rate
      const relevant = (allAppts ?? []).filter(a =>
        ['confirmed', 'completed', 'no_show'].includes(a.status as string)
      )
      const noShowCount = (allAppts ?? []).filter(a => a.status === 'no_show').length
      const noShowRate = relevant.length > 0 ? Math.round((noShowCount / relevant.length) * 100) : 0

      // Rebooking rate
      const patientCounts: Record<string, number> = {}
      for (const a of allAppts ?? []) {
        patientCounts[a.patient_id as string] = (patientCounts[a.patient_id as string] ?? 0) + 1
      }
      const totalPatients = Object.keys(patientCounts).length
      const rebookedPatients = Object.values(patientCounts).filter(c => c >= 2).length
      const rebookingRate = totalPatients > 0 ? Math.round((rebookedPatients / totalPatients) * 100) : 0

      // Top 5 patients by session count
      const top5 = Object.entries(patientCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, count]) => ({ id, count }))

      // New vs returning this month
      const thisMonthPatientIds = new Set((thisMonthAppts ?? []).map(a => a.patient_id as string))
      const prevPatientIds = new Set(
        (allAppts ?? [])
          .filter(a => new Date(a.scheduled_at as string) < new Date(monthStart))
          .map(a => a.patient_id as string)
      )
      let newCount = 0
      let recurringCount = 0
      thisMonthPatientIds.forEach(pid => {
        if (prevPatientIds.has(pid)) recurringCount++
        else newCount++
      })

      return {
        thisMonth,
        lastMonth,
        growth,
        avgPerSession,
        revenueChart,
        typeChart,
        noShowRate,
        rebookingRate,
        top5,
        newCount,
        recurringCount,
      }
    },
  })
}

export default function PractitionerAnalyticsPage() {
  const [practId, setPractId] = useState<string | null>(null)

  useQuery({
    queryKey: ['my-pract-id-analytics'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const { data } = await supabase
        .from('practitioners')
        .select('id')
        .eq('user_id', user.id)
        .single()
      if (data) setPractId(data.id as string)
      return (data?.id as string) ?? null
    },
  })

  const { data, isLoading } = useAnalytics(practId)

  if (isLoading || !data) {
    return (
      <div className="space-y-6 max-w-5xl">
        <div>
          <h1 className="text-2xl font-black text-[#0b1c30]">Analytics</h1>
        </div>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 rounded-2xl bg-white/40 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-black text-[#0b1c30]">Analytics</h1>
        <p className="text-sm text-[#6f787e] mt-1">Revenus, agenda et patients</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="CA ce mois"
          value={`${data.thisMonth.toLocaleString('fr-FR')} XOF`}
          icon="payments"
          trend={data.growth}
        />
        <KpiCard
          label="Mois précédent"
          value={`${data.lastMonth.toLocaleString('fr-FR')} XOF`}
          icon="history"
        />
        <KpiCard
          label="Moy. par séance"
          value={`${data.avgPerSession.toLocaleString('fr-FR')} XOF`}
          icon="receipt_long"
        />
        <KpiCard
          label="Taux rebooking"
          value={`${data.rebookingRate}%`}
          icon="replay"
          sub="patients ayant reconsulté"
        />
      </div>

      {/* Revenue 6-month chart */}
      <ChartCard title="Revenus sur 6 mois (XOF)">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data.revenueChart} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#006685" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#006685" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6f787e' }} />
            <YAxis
              tick={{ fontSize: 11, fill: '#6f787e' }}
              tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              formatter={(v: number) => [`${v.toLocaleString('fr-FR')} XOF`, 'Revenus']}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#006685"
              strokeWidth={2}
              fill="url(#revGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Session type breakdown */}
        {data.typeChart.length > 0 && (
          <ChartCard title="Répartition par type de séance">
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={140} height={140}>
                <PieChart>
                  <Pie
                    data={data.typeChart}
                    dataKey="value"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                  >
                    {data.typeChart.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {data.typeChart.map((t, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: t.color }}
                    />
                    <span className="text-sm font-medium text-[#0b1c30]">{t.name}</span>
                    <span className="text-sm text-[#6f787e] ml-auto pl-4 font-bold">{t.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </ChartCard>
        )}

        {/* Agenda metrics */}
        <ChartCard title="Métriques agenda">
          <div className="space-y-5">
            {[
              { label: 'Taux de no-show', value: data.noShowRate, color: '#ba1a1a' },
              { label: 'Taux de rebooking', value: data.rebookingRate, color: '#1d7a3a' },
            ].map(m => (
              <div key={m.label} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[#0b1c30]">{m.label}</span>
                  <span className="text-sm font-bold" style={{ color: m.color }}>{m.value}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${m.value}%`, backgroundColor: m.color }}
                  />
                </div>
              </div>
            ))}
            <div className="pt-2 border-t border-slate-100 flex gap-4">
              <div className="flex-1 text-center">
                <p className="text-xl font-black text-[#006685]">{data.newCount}</p>
                <p className="text-xs text-[#6f787e]">nouveaux patients ce mois</p>
              </div>
              <div className="flex-1 text-center">
                <p className="text-xl font-black text-[#705d00]">{data.recurringCount}</p>
                <p className="text-xs text-[#6f787e]">patients récurrents</p>
              </div>
            </div>
          </div>
        </ChartCard>
      </div>

      {/* Top 5 patients */}
      {data.top5.length > 0 && (
        <ChartCard title="Top patients — séances">
          <div className="space-y-3">
            {data.top5.map((p, i) => {
              const maxCount = data.top5[0]?.count ?? 1
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#006685] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#6f787e] truncate">
                      Patient #{p.id.slice(0, 8)}
                    </p>
                    <div className="h-1.5 rounded-full bg-slate-100 mt-1 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#006685]"
                        style={{ width: `${(p.count / maxCount) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-bold text-[#006685] flex-shrink-0">{p.count}</span>
                </div>
              )
            })}
          </div>
        </ChartCard>
      )}
    </div>
  )
}
