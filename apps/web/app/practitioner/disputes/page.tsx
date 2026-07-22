'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

const PRACTITIONER_REASONS = [
  'Absence non justifiée du patient (no-show)',
  'Comportement inapproprié du patient',
  'Non-paiement',
  'Fausses informations fournies',
  'Autre',
]

const STATUS_META: Record<string, { label: string; color: string; icon: string }> = {
  open:         { label: 'Ouvert',    color: 'bg-amber-100 text-amber-700',      icon: 'pending' },
  under_review: { label: 'En revue',  color: 'bg-sky-100 text-sky-700',          icon: 'manage_search' },
  resolved:     { label: 'Résolu',    color: 'bg-emerald-100 text-emerald-700',  icon: 'check_circle' },
  closed:       { label: 'Clôturé',   color: 'bg-slate-100 text-slate-500',      icon: 'lock' },
}

interface Dispute {
  id: string
  case_number: string
  reason: string
  description: string | null
  status: string
  priority: string
  created_at: string
  patient: { full_name: string } | null
}

interface DisputeEvent {
  id: string
  type: string
  actor_role: string
  content: string
  created_at: string
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function PractitionerDisputesPage() {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<Dispute | null>(null)
  const [comment, setComment] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [newPatientId, setNewPatientId] = useState('')
  const [newReason, setNewReason] = useState(PRACTITIONER_REASONS[0])
  const [newDescription, setNewDescription] = useState('')
  const [newError, setNewError] = useState<string | null>(null)

  const { data: myId } = useQuery<string>({
    queryKey: ['my-id'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      return user!.id
    },
  })

  const { data: practId } = useQuery<string | null>({
    queryKey: ['my-pract-id', myId],
    enabled: !!myId,
    queryFn: async () => {
      const { data } = await supabase.from('practitioners').select('id').eq('user_id', myId!).single()
      return data?.id ?? null
    },
  })

  const { data: disputes = [], isLoading } = useQuery<Dispute[]>({
    // QA finding (section 23) : filtrait par practId (practitioners.id) alors
    // que disputes.practitioner_id référence users.id (myId) — la liste des
    // litiges d'un praticien était donc systématiquement vide.
    queryKey: ['practitioner-disputes', myId],
    enabled: !!myId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('disputes')
        .select('id, case_number, reason, description, status, priority, created_at, patient:patient_id(full_name)')
        .eq('practitioner_id', myId!)
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

  const { data: myPatients = [] } = useQuery<{ id: string; full_name: string }[]>({
    queryKey: ['practitioner-dispute-patients', practId],
    enabled: !!practId && showNew,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('patient_id, users!patient_id(id, full_name)')
        .eq('practitioner_id', practId!)
      if (error) throw error
      const map = new Map<string, string>()
      for (const row of (data ?? []) as unknown as { patient_id: string; users: { id: string; full_name: string } | null }[]) {
        if (row.users) map.set(row.users.id, row.users.full_name)
      }
      return Array.from(map.entries()).map(([id, full_name]) => ({ id, full_name })).sort((a, b) => a.full_name.localeCompare(b.full_name))
    },
  })

  const createDisputeMutation = useMutation({
    mutationFn: async () => {
      if (!myId || !newPatientId) return
      const { error } = await supabase.from('disputes').insert({
        patient_id: newPatientId,
        practitioner_id: myId,
        reason: newReason,
        description: newDescription.trim() || null,
        case_number: '',
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['practitioner-disputes'] })
      setShowNew(false); setNewPatientId(''); setNewReason(PRACTITIONER_REASONS[0]); setNewDescription(''); setNewError(null)
    },
    onError: (e: Error) => setNewError(e.message),
  })

  const commentMutation = useMutation({
    mutationFn: async () => {
      if (!selected || !comment.trim()) return
      const { error } = await supabase.from('dispute_events').insert({
        dispute_id: selected.id,
        type: 'comment',
        actor_role: 'practitioner',
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
    patient: 'Patient', practitioner: 'Vous', admin: 'Admin', system: 'Système',
  }

  const open = disputes.filter(d => d.status === 'open' || d.status === 'under_review').length

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-[#0b1c30]">Litiges</h1>
          <p className="text-sm text-[#6f787e] mt-1">Réclamations impliquant votre activité</p>
        </div>
        <div className="flex items-center gap-3">
          {open > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              <span className="material-symbols-outlined text-amber-600" style={{ fontSize: '18px' }}>warning</span>
              <span className="text-sm font-semibold text-amber-700">{open} en cours</span>
            </div>
          )}
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#82d8ff] text-[#0b1c30] text-sm font-bold rounded-xl hover:shadow-lg transition-all">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
            Ouvrir un litige
          </button>
        </div>
      </div>

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowNew(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#0b1c30]">Ouvrir un litige</h3>
            <div>
              <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Patient concerné</label>
              <select value={newPatientId} onChange={e => setNewPatientId(e.target.value)}
                className="w-full mt-1 rounded-xl border-2 border-slate-200 px-3 py-2 text-sm text-[#0b1c30] focus:outline-none focus:border-[#82d8ff]">
                <option value="">Sélectionner un patient</option>
                {myPatients.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
              {myPatients.length === 0 && (
                <p className="text-xs text-[#6f787e] mt-1">Aucun patient éligible — un rendez-vous commun est requis.</p>
              )}
            </div>
            <div>
              <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Motif</label>
              <select value={newReason} onChange={e => setNewReason(e.target.value)}
                className="w-full mt-1 rounded-xl border-2 border-slate-200 px-3 py-2 text-sm text-[#0b1c30] focus:outline-none focus:border-[#82d8ff]">
                {PRACTITIONER_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Description</label>
              <textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} rows={3}
                className="w-full mt-1 rounded-xl border-2 border-slate-200 px-3 py-2 text-sm text-[#0b1c30] focus:outline-none focus:border-[#82d8ff] resize-none" />
            </div>
            {newError && <p className="text-sm text-[#ba1a1a] font-semibold">{newError}</p>}
            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowNew(false)} className="flex-1 border-2 border-slate-200 text-[#0b1c30] rounded-xl py-2.5 text-sm font-bold hover:bg-slate-50">
                Annuler
              </button>
              <button onClick={() => createDisputeMutation.mutate()} disabled={!newPatientId || createDisputeMutation.isPending}
                className="flex-1 bg-[#82d8ff] text-[#0b1c30] rounded-xl py-2.5 text-sm font-bold disabled:opacity-50">
                {createDisputeMutation.isPending ? 'Création...' : 'Créer le litige'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Liste */}
        <div className="space-y-3">
          {isLoading ? (
            [1, 2].map(i => <div key={i} className="h-28 rounded-2xl bg-white/40 animate-pulse" />)
          ) : disputes.length === 0 ? (
            <div className="rounded-2xl py-16 text-center space-y-2" style={{ backgroundColor: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.8)' }}>
              <span className="material-symbols-outlined text-4xl text-slate-300">gavel</span>
              <p className="text-sm text-[#6f787e]">Aucun litige</p>
            </div>
          ) : disputes.map(d => {
            const meta = STATUS_META[d.status] ?? STATUS_META.open
            return (
              <button key={d.id} onClick={() => setSelected(d)}
                className={`w-full text-left rounded-2xl p-4 space-y-3 transition-all border-2 ${selected?.id === d.id ? 'border-[#82d8ff]' : 'border-transparent hover:border-slate-200'}`}
                style={{ backgroundColor: 'rgba(255,255,255,0.6)' }}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-mono text-[#6f787e]">{d.case_number}</p>
                    <p className="text-sm font-semibold text-[#0b1c30] mt-0.5 line-clamp-2">{d.reason}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.color}`}>{meta.label}</span>
                    {d.priority === 'urgent' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Urgent</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-[#6f787e]">{d.patient?.full_name ?? '—'}</p>
                  <p className="text-xs text-slate-400">{fmtDate(d.created_at)}</p>
                </div>
              </button>
            )
          })}
        </div>

        {/* Détail + réponse */}
        {selected && (
          <div className="rounded-2xl flex flex-col overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.8)' }}>
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-mono text-[#6f787e]">{selected.case_number}</p>
                <p className="text-sm font-bold text-[#0b1c30] mt-0.5">{selected.reason}</p>
              </div>
              <button onClick={() => setSelected(null)} aria-label="Fermer" className="text-[#6f787e] hover:text-[#0b1c30]">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {selected.description && (
              <div className="px-4 pt-3 pb-0">
                <p className="text-xs text-[#6f787e] bg-slate-50 rounded-xl px-3 py-2">{selected.description}</p>
              </div>
            )}

            {/* Timeline */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 max-h-64">
              {events.map(ev => (
                <div key={ev.id} className="flex gap-3">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full self-start whitespace-nowrap ${ACTOR_STYLE[ev.actor_role] ?? 'bg-slate-100 text-slate-500'}`}>
                    {ACTOR_LABEL[ev.actor_role] ?? ev.actor_role}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm text-[#0b1c30]">{ev.content}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{fmtDate(ev.created_at)}</p>
                  </div>
                </div>
              ))}
              {events.length === 0 && (
                <p className="text-xs text-[#6f787e] text-center py-4">Aucune activité</p>
              )}
            </div>

            {/* Zone réponse */}
            {['open', 'under_review'].includes(selected.status) && (
              <div className="px-4 py-3 border-t border-slate-100 flex gap-2">
                <input value={comment} onChange={e => setComment(e.target.value)}
                  placeholder="Votre réponse..."
                  className="flex-1 text-sm px-3 py-2 rounded-xl border border-slate-200 bg-white text-[#0b1c30] focus:outline-none focus:border-[#82d8ff]"
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commentMutation.mutate() } }}
                />
                <button onClick={() => commentMutation.mutate()} disabled={!comment.trim() || commentMutation.isPending}
                  className="p-2 rounded-xl bg-[#82d8ff] text-[#0b1c30] disabled:opacity-50">
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>send</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
