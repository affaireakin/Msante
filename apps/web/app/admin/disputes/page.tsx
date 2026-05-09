'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span className="material-symbols-outlined" style={style}>{name}</span>
}

type DisputeStatus = 'all' | 'pending' | 'under_review' | 'resolved'

interface Dispute {
  id: string
  created_at: string
  status: string
  reason: string
  patient_name: string
  practitioner_name: string
  amount: number
  currency: string
  payment_id: string | null
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string; icon: string }> = {
  pending:      { bg: '#ffdad6', text: '#ba1a1a', label: 'En attente', icon: 'error' },
  under_review: { bg: '#fff8e1', text: '#705d00', label: 'En cours',   icon: 'hourglass_top' },
  resolved:     { bg: '#e8f5e9', text: '#1d7a3a', label: 'Résolu',     icon: 'check_circle' },
}

function useDisputes(status: DisputeStatus) {
  return useQuery({
    queryKey: ['admin-disputes', status],
    queryFn: async () => {
      // disputes are derived from payments with status = 'failed' or 'refunded'
      // and appointments with status = 'no_show' or 'cancelled'
      // We simulate a disputes view from payments table
      let q = supabase
        .from('payments')
        .select(`
          id, created_at, status, amount, currency, metadata,
          patient:patient_id(full_name),
          practitioner:practitioner_id(users!inner(full_name))
        `)
        .in('status', ['failed', 'refunded'])
        .order('created_at', { ascending: false })
        .limit(50)

      const { data, error } = await q
      if (error) throw error

      return (data ?? []).map((p: any) => ({
        id: p.id,
        created_at: p.created_at,
        status: p.status === 'failed' ? 'pending' : 'resolved',
        reason: p.status === 'failed' ? 'Paiement échoué' : 'Remboursement demandé',
        patient_name: p.patient?.full_name ?? '—',
        practitioner_name: p.practitioner?.users?.full_name ?? '—',
        amount: p.amount,
        currency: p.currency ?? 'XOF',
        payment_id: p.id,
      })) as Dispute[]
    },
  })
}

export default function DisputesPage() {
  const [statusFilter, setStatusFilter] = useState<DisputeStatus>('all')
  const [selected, setSelected] = useState<Dispute | null>(null)
  const { data = [], isLoading } = useDisputes(statusFilter)
  const queryClient = useQueryClient()

  const filtered = statusFilter === 'all' ? data : data.filter(d => d.status === statusFilter)

  const pendingCount = data.filter(d => d.status === 'pending').length
  const resolvedCount = data.filter(d => d.status === 'resolved').length

  const resolveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('payments').update({ status: 'refunded' }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-disputes'] })
      setSelected(null)
    },
  })

  const FILTERS: { key: DisputeStatus; label: string }[] = [
    { key: 'all', label: 'Tous' },
    { key: 'pending', label: 'En attente' },
    { key: 'under_review', label: 'En cours' },
    { key: 'resolved', label: 'Résolus' },
  ]

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#0b1c30]">Centre de litiges</h1>
        <p className="text-sm text-[#6f787e] mt-1">Gestion des paiements contestés et remboursements</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Litiges actifs', value: pendingCount, icon: 'error', color: '#ba1a1a', bg: '#ffdad6' },
          { label: 'En cours d\'examen', value: data.filter(d => d.status === 'under_review').length, icon: 'hourglass_top', color: '#705d00', bg: '#fff8e1' },
          { label: 'Résolus', value: resolvedCount, icon: 'check_circle', color: '#1d7a3a', bg: '#e8f5e9' },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-2xl p-5 flex items-center gap-4" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: kpi.bg }}>
              <Icon name={kpi.icon} style={{ color: kpi.color, fontSize: '22px' }} />
            </div>
            <div>
              <p className="text-2xl font-black" style={{ color: kpi.color }}>{kpi.value}</p>
              <p className="text-xs text-[#6f787e] font-medium">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className="px-4 py-2 rounded-full text-xs font-bold transition-all"
            style={{
              backgroundColor: statusFilter === f.key ? '#006685' : 'rgba(255,255,255,0.70)',
              color: statusFilter === f.key ? '#fff' : '#6f787e',
              border: statusFilter === f.key ? 'none' : '1px solid rgba(190,200,206,0.50)',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex gap-6">
        {/* Table */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="space-y-2">
              {[1,2,3,4].map(i => <div key={i} className="h-16 rounded-xl bg-white/40 animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.60)', border: '1px solid rgba(255,255,255,0.80)' }}>
              <Icon name="gavel" style={{ fontSize: '48px', color: '#bec8ce' }} />
              <p className="font-semibold text-[#0b1c30] mt-3">Aucun litige</p>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Référence', 'Patient', 'Praticien', 'Montant', 'Motif', 'Statut', 'Date', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-bold text-[#6f787e] uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d, i) => {
                    const cfg = STATUS_CONFIG[d.status] ?? STATUS_CONFIG.pending
                    return (
                      <tr key={d.id} className="border-b border-slate-50 hover:bg-sky-50/30 transition-colors cursor-pointer" onClick={() => setSelected(d)}>
                        <td className="px-4 py-3 text-xs font-mono text-[#6f787e]">#{d.id.slice(0, 8)}</td>
                        <td className="px-4 py-3 text-sm font-medium text-[#0b1c30]">{d.patient_name}</td>
                        <td className="px-4 py-3 text-sm text-[#6f787e]">{d.practitioner_name}</td>
                        <td className="px-4 py-3 text-sm font-bold text-[#0b1c30]">
                          {d.amount.toLocaleString('fr-FR')} {d.currency}
                        </td>
                        <td className="px-4 py-3 text-sm text-[#6f787e]">{d.reason}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: cfg.bg, color: cfg.text }}>
                            <Icon name={cfg.icon} style={{ fontSize: '12px' }} />
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#6f787e]">
                          {new Date(d.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                            {d.status !== 'resolved' && (
                              <button
                                onClick={() => resolveMutation.mutate(d.id)}
                                disabled={resolveMutation.isPending}
                                className="px-3 py-1 rounded-lg text-xs font-bold text-white hover:opacity-90 transition-opacity"
                                style={{ backgroundColor: '#1d7a3a', opacity: resolveMutation.isPending ? 0.6 : 1 }}
                              >
                                Résoudre
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-72 flex-shrink-0">
            <div className="rounded-2xl p-6 space-y-5 sticky top-0" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-[#0b1c30]">Détail litige</h3>
                <button onClick={() => setSelected(null)} className="text-[#6f787e] hover:text-[#0b1c30]">
                  <Icon name="close" style={{ fontSize: '20px' }} />
                </button>
              </div>
              {[
                { label: 'Référence', value: `#${selected.id.slice(0, 8)}` },
                { label: 'Patient', value: selected.patient_name },
                { label: 'Praticien', value: selected.practitioner_name },
                { label: 'Montant', value: `${selected.amount.toLocaleString('fr-FR')} ${selected.currency}` },
                { label: 'Motif', value: selected.reason },
                { label: 'Date', value: new Date(selected.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) },
              ].map(row => (
                <div key={row.label}>
                  <p className="text-xs text-[#6f787e] uppercase font-bold tracking-wide mb-0.5">{row.label}</p>
                  <p className="text-sm font-semibold text-[#0b1c30]">{row.value}</p>
                </div>
              ))}
              <div className="pt-2 space-y-2">
                {selected.status !== 'resolved' && (
                  <>
                    <button
                      onClick={() => resolveMutation.mutate(selected.id)}
                      disabled={resolveMutation.isPending}
                      className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:shadow-md"
                      style={{ backgroundColor: '#1d7a3a' }}
                    >
                      Marquer comme résolu
                    </button>
                    <button className="w-full py-2.5 rounded-xl text-sm font-bold border border-[#bec8ce] text-[#6f787e] hover:bg-slate-50 transition-colors">
                      Suspendre le compte
                    </button>
                    <button className="w-full py-2.5 rounded-xl text-sm font-bold text-[#ba1a1a] hover:bg-red-50 transition-colors">
                      Rembourser le patient
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
