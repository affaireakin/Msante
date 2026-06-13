'use client'
import { useQuery } from '@tanstack/react-query'
import type { ComponentProps } from 'react'
import { supabase } from '@/lib/supabase'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

type TooltipFormatter = NonNullable<ComponentProps<typeof Tooltip>['formatter']>

// ─── Types ────────────────────────────────────────────────────────────────────

interface PaymentRow {
  id: string
  amount: number
  currency: string
  provider: string
  practitioner_id: string
  created_at: string
  practitioner: {
    users: {
      full_name: string
    }
  } | null
}

interface ProviderBreakdown {
  provider: string
  count: number
  total: number
  pct: number
}

interface PractitionerPayout {
  practitioner_id: string
  full_name: string
  initials: string
  gross: number
  payout: number
  provider: string
  status: 'ready' | 'pending'
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHLY_GOAL = 5_000_000

const PROVIDER_LABELS: Record<string, string> = {
  wave: 'Wave',
  orange_money: 'Orange Money',
  card: 'Carte',
  stripe: 'Stripe',
  simulated: 'Simulation',
}

const PROVIDER_COLORS: Record<string, string> = {
  wave: '#006685',
  orange_money: '#e65c00',
  card: '#5c35d4',
  stripe: '#635bff',
  simulated: '#bec8ce',
}

const CARD_STYLE = {
  backgroundColor: 'rgba(255,255,255,0.70)',
  border: '1px solid rgba(255,255,255,0.80)',
  borderRadius: '16px',
  boxShadow: '0 10px 30px -10px rgba(0,102,133,0.05)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatXOF(amount: number): string {
  return new Intl.NumberFormat('fr-SN', { maximumFractionDigits: 0 }).format(amount) + ' XOF'
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')
}

// ─── Data hook ────────────────────────────────────────────────────────────────

function useMonthlyPayments() {
  return useQuery({
    queryKey: ['admin-finance-monthly'],
    queryFn: async () => {
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      const { data, error } = await supabase
        .from('payments')
        .select(
          'id, amount, currency, provider, practitioner_id, created_at, practitioner:practitioner_id(users!user_id(full_name))'
        )
        .eq('status', 'completed')
        .gte('created_at', startOfMonth.toISOString())
        .returns<PaymentRow[]>()

      if (error) throw new Error(error.message)
      return data ?? []
    },
    staleTime: 2 * 60 * 1000,
  })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon,
  sub,
  accent,
}: {
  label: string
  value: string
  icon: string
  sub?: string
  accent?: boolean
}) {
  return (
    <div
      className="p-5 flex flex-col gap-3"
      style={CARD_STYLE}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-[#006685] uppercase tracking-widest">{label}</p>
        <span
          className="w-9 h-9 flex items-center justify-center rounded-xl material-symbols-outlined text-[22px]"
          style={{
            backgroundColor: accent ? '#ffde5c' : '#e5eeff',
            color: accent ? '#705d00' : '#006685',
          }}
        >
          {icon}
        </span>
      </div>
      <p className="text-2xl font-bold text-[#0b1c30] leading-none">{value}</p>
      {sub && <p className="text-xs text-[#6f787e]">{sub}</p>}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FinancePage() {
  const { data: payments = [], isLoading, isError } = useMonthlyPayments()

  // ── KPIs ──
  const grossRevenue = payments.reduce((sum, p) => sum + (p.amount ?? 0), 0)
  const platformShare = grossRevenue * 0.2
  const practitionerShare = grossRevenue * 0.8
  const goalPct = Math.min((grossRevenue / MONTHLY_GOAL) * 100, 100)

  // ── Pie data ──
  const pieData = [
    { name: 'Praticiens (80%)', value: practitionerShare, color: '#006685' },
    { name: 'Plateforme (20%)', value: platformShare, color: '#ffde5c' },
  ]

  // ── Provider breakdown ──
  const providerMap: Record<string, { count: number; total: number }> = {}
  for (const p of payments) {
    const key = p.provider
    if (!providerMap[key]) providerMap[key] = { count: 0, total: 0 }
    providerMap[key].count += 1
    providerMap[key].total += p.amount ?? 0
  }
  const providerBreakdown: ProviderBreakdown[] = Object.entries(providerMap)
    .map(([provider, { count, total }]) => ({
      provider,
      count,
      total,
      pct: grossRevenue > 0 ? (total / grossRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total)

  // ── Auto-payout (top 10 practitioners) ──
  const practitionerMap: Record<
    string,
    { full_name: string; gross: number; provider: string }
  > = {}
  for (const p of payments) {
    const id = p.practitioner_id
    const name = (p.practitioner as { users: { full_name: string } } | null)?.users?.full_name ?? 'Inconnu'
    if (!practitionerMap[id]) {
      practitionerMap[id] = { full_name: name, gross: 0, provider: p.provider }
    }
    practitionerMap[id].gross += p.amount ?? 0
  }

  const topPayouts: PractitionerPayout[] = Object.entries(practitionerMap)
    .map(([id, { full_name, gross, provider }]) => ({
      practitioner_id: id,
      full_name,
      initials: getInitials(full_name),
      gross,
      payout: gross * 0.8,
      provider,
      status: gross > 0 ? ('ready' as const) : ('pending' as const),
    }))
    .sort((a, b) => b.gross - a.gross)
    .slice(0, 10)

  // ─── Skeleton ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6" style={{ fontFamily: 'Manrope' }}>
        <div>
          <div className="h-8 w-48 bg-slate-100 rounded-lg animate-pulse" />
          <div className="h-4 w-72 bg-slate-100 rounded mt-2 animate-pulse" />
        </div>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-white/60 rounded-2xl animate-pulse border border-white/80" />
          ))}
        </div>
        <div className="h-4 bg-slate-100 rounded-full animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 bg-white/60 rounded-2xl animate-pulse border border-white/80" />
          <div className="h-64 bg-white/60 rounded-2xl animate-pulse border border-white/80" />
        </div>
      </div>
    )
  }

  // ─── Error ──────────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', fontFamily: 'Manrope', color: '#ba1a1a' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '40px', color: '#bec8ce' }}>error</span>
        <p style={{ marginTop: '12px', fontWeight: 600, color: '#0b1c30' }}>Erreur de chargement</p>
        <p style={{ fontSize: '13px', color: '#6f787e', marginTop: '4px' }}>
          Impossible de charger les données financières. Actualisez la page.
        </p>
      </div>
    )
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6" style={{ fontFamily: 'Manrope' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1c30]">Live Ledger</h1>
          <p className="text-sm text-[#6f787e] mt-1">Distribution des revenus en temps réel</p>
        </div>
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold"
          style={{ backgroundColor: '#e5eeff', color: '#006685' }}
        >
          <span
            className="material-symbols-outlined text-base"
            style={{ fontSize: '16px' }}
          >
            radio_button_checked
          </span>
          LIVE · {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* ── KPI Row ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Revenus bruts ce mois"
          value={formatXOF(grossRevenue)}
          icon="payments"
          sub="Paiements complétés"
        />
        <KpiCard
          label="Part plateforme (20%)"
          value={formatXOF(platformShare)}
          icon="account_balance"
          sub="Commission M-Santé"
          accent
        />
        <KpiCard
          label="Part praticiens (80%)"
          value={formatXOF(practitionerShare)}
          icon="volunteer_activism"
          sub="À reverser aux praticiens"
        />
        <KpiCard
          label="Objectif mensuel"
          value={formatXOF(MONTHLY_GOAL)}
          icon="trophy"
          sub={`${goalPct.toFixed(1)}% atteint`}
          accent
        />
      </div>

      {/* ── Goal progress bar ──────────────────────────────────────────────── */}
      <div
        className="p-5"
        style={CARD_STYLE}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-[#006685] uppercase tracking-widest">Progression objectif mensuel</p>
          <span className="text-xs font-semibold text-[#705d00]">{goalPct.toFixed(1)}%</span>
        </div>
        <div
          className="w-full"
          style={{ height: '10px', borderRadius: '999px', backgroundColor: '#e5eeff', overflow: 'hidden' }}
        >
          <div
            style={{
              height: '100%',
              width: `${goalPct}%`,
              borderRadius: '999px',
              backgroundColor: '#ffde5c',
              transition: 'width 0.6s ease',
            }}
          />
        </div>
        <p className="text-xs text-[#6f787e] mt-2">
          {formatXOF(grossRevenue)} / {formatXOF(MONTHLY_GOAL)} · {goalPct.toFixed(1)}%
        </p>
      </div>

      {/* ── Charts + Provider table row ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Pie chart */}
        <div className="p-5" style={CARD_STYLE}>
          <p className="text-xs font-bold text-[#006685] uppercase tracking-widest mb-4">
            Distribution des revenus
          </p>
          {grossRevenue > 0 ? (
            <>
              <div style={{ position: 'relative' }}>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={62}
                      outerRadius={88}
                      paddingAngle={3}
                      dataKey="value"
                      labelLine={false}
                    >
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={((value: number | string) => [
                        formatXOF(Number(value)),
                        '',
                      ]) as unknown as TooltipFormatter}
                      contentStyle={{
                        fontFamily: 'Manrope',
                        fontSize: 12,
                        border: '1px solid #bec8ce',
                        borderRadius: 8,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center label — absolutely positioned over the donut hole */}
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                  pointerEvents: 'none',
                }}>
                  <p style={{ fontSize: '11px', color: '#6f787e', fontFamily: 'Manrope' }}>Total</p>
                  <p style={{ fontSize: '15px', fontWeight: 800, color: '#0b1c30', fontFamily: 'Manrope' }}>
                    {formatXOF(grossRevenue)}
                  </p>
                  <p style={{ fontSize: '10px', color: '#6f787e', fontFamily: 'Manrope' }}>XOF</p>
                </div>
              </div>
              {/* Legend */}
              <div className="flex flex-col gap-2 mt-1">
                {pieData.map((entry) => (
                  <div key={entry.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="text-sm text-[#0b1c30] font-medium">{entry.name}</span>
                    </div>
                    <span className="text-sm font-bold text-[#0b1c30]">{formatXOF(entry.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-sm text-[#6f787e]">
              Aucun revenu ce mois
            </div>
          )}
        </div>

        {/* Provider breakdown table */}
        <div className="p-5 overflow-x-auto" style={CARD_STYLE}>
          <p className="text-xs font-bold text-[#006685] uppercase tracking-widest mb-4">
            Répartition par provider
          </p>
          {providerBreakdown.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Provider', 'Transactions', 'Total', '% du CA'].map((h) => (
                    <th
                      key={h}
                      className="text-left pb-3 text-xs font-bold text-[#006685] uppercase tracking-widest"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {providerBreakdown.map((row) => (
                  <tr key={row.provider} className="border-b border-slate-50 hover:bg-white/40 transition-colors">
                    <td className="py-3 pr-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
                          style={{ backgroundColor: PROVIDER_COLORS[row.provider] ?? '#bec8ce' }}
                        />
                        <span className="text-sm font-medium text-[#0b1c30]">
                          {PROVIDER_LABELS[row.provider] ?? row.provider}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 text-sm text-[#6f787e]">{row.count}</td>
                    <td className="py-3 text-sm font-semibold text-[#0b1c30]">{formatXOF(row.total)}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-1.5 rounded-full"
                          style={{
                            width: `${Math.max(row.pct, 4)}%`,
                            maxWidth: '60px',
                            backgroundColor: PROVIDER_COLORS[row.provider] ?? '#bec8ce',
                            opacity: 0.7,
                          }}
                        />
                        <span className="text-xs text-[#6f787e]">{row.pct.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200/60">
                  <td className="pt-3 text-xs font-bold text-[#006685] uppercase tracking-widest" colSpan={2}>Total</td>
                  <td className="pt-3 text-sm font-bold text-[#0b1c30]" colSpan={2}>{formatXOF(grossRevenue)}</td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <div className="flex items-center justify-center h-48 text-sm text-[#6f787e]">
              Aucune transaction ce mois
            </div>
          )}
        </div>
      </div>

      {/* ── Auto-payout simulation ─────────────────────────────────────────── */}
      <div className="p-5" style={CARD_STYLE}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-bold text-[#006685] uppercase tracking-widest">
              Simulation auto-payout
            </p>
            <p className="text-xs text-[#6f787e] mt-0.5">Top 10 praticiens · part 80%</p>
          </div>
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{ backgroundColor: '#fff8e1', color: '#705d00' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>bolt</span>
            Wave / Orange Money
          </div>
        </div>

        {topPayouts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Praticien', 'Revenus bruts', 'Virement (80%)', 'Provider', 'Statut'].map((h) => (
                    <th key={h} className="text-left pb-3 text-xs font-bold text-[#006685] uppercase tracking-widest pr-4">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topPayouts.map((row) => (
                  <tr key={row.practitioner_id} className="border-b border-slate-50/80 hover:bg-white/40 transition-colors">
                    {/* Praticien */}
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                          style={{ backgroundColor: '#006685' }}
                        >
                          {row.initials}
                        </div>
                        <span className="text-sm font-medium text-[#0b1c30]">{row.full_name}</span>
                      </div>
                    </td>
                    {/* Revenus bruts */}
                    <td className="py-3 pr-4 text-sm font-semibold text-[#0b1c30]">
                      {formatXOF(row.gross)}
                    </td>
                    {/* Virement 80% */}
                    <td className="py-3 pr-4">
                      <span className="text-sm font-bold" style={{ color: '#006685' }}>
                        {formatXOF(row.payout)}
                      </span>
                    </td>
                    {/* Provider */}
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="inline-block w-2 h-2 rounded-full"
                          style={{ backgroundColor: PROVIDER_COLORS[row.provider] ?? '#bec8ce' }}
                        />
                        <span className="text-sm text-[#6f787e]">
                          {PROVIDER_LABELS[row.provider] ?? row.provider}
                        </span>
                      </div>
                    </td>
                    {/* Statut */}
                    <td className="py-3">
                      {row.status === 'ready' ? (
                        <span
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold"
                          style={{ backgroundColor: '#d1fae5', color: '#065f46' }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>check_circle</span>
                          Prêt au virement
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold"
                          style={{ backgroundColor: '#fff8e1', color: '#705d00' }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>hourglass_empty</span>
                          En attente
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Summary footer */}
              <tfoot>
                <tr className="border-t border-slate-200/60">
                  <td className="pt-3 text-xs font-bold text-[#006685] uppercase tracking-widest">Total top 10</td>
                  <td className="pt-3 text-sm font-bold text-[#0b1c30]">
                    {formatXOF(topPayouts.reduce((s, r) => s + r.gross, 0))}
                  </td>
                  <td className="pt-3">
                    <span className="text-sm font-bold" style={{ color: '#006685' }}>
                      {formatXOF(topPayouts.reduce((s, r) => s + r.payout, 0))}
                    </span>
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="flex items-center justify-center h-36 text-sm text-[#6f787e]">
            Aucun praticien avec des paiements complétés ce mois
          </div>
        )}
      </div>

    </div>
  )
}
