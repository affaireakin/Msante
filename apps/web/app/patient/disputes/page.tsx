'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

const REASONS = [
  'Annulation non justifiée du praticien',
  'Praticien absent lors de la consultation',
  'Problème de paiement / remboursement',
  'Qualité de soin insuffisante',
  'Comportement inapproprié',
  'Autre',
]

const STATUS_META: Record<string, { label: string; color: string; icon: string }> = {
  open:         { label: 'Ouvert',      color: 'bg-amber-100 text-amber-700',   icon: 'pending' },
  under_review: { label: 'En revue',    color: 'bg-sky-100 text-sky-700',       icon: 'manage_search' },
  resolved:     { label: 'Résolu',      color: 'bg-emerald-100 text-emerald-700', icon: 'check_circle' },
  closed:       { label: 'Clôturé',     color: 'bg-slate-100 text-slate-500',   icon: 'lock' },
}

const PRIORITY_COLOR: Record<string, string> = {
  normal: 'bg-slate-100 text-slate-600',
  urgent: 'bg-red-100 text-red-700',
}

interface Dispute {
  id: string
  case_number: string
  reason: string
  description: string | null
  status: string
  priority: string
  created_at: string
  practitioner: { full_name: string } | null
}

interface DisputeEvent {
  id: string
  type: string
  actor_role: string
  content: string
  created_at: string
}

function timeAgo(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function PatientDisputesPage() {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<Dispute | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [reason, setReason] = useState(REASONS[0])
  const [description, setDescription] = useState('')
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { data: myId } = useQuery<string>({
    queryKey: ['my-id'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      return user!.id
    },
  })

  const { data: disputes = [], isLoading } = useQuery<Dispute[]>({
    queryKey: ['patient-disputes'],
    enabled: !!myId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('disputes')
        .select('id, case_number, reason, description, status, priority, created_at, practitioner:practitioner_id(full_name)')
        .eq('patient_id', myId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as Dispute[]
    },
  })

  const { data: events = [] } = useQuery<DisputeEvent[]>({
    queryKey: ['dispute-events', selected?.id],
    enabled: !!selected,
    queryFn: async () => {
      const { data } = await supabase
        .from('dispute_events')
        .select('id, type, actor_role, content, created_at')
        .eq('dispute_id', selected!.id)
        .order('created_at', { ascending: true })
      return (data ?? []) as DisputeEvent[]
    },
  })

  const openMutation = useMutation({
    mutationFn: async () => {
      if (!myId) return
      const { data: pract } = await supabase
        .from('appointments')
        .select('practitioner_id')
        .eq('patient_id', myId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      const { error } = await supabase.from('disputes').insert({
        patient_id: myId,
        practitioner_id: pract?.practitioner_id ?? myId,
        reason,
        description: description || null,
        case_number: '',
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patient-disputes'] })
      setShowNew(false); setReason(REASONS[0]); setDescription(''); setError(null)
    },
    onError: (e: Error) => setError(e.message),
  })

  const commentMutation = useMutation({
    mutationFn: async () => {
      if (!selected || !comment.trim()) return
      const { error } = await supabase.from('dispute_events').insert({
        dispute_id: selected.id,
        type: 'comment',
        actor_role: 'patient',
        content: comment.trim(),
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dispute-events', selected?.id] })
      setComment('')
    },
  })

  const ACTOR_STYLE: Record<string, string> = {
    patient:      'bg-sky-100 text-sky-700',
    practitioner: 'bg-purple-100 text-purple-700',
    admin:        'bg-amber-100 text-amber-700',
    system:       'bg-slate-100 text-slate-500',
  }
  const ACTOR_LABEL: Record<string, string> = {
    patient: 'Vous', practitioner: 'Praticien', admin: 'Admin', system: 'Système',
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#0b1c30]">Mes litiges</h1>
          <p className="text-sm text-[#6f787e] mt-1">Suivi de vos réclamations et dossiers en cours</p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 bg-[#006685] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-[#006685]/20 transition">
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
          Ouvrir un litige
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Liste */}
        <div className="space-y-3">
          {isLoading ? (
            [1, 2].map(i => <div key={i} className="h-28 rounded-2xl bg-white/40 animate-pulse" />)
          ) : disputes.length === 0 ? (
            <div className="rounded-2xl py-16 text-center space-y-2" style={{ backgroundColor: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.8)' }}>
              <span className="material-symbols-outlined text-4xl text-slate-300">gavel</span>
              <p className="text-sm text-[#6f787e]">Aucun litige ouvert</p>
            </div>
          ) : disputes.map(d => {
            const meta = STATUS_META[d.status] ?? STATUS_META.open
            return (
              <button key={d.id} onClick={() => setSelected(d)}
                className={`w-full text-left rounded-2xl p-4 space-y-3 transition-all border-2 ${selected?.id === d.id ? 'border-[#006685]' : 'border-transparent hover:border-slate-200'}`}
                style={{ backgroundColor: 'rgba(255,255,255,0.6)' }}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-mono text-[#6f787e]">{d.case_number}</p>
                    <p className="text-sm font-semibold text-[#0b1c30] mt-0.5 line-clamp-1">{d.reason}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.color}`}>{meta.label}</span>
                    {d.priority === 'urgent' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Urgent</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-[#6f787e]">{d.practitioner?.full_name ?? '—'}</p>
                  <p className="text-xs text-slate-400">{timeAgo(d.created_at)}</p>
                </div>
              </button>
            )
          })}
        </div>

        {/* Détail */}
        {selected && (
          <div className="rounded-2xl flex flex-col overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.8)' }}>
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-mono text-[#6f787e]">{selected.case_number}</p>
                <p className="text-sm font-bold text-[#0b1c30] mt-0.5">{selected.reason}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-[#6f787e] hover:text-[#0b1c30]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Timeline */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 max-h-64">
              {events.map(ev => (
                <div key={ev.id} className="flex gap-3">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full self-start whitespace-nowrap ${ACTOR_STYLE[ev.actor_role] ?? 'bg-slate-100 text-slate-500'}`}>
                    {ACTOR_LABEL[ev.actor_role] ?? ev.actor_role}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm text-[#0b1c30]">{ev.content}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{timeAgo(ev.created_at)}</p>
                  </div>
                </div>
              ))}
              {events.length === 0 && (
                <p className="text-xs text-[#6f787e] text-center py-4">Aucune activité pour l&apos;instant</p>
              )}
            </div>

            {/* Commentaire */}
            {['open', 'under_review'].includes(selected.status) && (
              <div className="px-4 py-3 border-t border-slate-100 flex gap-2">
                <input value={comment} onChange={e => setComment(e.target.value)}
                  placeholder="Ajouter un commentaire..."
                  className="flex-1 text-sm px-3 py-2 rounded-xl border border-slate-200 bg-white text-[#0b1c30] focus:outline-none focus:border-[#006685]"
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commentMutation.mutate() } }}
                />
                <button onClick={() => commentMutation.mutate()} disabled={!comment.trim() || commentMutation.isPending}
                  className="p-2 rounded-xl bg-[#006685] text-white disabled:opacity-50">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>send</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal nouveau litige */}
      {showNew && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#0b1c30]">Ouvrir un litige</h3>
              <button onClick={() => { setShowNew(false); setError(null) }} className="text-[#6f787e] hover:text-[#0b1c30]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
              Un litige sera examiné par notre équipe sous 48h. Merci de fournir le maximum de détails.
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-[#0b1c30]">Motif</label>
                <select value={reason} onChange={e => setReason(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-[#0b1c30] focus:outline-none focus:border-[#006685]">
                  {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-[#0b1c30]">Description <span className="text-[#6f787e] font-normal">(facultatif)</span></label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4}
                  placeholder="Décrivez la situation en détail..."
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-[#0b1c30] resize-none focus:outline-none focus:border-[#006685]" />
              </div>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => { setShowNew(false); setError(null) }}
                className="flex-1 border border-slate-200 text-[#6f787e] rounded-xl py-2.5 text-sm font-semibold hover:bg-slate-50">
                Annuler
              </button>
              <button onClick={() => openMutation.mutate()} disabled={openMutation.isPending}
                className="flex-1 bg-[#006685] text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50">
                {openMutation.isPending ? 'Envoi...' : 'Soumettre le litige'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
