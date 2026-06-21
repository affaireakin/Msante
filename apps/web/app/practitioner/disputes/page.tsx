'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

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
    queryKey: ['practitioner-disputes', practId],
    enabled: !!practId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('disputes')
        .select('id, case_number, reason, description, status, priority, created_at, patient:patient_id(full_name)')
        .eq('practitioner_id', practId!)
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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#0b1c30]">Litiges</h1>
          <p className="text-sm text-[#6f787e] mt-1">Réclamations impliquant votre activité</p>
        </div>
        {open > 0 && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            <span className="material-symbols-outlined text-amber-600" style={{ fontSize: '18px' }}>warning</span>
            <span className="text-sm font-semibold text-amber-700">{open} en cours</span>
          </div>
        )}
      </div>

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
                className={`w-full text-left rounded-2xl p-4 space-y-3 transition-all border-2 ${selected?.id === d.id ? 'border-[#006685]' : 'border-transparent hover:border-slate-200'}`}
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
              <button onClick={() => setSelected(null)} className="text-[#6f787e] hover:text-[#0b1c30]">
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
                  className="flex-1 text-sm px-3 py-2 rounded-xl border border-slate-200 bg-white text-[#0b1c30] focus:outline-none focus:border-[#006685]"
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commentMutation.mutate() } }}
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
    </div>
  )
}
