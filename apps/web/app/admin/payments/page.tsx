'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { ComponentProps } from 'react'
import { supabase } from '@/lib/supabase'
import Papa from 'papaparse'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { BarShapeProps } from 'recharts/types/cartesian/Bar'

type TooltipFormatter = NonNullable<ComponentProps<typeof Tooltip>['formatter']>
type TooltipLabelFormatter = NonNullable<ComponentProps<typeof Tooltip>['labelFormatter']>

type PaymentStatus = 'all' | 'pending' | 'processing' | 'completed' | 'failed' | 'refunded'
type Provider = 'all' | 'wave' | 'orange_money' | 'stripe' | 'card' | 'simulated'

interface PaymentRow {
  id: string
  amount: number
  currency: string
  provider: string
  status: string
  created_at: string
  patient: { full_name: string } | null
  practitioner_user: { full_name: string } | null
}

interface ProviderStat {
  provider: string
  total: number
}

const PAGE_SIZE = 10

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  processing: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
  refunded: 'bg-gray-100 text-gray-600',
}

const PROVIDER_BAR_COLORS: Record<string, string> = {
  wave: '#006685',
  orange_money: '#e65c00',
  card: '#5c35d4',
  stripe: '#635bff',
  simulated: '#bec8ce',
}

const PROVIDERS: { key: Provider; label: string }[] = [
  { key: 'all', label: 'Tous providers' },
  { key: 'wave', label: 'Wave' },
  { key: 'orange_money', label: 'Orange Money' },
  { key: 'stripe', label: 'Stripe' },
  { key: 'card', label: 'Carte (PayDunya)' },
  { key: 'simulated', label: 'Simulé' },
]

const PROVIDER_LABELS: Record<string, string> = {
  wave: 'Wave',
  orange_money: 'Orange Money',
  card: 'Carte (PayDunya)',
  stripe: 'Stripe',
  simulated: 'Simulation',
}

function usePayments(
  status: PaymentStatus,
  provider: Provider,
  page: number,
  dateFrom: string,
  dateTo: string,
) {
  return useQuery({
    queryKey: ['admin-payments', status, provider, page, dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from('payments')
        .select(
          `id, amount, currency, provider, status, created_at,
          patient:users!payments_patient_id_fkey (full_name),
          practitioner_user:practitioners!inner (users!inner (full_name))`,
          { count: 'exact' }
        )
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (status !== 'all') query = query.eq('status', status)
      if (provider !== 'all') query = query.eq('provider', provider)
      if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00`)
      if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59`)

      const { data, count, error } = await query
      if (error) throw error
      return { payments: (data ?? []) as unknown as PaymentRow[], total: count ?? 0 }
    },
    staleTime: 30_000,
  })
}

function useTotals() {
  return useQuery({
    queryKey: ['admin-payment-totals'],
    queryFn: async () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const [{ data: todayData }, { count: pendingCount }, { count: failedCount }] = await Promise.all([
        supabase.from('payments').select('amount').eq('status', 'completed').gte('created_at', today.toISOString()),
        supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
      ])

      return {
        todayRevenue: (todayData ?? []).reduce((s, p) => s + ((p.amount as number) ?? 0), 0),
        pendingCount: pendingCount ?? 0,
        failedCount: failedCount ?? 0,
      }
    },
  })
}

function useProviderStats() {
  return useQuery({
    queryKey: ['admin-payment-stats'],
    queryFn: async () => {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const { data, error } = await supabase
        .from('payments')
        .select('provider, amount')
        .eq('status', 'completed')
        .gte('created_at', thirtyDaysAgo.toISOString())

      if (error) throw error

      const totals: Record<string, number> = {}
      for (const row of data ?? []) {
        const p = row.provider as string
        totals[p] = (totals[p] ?? 0) + ((row.amount as number) ?? 0)
      }

      return Object.entries(totals).map(([provider, total]): ProviderStat => ({ provider, total }))
    },
    staleTime: 60_000,
  })
}

export default function PaymentsPage() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<PaymentStatus>('all')
  const [provider, setProvider] = useState<Provider>('all')
  const [page, setPage] = useState(0)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const { data, isLoading } = usePayments(status, provider, page, dateFrom, dateTo)
  const { data: totals } = useTotals()
  const { data: providerStats } = useProviderStats()
  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE)

  const pageTotal = (data?.payments ?? []).reduce((sum, p) => sum + (p.amount ?? 0), 0)

  const refund = useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase
        .from('payments')
        .update({ status: 'refunded', updated_at: new Date().toISOString() })
        .eq('id', paymentId)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-payments'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-payment-totals'] })
    },
  })

  const handleExportCSV = () => {
    const rows = (data?.payments ?? []).map((p) => ({
      Date: new Date(p.created_at).toLocaleDateString('fr-FR'),
      Patient: p.patient?.full_name ?? '—',
      Praticien: p.practitioner_user?.full_name ?? '—',
      Montant: p.amount,
      Devise: p.currency,
      Provider: PROVIDER_LABELS[p.provider] ?? p.provider,
      Statut: p.status,
      ID: p.id,
    }))
    const csv = Papa.unparse(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `msante-paiements-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const formatXOF = (amount: number) =>
    new Intl.NumberFormat('fr-SN', { maximumFractionDigits: 0 }).format(amount) + ' XOF'

  return (
    <div className="space-y-6" style={{ fontFamily: 'Manrope' }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1c30]">Paiements</h1>
          <p className="text-sm text-[#6f787e] mt-1">Réconciliation et suivi des transactions</p>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#006685] text-white text-sm font-semibold rounded-full hover:bg-[#005070] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Exporter CSV
        </button>
      </div>

      {/* Totaux */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Revenus aujourd'hui", value: formatXOF(totals?.todayRevenue ?? 0), color: 'text-emerald-600' },
          { label: 'En attente', value: `${totals?.pendingCount ?? 0} transactions`, color: 'text-amber-600' },
          { label: 'Échoués', value: `${totals?.failedCount ?? 0} transactions`, color: 'text-red-600' },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="rounded-2xl p-5"
            style={{ backgroundColor: 'rgba(255,255,255,0.60)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.80)' }}
          >
            <p className="text-xs font-bold text-[#006685] uppercase tracking-widest mb-2">{label}</p>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Revenus par provider (bar chart) */}
      <div
        className="rounded-2xl p-5"
        style={{
          backgroundColor: 'rgba(255,255,255,0.70)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.80)',
          borderRadius: '16px',
          boxShadow: '0 10px 30px -10px rgba(0,102,133,0.05)',
        }}
      >
        <p className="text-xs font-bold text-[#006685] uppercase tracking-widest mb-4">
          Revenus par provider (30 derniers jours)
        </p>
        {providerStats && providerStats.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={providerStats} margin={{ top: 4, right: 16, left: 0, bottom: 24 }}>
              <XAxis
                dataKey="provider"
                tick={{ fontSize: 12, fill: '#6f787e', fontFamily: 'Manrope' }}
                tickFormatter={(v: string) => PROVIDER_LABELS[v] ?? v}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11, fill: '#6f787e', fontFamily: 'Manrope' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={((value: number | string) => [
                  formatXOF(Number(value)),
                  'Revenus',
                ]) as unknown as TooltipFormatter}
                labelFormatter={((label: string) =>
                  PROVIDER_LABELS[label] ?? label
                ) as unknown as TooltipLabelFormatter}
                contentStyle={{
                  fontFamily: 'Manrope',
                  fontSize: 13,
                  border: '1px solid #bec8ce',
                  borderRadius: 8,
                  background: '#fff',
                }}
              />
              <Bar
                dataKey="total"
                shape={(props: BarShapeProps) => {
                  const fill =
                    PROVIDER_BAR_COLORS[(props as BarShapeProps & { provider?: string }).provider ?? ''] ?? '#bec8ce'
                  const { x, y, width, height } = props as BarShapeProps & {
                    x: number; y: number; width: number; height: number
                  }
                  if (!width || !height) return <g />
                  const r = 6
                  return (
                    <path
                      d={`M${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} L${x},${y + height} Z`}
                      fill={fill}
                    />
                  )
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[220px] text-sm text-[#6f787e]">
            Aucune donnée pour les 30 derniers jours
          </div>
        )}
        {providerStats && providerStats.length > 0 && (
          <div className="flex flex-wrap gap-4 mt-2">
            {providerStats.map((s) => (
              <div key={s.provider} className="flex items-center gap-1.5">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: PROVIDER_BAR_COLORS[s.provider] ?? '#bec8ce' }}
                />
                <span className="text-xs text-[#6f787e]">{PROVIDER_LABELS[s.provider] ?? s.provider}</span>
                <span className="text-xs font-semibold text-[#0b1c30]">{formatXOF(s.total)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filtres */}
      <div className="flex flex-col gap-3">
        {/* Status + provider filters */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex gap-2">
            {(['all', 'completed', 'pending', 'failed', 'refunded'] as PaymentStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => { setStatus(s); setPage(0) }}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  status === s ? 'bg-[#006685] text-white' : 'bg-white/60 text-[#3f484d] border border-slate-200/50 hover:bg-white'
                }`}
              >
                {s === 'all' ? 'Tous' : s}
              </button>
            ))}
          </div>
          <select
            value={provider}
            onChange={(e) => { setProvider(e.target.value as Provider); setPage(0) }}
            className="px-4 py-2 rounded-full text-sm bg-white/60 border border-slate-200/50 text-[#0b1c30] outline-none focus:border-[#006685]"
          >
            {PROVIDERS.map(({ key, label }) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {/* Date range filter */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-[#6f787e]">Du</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(0) }}
              style={{
                border: '1px solid #bec8ce',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '13px',
                fontFamily: 'Manrope',
                color: '#0b1c30',
                background: 'rgba(255,255,255,0.70)',
                outline: 'none',
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-[#6f787e]">Au</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(0) }}
              style={{
                border: '1px solid #bec8ce',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '13px',
                fontFamily: 'Manrope',
                color: '#0b1c30',
                background: 'rgba(255,255,255,0.70)',
                outline: 'none',
              }}
            />
          </div>
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); setPage(0) }}
              className="px-3 py-1.5 rounded-full text-xs font-semibold border border-slate-200/50 bg-white/60 text-[#6f787e] hover:bg-white transition-colors"
            >
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          backgroundColor: 'rgba(255,255,255,0.70)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.80)',
          borderRadius: '16px',
          boxShadow: '0 10px 30px -10px rgba(0,102,133,0.05)',
        }}
      >
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100/60">
              {['Date', 'Patient', 'Praticien', 'Montant', 'Provider', 'Statut', 'Action'].map((h) => (
                <th key={h} className="text-left px-6 py-4 text-xs font-bold text-[#006685] uppercase tracking-widest">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-50/60">
                  {Array.from({ length: 7 }).map((__, j) => (
                    <td key={j} className="px-6 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : (data?.payments ?? []).map((payment) => (
              <tr key={payment.id} className="border-b border-slate-50/60 hover:bg-white/30 transition-colors">
                <td className="px-6 py-4 text-sm text-[#6f787e]">{new Date(payment.created_at).toLocaleDateString('fr-FR')}</td>
                <td className="px-6 py-4 text-sm font-medium text-[#0b1c30]">{payment.patient?.full_name ?? '—'}</td>
                <td className="px-6 py-4 text-sm text-[#6f787e]">{payment.practitioner_user?.full_name ?? '—'}</td>
                <td className="px-6 py-4 text-sm font-semibold text-[#0b1c30]">{formatXOF(payment.amount)}</td>
                <td className="px-6 py-4 text-sm text-[#6f787e]">{PROVIDER_LABELS[payment.provider] ?? payment.provider}</td>
                <td className="px-6 py-4">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[payment.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {payment.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {payment.status === 'failed' && (
                    <button
                      onClick={() => refund.mutate(payment.id)}
                      disabled={refund.isPending}
                      className="text-xs px-3 py-1.5 bg-amber-100 text-amber-700 rounded-full font-semibold hover:bg-amber-200 transition-colors disabled:opacity-50"
                    >
                      Rembourser
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          {/* Total row footer */}
          {!isLoading && (data?.payments ?? []).length > 0 && (
            <tfoot>
              <tr className="border-t border-slate-200/60 bg-[#f8f9ff]/60">
                <td colSpan={3} className="px-6 py-3 text-xs font-bold text-[#006685] uppercase tracking-widest">
                  Total affiché
                </td>
                <td className="px-6 py-3 text-sm font-bold text-[#0b1c30]">
                  {formatXOF(pageTotal)}
                </td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          )}
        </table>

        {/* Pagination */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100/60">
          <p className="text-sm text-[#6f787e]">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, data?.total ?? 0)} sur {data?.total ?? 0}
          </p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1.5 rounded-lg text-sm border border-slate-200/50 disabled:opacity-40 hover:bg-white transition-colors">←</button>
            <span className="px-3 py-1.5 text-sm text-[#0b1c30]">{page + 1} / {totalPages || 1}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-3 py-1.5 rounded-lg text-sm border border-slate-200/50 disabled:opacity-40 hover:bg-white transition-colors">→</button>
          </div>
        </div>
      </div>
    </div>
  )
}
