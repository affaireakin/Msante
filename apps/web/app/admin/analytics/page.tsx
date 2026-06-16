'use client'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span className="material-symbols-outlined" style={style}>{name}</span>
}

// ── Platform KPIs ─────────────────────────────────────────────────────────────

interface PlatformData {
  totalPatients: number
  totalPractitioners: number
  newUsersThisMonth: number
  newUsersGrowth: number
  onboardingRate: number
  noShowRate: number
  pendingPractitioners: number
  totalAppointments: number
}

function usePlatformAnalytics() {
  return useQuery<PlatformData>({
    queryKey: ['admin-platform-analytics'],
    queryFn: async () => {
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString()

      const [
        { count: totalPatients },
        { count: totalPractitioners },
        { count: newUsersThisMonth },
        { count: newUsersLastMonth },
        { count: onboardingCompleted },
        { count: noShowCount },
        { count: totalAppts },
        { count: pendingPractitioners },
      ] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'patient'),
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'practitioner'),
        supabase.from('users').select('id', { count: 'exact', head: true }).gte('created_at', monthStart),
        supabase.from('users').select('id', { count: 'exact', head: true }).gte('created_at', lastMonthStart).lte('created_at', lastMonthEnd),
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('onboarding_completed', true).eq('role', 'patient'),
        supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('status', 'no_show'),
        supabase.from('appointments').select('id', { count: 'exact', head: true }).not('status', 'in', '("pending","cancelled")'),
        supabase.from('practitioners').select('id', { count: 'exact', head: true }).eq('verification_status', 'pending'),
      ])

      const nm = newUsersThisMonth ?? 0
      const nl = newUsersLastMonth ?? 0
      const newUsersGrowth = nl > 0 ? Math.round(((nm - nl) / nl) * 100) : 0
      const tp = totalPatients ?? 0
      const onboardingRate = tp > 0 ? Math.round(((onboardingCompleted ?? 0) / tp) * 100) : 0
      const ta = totalAppts ?? 0
      const noShowRate = ta > 0 ? Math.round(((noShowCount ?? 0) / ta) * 100) : 0

      return {
        totalPatients: tp,
        totalPractitioners: totalPractitioners ?? 0,
        newUsersThisMonth: nm,
        newUsersGrowth,
        onboardingRate,
        noShowRate,
        pendingPractitioners: pendingPractitioners ?? 0,
        totalAppointments: ta,
      }
    },
  })
}

interface FinancialData {
  totalRevenue: number
  thisMonthRevenue: number
  lastMonthRevenue: number
  revenueGrowth: number
  totalPayments: number
  successRate: number
  avgTransaction: number
  byProvider: { name: string; amount: number; count: number; color: string }[]
  recentPayments: { id: string; amount: number; currency: string; status: string; provider: string; created_at: string; patient: string }[]
}

function useAnalytics() {
  return useQuery<FinancialData>({
    queryKey: ['admin-analytics'],
    queryFn: async () => {
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString()

      const [{ data: allPay }, { data: thisPay }, { data: lastPay }, { data: recent }] = await Promise.all([
        supabase.from('payments').select('amount, status, provider').eq('status', 'completed'),
        supabase.from('payments').select('amount').eq('status', 'completed').gte('created_at', monthStart),
        supabase.from('payments').select('amount').eq('status', 'completed').gte('created_at', lastMonthStart).lte('created_at', lastMonthEnd),
        supabase.from('payments')
          .select('id, amount, currency, status, provider, created_at, users!patient_id(full_name)')
          .order('created_at', { ascending: false }).limit(10),
      ])

      const all = allPay ?? []
      const total = all.reduce((s: number, p: any) => s + (p.amount ?? 0), 0)
      const thisMonth = (thisPay ?? []).reduce((s: number, p: any) => s + (p.amount ?? 0), 0)
      const lastMonth = (lastPay ?? []).reduce((s: number, p: any) => s + (p.amount ?? 0), 0)
      const growth = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : 0

      const providerMap: Record<string, { amount: number; count: number }> = {}
      all.forEach((p: any) => {
        if (!providerMap[p.provider]) providerMap[p.provider] = { amount: 0, count: 0 }
        providerMap[p.provider].amount += p.amount ?? 0
        providerMap[p.provider].count += 1
      })

      const providerColors: Record<string, string> = { wave: '#006685', orange_money: '#ff6600', stripe: '#635bff', card: '#1d7a3a' }
      const byProvider = Object.entries(providerMap).map(([name, v]) => ({
        name, amount: v.amount, count: v.count, color: providerColors[name] ?? '#6f787e',
      })).sort((a, b) => b.amount - a.amount)

      return {
        totalRevenue: total,
        thisMonthRevenue: thisMonth,
        lastMonthRevenue: lastMonth,
        revenueGrowth: growth,
        totalPayments: all.length,
        successRate: allPay ? Math.round((allPay.length / Math.max(1, (allPay.length + 1))) * 100) : 0,
        avgTransaction: all.length ? Math.round(total / all.length) : 0,
        byProvider,
        recentPayments: ((recent ?? []) as any[]).map(p => ({
          id: p.id,
          amount: p.amount,
          currency: p.currency ?? 'XOF',
          status: p.status,
          provider: p.provider,
          created_at: p.created_at,
          patient: p.users?.full_name ?? '—',
        })),
      }
    },
  })
}

const STATUS_CFG: Record<string, { bg: string; text: string; label: string }> = {
  completed:  { bg: '#e8f5e9', text: '#1d7a3a', label: 'Succès' },
  pending:    { bg: '#fff8e1', text: '#705d00', label: 'En attente' },
  processing: { bg: '#e5eeff', text: '#006685', label: 'En cours' },
  failed:     { bg: '#ffdad6', text: '#ba1a1a', label: 'Échoué' },
  refunded:   { bg: '#e0e3e5', text: '#5c5f61', label: 'Remboursé' },
}

const PROVIDER_LABELS: Record<string, string> = {
  wave: 'Wave', orange_money: 'Orange Money', stripe: 'Stripe', card: 'Carte'
}

export default function AnalyticsPage() {
  const { data, isLoading } = useAnalytics()
  const { data: platform, isLoading: platformLoading } = usePlatformAnalytics()

  if (isLoading || platformLoading) return (
    <div className="space-y-4">
      {[1,2,3,4].map(i => <div key={i} className="h-32 rounded-2xl bg-white/40 animate-pulse" />)}
    </div>
  )

  const d = data!
  const p = platform!
  const maxRevenue = Math.max(...d.byProvider.map(p => p.amount), 1)

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-[#0b1c30]">Analytiques plateforme</h1>
        <p className="text-sm text-[#6f787e] mt-1">KPIs utilisateurs, revenus et performance opérationnelle</p>
      </div>

      {/* Platform KPIs */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Icon name="monitor_heart" style={{ fontSize: '18px', color: '#006685' }} />
          <h2 className="text-base font-bold text-[#0b1c30]">Santé plateforme</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: 'Patients inscrits',
              value: p.totalPatients.toLocaleString('fr-FR'),
              sub: `${p.totalPractitioners} praticiens`,
              icon: 'group',
              color: '#006685',
              bg: '#e5eeff',
            },
            {
              label: 'Nouveaux ce mois',
              value: p.newUsersThisMonth.toLocaleString('fr-FR'),
              sub: `${p.newUsersGrowth >= 0 ? '+' : ''}${p.newUsersGrowth}% vs mois dernier`,
              icon: p.newUsersGrowth >= 0 ? 'trending_up' : 'trending_down',
              color: p.newUsersGrowth >= 0 ? '#1d7a3a' : '#ba1a1a',
              bg: p.newUsersGrowth >= 0 ? '#e8f5e9' : '#ffdad6',
            },
            {
              label: 'Taux d\'onboarding',
              value: `${p.onboardingRate}%`,
              sub: `${p.totalPatients - Math.round(p.totalPatients * p.onboardingRate / 100)} patients incomplets`,
              icon: 'checklist',
              color: p.onboardingRate >= 70 ? '#1d7a3a' : '#705d00',
              bg: p.onboardingRate >= 70 ? '#e8f5e9' : '#fff8e1',
            },
            {
              label: 'Taux de no-show',
              value: `${p.noShowRate}%`,
              sub: `sur ${p.totalAppointments.toLocaleString('fr-FR')} RDV`,
              icon: 'event_busy',
              color: p.noShowRate > 10 ? '#ba1a1a' : '#1d7a3a',
              bg: p.noShowRate > 10 ? '#ffdad6' : '#e8f5e9',
            },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-2xl p-5" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: kpi.bg }}>
                  <Icon name={kpi.icon} style={{ color: kpi.color, fontSize: '20px' }} />
                </div>
              </div>
              <p className="text-2xl font-black" style={{ color: kpi.color }}>{kpi.value}</p>
              <p className="text-xs font-semibold text-[#0b1c30] mt-0.5">{kpi.label}</p>
              <p className="text-xs text-[#6f787e] mt-0.5">{kpi.sub}</p>
            </div>
          ))}
        </div>

        {/* Pending practitioners alert */}
        {p.pendingPractitioners > 0 && (
          <div className="mt-4 flex items-center gap-3 px-5 py-3.5 rounded-2xl" style={{ backgroundColor: '#fff8e1', border: '1px solid #e4c546' }}>
            <Icon name="pending_actions" style={{ color: '#705d00', fontSize: '20px' }} />
            <div className="flex-1">
              <p className="text-sm font-bold text-[#705d00]">
                {p.pendingPractitioners} praticien{p.pendingPractitioners > 1 ? 's' : ''} en attente de validation
              </p>
              <p className="text-xs text-[#705d00] opacity-75">À traiter depuis le panneau de gestion des praticiens</p>
            </div>
            <a href="/admin/practitioners?status=pending" className="text-xs font-bold text-[#705d00] hover:underline">
              Voir →
            </a>
          </div>
        )}
      </div>

      {/* Financial KPIs */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Icon name="payments" style={{ fontSize: '18px', color: '#006685' }} />
          <h2 className="text-base font-bold text-[#0b1c30]">Performance financière</h2>
        </div>
        {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Revenus totaux', value: `${d.totalRevenue.toLocaleString('fr-FR')} XOF`, icon: 'payments', color: '#006685', bg: '#e5eeff' },
          {
            label: 'Ce mois',
            value: `${d.thisMonthRevenue.toLocaleString('fr-FR')} XOF`,
            icon: d.revenueGrowth >= 0 ? 'trending_up' : 'trending_down',
            color: d.revenueGrowth >= 0 ? '#1d7a3a' : '#ba1a1a',
            bg: d.revenueGrowth >= 0 ? '#e8f5e9' : '#ffdad6',
            badge: `${d.revenueGrowth >= 0 ? '+' : ''}${d.revenueGrowth}%`,
          },
          { label: 'Transactions', value: d.totalPayments.toLocaleString('fr-FR'), icon: 'receipt_long', color: '#705d00', bg: '#fff8e1' },
          { label: 'Transaction moy.', value: `${d.avgTransaction.toLocaleString('fr-FR')} XOF`, icon: 'equalizer', color: '#5c5f61', bg: '#e0e3e5' },
        ].map((kpi: any) => (
          <div key={kpi.label} className="rounded-2xl p-5" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: kpi.bg }}>
                <Icon name={kpi.icon} style={{ color: kpi.color, fontSize: '20px' }} />
              </div>
              {kpi.badge && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: kpi.bg, color: kpi.color }}>
                  {kpi.badge}
                </span>
              )}
            </div>
            <p className="text-xl font-black" style={{ color: kpi.color }}>{kpi.value}</p>
            <p className="text-xs text-[#6f787e] font-medium mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by provider */}
        <div className="rounded-2xl p-6" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
          <h3 className="font-bold text-[#0b1c30] mb-6">Revenus par provider</h3>
          {d.byProvider.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-[#6f787e] text-sm">Aucune donnée disponible</div>
          ) : (
            <div className="space-y-4">
              {d.byProvider.map(p => (
                <div key={p.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="text-sm font-semibold text-[#0b1c30]">{PROVIDER_LABELS[p.name] ?? p.name}</span>
                      <span className="text-xs text-[#6f787e]">{p.count} transactions</span>
                    </div>
                    <span className="text-sm font-black" style={{ color: p.color }}>{p.amount.toLocaleString('fr-FR')} XOF</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#e5eeff] overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${(p.amount / maxRevenue) * 100}%`, backgroundColor: p.color }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Distribution donut */}
        <div className="rounded-2xl p-6" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
          <h3 className="font-bold text-[#0b1c30] mb-6">Répartition revenus</h3>
          <div className="flex items-center gap-8">
            <div className="relative w-32 h-32 flex-shrink-0">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                {d.byProvider.length === 0 ? (
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5eeff" strokeWidth="3" />
                ) : (() => {
                  let offset = 0
                  return d.byProvider.map(p => {
                    const pct = (p.amount / Math.max(1, d.totalRevenue)) * 100
                    const dash = `${pct} ${100 - pct}`
                    const segment = (
                      <circle
                        key={p.name}
                        cx="18" cy="18" r="15.9"
                        fill="none"
                        stroke={p.color}
                        strokeWidth="3"
                        strokeDasharray={dash}
                        strokeDashoffset={-offset}
                      />
                    )
                    offset += pct
                    return segment
                  })
                })()}
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-sm font-black text-[#006685]">{d.totalPayments}</p>
                  <p className="text-xs text-[#6f787e]">tx</p>
                </div>
              </div>
            </div>
            <div className="flex-1 space-y-3">
              {d.byProvider.map(p => (
                <div key={p.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: p.color }} />
                    <span className="text-sm text-[#0b1c30]">{PROVIDER_LABELS[p.name] ?? p.name}</span>
                  </div>
                  <span className="text-sm font-bold text-[#0b1c30]">
                    {d.totalRevenue > 0 ? Math.round((p.amount / d.totalRevenue) * 100) : 0}%
                  </span>
                </div>
              ))}
              {d.byProvider.length === 0 && (
                <p className="text-sm text-[#6f787e]">Aucune transaction complétée</p>
              )}
            </div>
          </div>
        </div>
      </div>

      </div>{/* /Financial KPIs section */}

      {/* Recent transactions */}
      <div>
        <h3 className="font-bold text-[#0b1c30] mb-4">Transactions récentes</h3>
        <div className="rounded-2xl overflow-hidden overflow-x-auto" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="border-b border-slate-100">
                {['Référence', 'Patient', 'Provider', 'Montant', 'Statut', 'Date'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-bold text-[#6f787e] uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.recentPayments.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-[#6f787e]">Aucune transaction</td></tr>
              ) : d.recentPayments.map(p => {
                const cfg = STATUS_CFG[p.status] ?? STATUS_CFG.pending
                return (
                  <tr key={p.id} className="border-b border-slate-50 hover:bg-sky-50/30 transition-colors">
                    <td className="px-4 py-3 text-xs font-mono text-[#6f787e]">#{p.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-[#0b1c30]">{p.patient}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#e5eeff] text-[#006685]">
                        {PROVIDER_LABELS[p.provider] ?? p.provider}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-[#0b1c30]">{p.amount.toLocaleString('fr-FR')} {p.currency}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: cfg.bg, color: cfg.text }}>{cfg.label}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#6f787e]">
                      {new Date(p.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
