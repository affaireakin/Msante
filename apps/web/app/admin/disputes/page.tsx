'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span className="material-symbols-outlined" style={{ fontSize: '20px', ...style }}>{name}</span>
}

type StatusFilter = 'all' | 'open' | 'under_review' | 'resolved'

interface Dispute {
  id: string
  case_number: string
  created_at: string
  updated_at: string
  status: string
  priority: string
  reason: string
  description: string | null
  resolution_notes: string | null
  patient_id: string
  practitioner_id: string
  payment_id: string | null
  patient: { full_name: string; account_status: string } | null
  practitioner: { full_name: string } | null
  payment: { amount: number; currency: string; provider: string } | null
}

interface DisputeEvent {
  id: string
  type: string
  actor_role: string
  content: string
  created_at: string
  metadata: Record<string, unknown>
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string; icon: string }> = {
  open:         { bg: '#ffdad6', text: '#ba1a1a', label: 'Ouvert',     icon: 'error' },
  under_review: { bg: '#fff8e1', text: '#705d00', label: 'En examen',  icon: 'hourglass_top' },
  resolved:     { bg: '#e8f5e9', text: '#1d7a3a', label: 'Résolu',     icon: 'check_circle' },
  closed:       { bg: '#e5eeff', text: '#006685', label: 'Fermé',      icon: 'lock' },
}

const EVENT_ICON: Record<string, string> = {
  created:        'flag',
  status_changed: 'swap_horiz',
  comment:        'chat_bubble',
  action_taken:   'gavel',
  evidence_added: 'attach_file',
}

function useDisputes(status: StatusFilter) {
  return useQuery({
    queryKey: ['admin-disputes', status],
    queryFn: async () => {
      let q = supabase
        .from('disputes')
        .select(`
          id, case_number, created_at, updated_at, status, priority,
          reason, description, resolution_notes, patient_id, practitioner_id, payment_id,
          patient:patient_id(full_name, account_status),
          practitioner:practitioner_id(full_name),
          payment:payment_id(amount, currency, provider)
        `)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100)

      if (status !== 'all') q = q.eq('status', status)

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as unknown as Dispute[]
    },
  })
}

function useDisputeEvents(disputeId: string | null) {
  return useQuery({
    queryKey: ['dispute-events', disputeId],
    enabled: !!disputeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dispute_events')
        .select('id, type, actor_role, content, created_at, metadata')
        .eq('dispute_id', disputeId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as DisputeEvent[]
    },
  })
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return 'À l\'instant'
  if (h < 24) return `il y a ${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `il y a ${d}j`
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export default function DisputesPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selected, setSelected] = useState<Dispute | null>(null)
  const [comment, setComment] = useState('')
  const { data = [], isLoading } = useDisputes(statusFilter)
  const { data: events = [] } = useDisputeEvents(selected?.id ?? null)
  const queryClient = useQueryClient()

  const activeCount   = data.filter(d => d.status === 'open').length
  const urgentCount   = data.filter(d => d.priority === 'urgent').length
  const reviewCount   = data.filter(d => d.status === 'under_review').length
  const resolvedCount = data.filter(d => d.status === 'resolved').length

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-disputes'] })
    queryClient.invalidateQueries({ queryKey: ['dispute-events', selected?.id] })
  }

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const { error } = await supabase.from('disputes').update({
        status,
        ...(notes ? { resolution_notes: notes } : {}),
      }).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      invalidate()
      if (selected) setSelected({ ...selected, status: vars.status })
    },
  })

  const suspendAccount = useMutation({
    mutationFn: async (patientId: string) => {
      const { error } = await supabase.from('users')
        .update({ account_status: 'suspended' })
        .eq('id', patientId)
      if (error) throw error
      // Log event
      if (selected) {
        await supabase.from('dispute_events').insert({
          dispute_id: selected.id,
          type: 'action_taken',
          actor_role: 'admin',
          content: 'Compte patient suspendu',
        })
      }
    },
    onSuccess: invalidate,
  })

  const issueWarning = useMutation({
    mutationFn: async (disputeId: string) => {
      const { error } = await supabase.from('dispute_events').insert({
        dispute_id: disputeId,
        type: 'action_taken',
        actor_role: 'admin',
        content: 'Avertissement formel émis',
        metadata: { action: 'warning' },
      })
      if (error) throw error
      await supabase.from('disputes').update({ status: 'under_review' }).eq('id', disputeId)
    },
    onSuccess: invalidate,
  })

  const addComment = useMutation({
    mutationFn: async ({ disputeId, text }: { disputeId: string; text: string }) => {
      const { error } = await supabase.from('dispute_events').insert({
        dispute_id: disputeId,
        type: 'comment',
        actor_role: 'admin',
        content: text,
      })
      if (error) throw error
    },
    onSuccess: () => {
      setComment('')
      invalidate()
    },
  })

  const FILTERS: { key: StatusFilter; label: string }[] = [
    { key: 'all',          label: 'Tous' },
    { key: 'open',         label: 'Ouverts' },
    { key: 'under_review', label: 'En examen' },
    { key: 'resolved',     label: 'Résolus' },
  ]

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#0b1c30]">Centre de litiges</h1>
        <p className="text-sm text-[#6f787e] mt-1">Gestion des contestations, suspensions et remboursements</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Litiges actifs',  value: activeCount,   icon: 'error',         color: '#ba1a1a', bg: '#ffdad6' },
          { label: 'Urgents',         value: urgentCount,   icon: 'priority_high',  color: '#705d00', bg: '#fff8e1' },
          { label: 'En examen',       value: reviewCount,   icon: 'hourglass_top',  color: '#006685', bg: '#e5eeff' },
          { label: 'Résolus',         value: resolvedCount, icon: 'check_circle',   color: '#1d7a3a', bg: '#e8f5e9' },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-2xl p-4 flex items-center gap-3"
            style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: kpi.bg }}>
              <Icon name={kpi.icon} style={{ color: kpi.color, fontSize: '20px' }} />
            </div>
            <div>
              <p className="text-xl font-black" style={{ color: kpi.color }}>{kpi.value}</p>
              <p className="text-xs text-[#6f787e] font-medium">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Urgent queue */}
      {data.filter(d => d.priority === 'urgent' && d.status === 'open').length > 0 && (
        <div className="rounded-2xl p-4" style={{ backgroundColor: '#fff8e1', border: '1px solid #e4c546' }}>
          <div className="flex items-center gap-2 mb-3">
            <Icon name="priority_high" style={{ color: '#705d00', fontSize: '18px' }} />
            <span className="text-sm font-bold text-[#705d00]">
              Queue urgente — {data.filter(d => d.priority === 'urgent' && d.status === 'open').length} litige(s) en attente depuis +48h
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.filter(d => d.priority === 'urgent' && d.status === 'open').map(d => (
              <button key={d.id}
                onClick={() => setSelected(d)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-[#ba1a1a] hover:bg-red-50 transition-colors"
                style={{ backgroundColor: '#ffdad6', border: '1px solid rgba(186,26,26,0.20)' }}>
                {d.case_number} · {d.patient?.full_name ?? '—'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setStatusFilter(f.key)}
            className="px-4 py-2 rounded-full text-xs font-bold transition-all"
            style={{
              backgroundColor: statusFilter === f.key ? '#006685' : 'rgba(255,255,255,0.70)',
              color: statusFilter === f.key ? '#fff' : '#6f787e',
              border: statusFilter === f.key ? 'none' : '1px solid rgba(190,200,206,0.50)',
            }}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Table */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="space-y-2">
              {[1,2,3,4,5].map(i => <div key={i} className="h-16 rounded-xl bg-white/40 animate-pulse" />)}
            </div>
          ) : data.length === 0 ? (
            <div className="rounded-2xl p-16 text-center"
              style={{ backgroundColor: 'rgba(255,255,255,0.60)', border: '1px solid rgba(255,255,255,0.80)' }}>
              <Icon name="gavel" style={{ fontSize: '48px', color: '#bec8ce' }} />
              <p className="font-semibold text-[#0b1c30] mt-3">Aucun litige</p>
              <p className="text-sm text-[#6f787e] mt-1">Les litiges apparaîtront ici lorsqu'ils seront créés.</p>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden overflow-x-auto"
              style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Dossier', 'Patient', 'Praticien', 'Montant', 'Motif', 'Statut', 'Priorité', 'Date'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-bold text-[#6f787e] uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map(d => {
                    const cfg = STATUS_CONFIG[d.status] ?? STATUS_CONFIG.open
                    const isSelected = selected?.id === d.id
                    return (
                      <tr key={d.id}
                        onClick={() => setSelected(isSelected ? null : d)}
                        className="border-b border-slate-50 cursor-pointer transition-colors"
                        style={{ backgroundColor: isSelected ? 'rgba(0,102,133,0.04)' : undefined }}>
                        <td className="px-4 py-3">
                          <span className="text-xs font-mono font-bold text-[#006685]">{d.case_number}</span>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-[#0b1c30] whitespace-nowrap">
                          {d.patient?.full_name ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-[#6f787e] whitespace-nowrap">
                          {d.practitioner?.full_name ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-[#0b1c30] whitespace-nowrap">
                          {d.payment ? `${d.payment.amount.toLocaleString('fr-FR')} ${d.payment.currency}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-[#6f787e] max-w-[160px] truncate">{d.reason}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
                            style={{ backgroundColor: cfg.bg, color: cfg.text }}>
                            <Icon name={cfg.icon} style={{ fontSize: '12px', color: cfg.text }} />
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {d.priority === 'urgent' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: '#ffdad6', color: '#ba1a1a' }}>
                              <Icon name="priority_high" style={{ fontSize: '10px', color: '#ba1a1a' }} />
                              Urgent
                            </span>
                          ) : (
                            <span className="text-xs text-[#bec8ce]">Normal</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-[#6f787e] whitespace-nowrap">
                          {relativeTime(d.created_at)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="px-4 py-3 border-t border-slate-100 text-xs text-[#6f787e]">
                {data.length} litige(s) affiché(s)
              </div>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-full lg:w-80 flex-shrink-0">
            <div className="rounded-2xl sticky top-4 overflow-hidden"
              style={{ backgroundColor: 'rgba(255,255,255,0.80)', border: '1px solid rgba(255,255,255,0.80)' }}>

              {/* Panel header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div>
                  <p className="text-xs font-bold text-[#006685] font-mono">{selected.case_number}</p>
                  <h3 className="font-bold text-[#0b1c30] text-sm mt-0.5">{selected.reason}</h3>
                </div>
                <button onClick={() => setSelected(null)} className="text-[#6f787e] hover:text-[#0b1c30] transition-colors">
                  <Icon name="close" style={{ fontSize: '18px' }} />
                </button>
              </div>

              <div className="p-5 space-y-5 max-h-[calc(100vh-280px)] overflow-y-auto">
                {/* Info */}
                <div className="space-y-2.5">
                  {[
                    { label: 'Patient', value: selected.patient?.full_name ?? '—' },
                    { label: 'Praticien', value: selected.practitioner?.full_name ?? '—' },
                    { label: 'Montant', value: selected.payment ? `${selected.payment.amount.toLocaleString('fr-FR')} ${selected.payment.currency}` : '—' },
                    { label: 'Provider', value: selected.payment?.provider?.toUpperCase() ?? '—' },
                    { label: 'Statut compte', value: selected.patient?.account_status ?? 'active' },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between items-center">
                      <p className="text-xs text-[#6f787e] font-medium">{row.label}</p>
                      <p className="text-xs font-bold text-[#0b1c30] text-right max-w-[140px] truncate">{row.value}</p>
                    </div>
                  ))}
                </div>

                {selected.description && (
                  <div className="rounded-xl p-3" style={{ backgroundColor: '#f8f9ff' }}>
                    <p className="text-xs text-[#6f787e] font-bold mb-1 uppercase tracking-wide">Description</p>
                    <p className="text-xs text-[#0b1c30] leading-relaxed">{selected.description}</p>
                  </div>
                )}

                {/* Timeline */}
                <div>
                  <p className="text-xs font-bold text-[#6f787e] uppercase tracking-wide mb-3">Historique</p>
                  {events.length === 0 ? (
                    <p className="text-xs text-[#bec8ce] text-center py-3">Aucun événement</p>
                  ) : (
                    <div className="relative">
                      <div className="absolute left-3.5 top-0 bottom-0 w-px bg-slate-100" />
                      <div className="space-y-3">
                        {events.map((ev, i) => (
                          <div key={ev.id} className="flex gap-3 relative">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 z-10"
                              style={{ backgroundColor: ev.type === 'action_taken' ? '#ffdad6' : '#e5eeff' }}>
                              <Icon name={EVENT_ICON[ev.type] ?? 'info'} style={{
                                fontSize: '13px',
                                color: ev.type === 'action_taken' ? '#ba1a1a' : '#006685',
                              }} />
                            </div>
                            <div className="flex-1 min-w-0 pt-0.5">
                              <p className="text-xs text-[#0b1c30] leading-snug">{ev.content}</p>
                              <p className="text-[10px] text-[#6f787e] mt-0.5">{relativeTime(ev.created_at)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Add comment */}
                {selected.status !== 'resolved' && selected.status !== 'closed' && (
                  <div>
                    <textarea
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                      placeholder="Ajouter une note admin…"
                      rows={2}
                      className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 resize-none outline-none focus:border-[#006685] text-[#0b1c30] placeholder-[#bec8ce]"
                      style={{ backgroundColor: '#f8f9ff' }}
                    />
                    <button
                      disabled={!comment.trim() || addComment.isPending}
                      onClick={() => addComment.mutate({ disputeId: selected.id, text: comment.trim() })}
                      className="mt-1.5 w-full py-2 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-40"
                      style={{ backgroundColor: '#006685' }}>
                      Enregistrer la note
                    </button>
                  </div>
                )}

                {/* Resolution notes */}
                {selected.resolution_notes && (
                  <div className="rounded-xl p-3" style={{ backgroundColor: '#e8f5e9', border: '1px solid rgba(29,122,58,0.15)' }}>
                    <p className="text-xs font-bold text-[#1d7a3a] mb-1">Note de résolution</p>
                    <p className="text-xs text-[#0b1c30]">{selected.resolution_notes}</p>
                  </div>
                )}

                {/* Actions */}
                {selected.status !== 'resolved' && selected.status !== 'closed' && (
                  <div className="space-y-2 pt-1">
                    <button
                      onClick={() => updateStatus.mutate({ id: selected.id, status: 'under_review' })}
                      disabled={selected.status === 'under_review' || updateStatus.isPending}
                      className="w-full py-2.5 rounded-xl text-xs font-bold border transition-colors disabled:opacity-40"
                      style={{ borderColor: '#bec8ce', color: '#3f484d' }}>
                      <span className="flex items-center justify-center gap-1.5">
                        <Icon name="hourglass_top" style={{ fontSize: '14px' }} />
                        Mettre en examen
                      </span>
                    </button>

                    <button
                      onClick={() => issueWarning.mutate(selected.id)}
                      disabled={issueWarning.isPending}
                      className="w-full py-2.5 rounded-xl text-xs font-bold transition-colors"
                      style={{ backgroundColor: '#fff8e1', color: '#705d00', border: '1px solid rgba(112,93,0,0.20)' }}>
                      <span className="flex items-center justify-center gap-1.5">
                        <Icon name="warning" style={{ fontSize: '14px', color: '#705d00' }} />
                        Émettre un avertissement
                      </span>
                    </button>

                    <button
                      onClick={() => suspendAccount.mutate(selected.patient_id)}
                      disabled={selected.patient?.account_status === 'suspended' || suspendAccount.isPending}
                      className="w-full py-2.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-40"
                      style={{ backgroundColor: '#ffdad6', color: '#ba1a1a', border: '1px solid rgba(186,26,26,0.20)' }}>
                      <span className="flex items-center justify-center gap-1.5">
                        <Icon name="block" style={{ fontSize: '14px', color: '#ba1a1a' }} />
                        {selected.patient?.account_status === 'suspended' ? 'Compte déjà suspendu' : 'Suspendre le compte'}
                      </span>
                    </button>

                    <button
                      onClick={() => updateStatus.mutate({ id: selected.id, status: 'resolved', notes: 'Résolu par admin.' })}
                      disabled={updateStatus.isPending}
                      className="w-full py-2.5 rounded-xl text-xs font-bold text-white transition-all hover:shadow-md"
                      style={{ backgroundColor: '#1d7a3a' }}>
                      <span className="flex items-center justify-center gap-1.5">
                        <Icon name="check_circle" style={{ fontSize: '14px', color: '#fff' }} />
                        Marquer comme résolu
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
