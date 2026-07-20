'use client'
import { useState } from 'react'
import type { Dispute } from './types'
import { useDisputeDetail } from './useDisputesBoard'

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span className="material-symbols-outlined" style={style}>{name}</span>
}

const EVENT_ICON: Record<string, string> = {
  created: 'flag', status_changed: 'swap_horiz', comment: 'chat_bubble', action_taken: 'gavel', evidence_added: 'attach_file',
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return "À l'instant"
  if (h < 24) return `il y a ${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `il y a ${d}j`
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export function DisputeDetail({ dispute, onClose }: { dispute: Dispute; onClose: () => void }) {
  const { events, updateStatus, suspendAccount, issueWarning, addComment } = useDisputeDetail(dispute.id)
  const [comment, setComment] = useState('')
  const isDone = dispute.status === 'resolved' || dispute.status === 'closed'

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" />
      <div className="relative w-full sm:w-[420px] h-full bg-white shadow-2xl flex flex-col overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <p className="text-xs font-bold text-[#82d8ff] font-mono">{dispute.case_number}</p>
            <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#ffdad6] text-[#ba1a1a] mt-1 w-fit">
              <Icon name="gavel" style={{ fontSize: '12px' }} />
              Litige
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
            <Icon name="close" style={{ fontSize: '18px' }} />
          </button>
        </div>

        <div className="p-5 space-y-4 border-b border-slate-100">
          <h3 className="font-bold text-[#0b1c30] text-lg leading-snug">{dispute.reason}</h3>
          {dispute.description && <p className="text-sm text-[#3f484d] leading-relaxed">{dispute.description}</p>}
          <div className="space-y-2">
            {[
              { label: 'Patient', value: dispute.patient?.full_name ?? '—' },
              { label: 'Praticien', value: dispute.practitioner?.full_name ?? '—' },
              { label: 'Statut compte', value: dispute.patient?.account_status ?? 'active' },
            ].map(row => (
              <div key={row.label} className="flex justify-between items-center">
                <p className="text-xs text-[#6f787e] font-medium">{row.label}</p>
                <p className="text-xs font-bold text-[#0b1c30]">{row.value}</p>
              </div>
            ))}
          </div>
        </div>

        {dispute.resolution_notes && (
          <div className="mx-5 mt-4 rounded-xl p-3" style={{ backgroundColor: '#e8f5e9', border: '1px solid rgba(29,122,58,0.15)' }}>
            <p className="text-xs font-bold text-[#1d7a3a] mb-1">Note de résolution</p>
            <p className="text-xs text-[#0b1c30]">{dispute.resolution_notes}</p>
          </div>
        )}

        <div className="p-5 space-y-3">
          <p className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Historique</p>
          {(events.data ?? []).length === 0 ? (
            <p className="text-xs text-[#bec8ce] text-center py-3">Aucun événement</p>
          ) : (
            <div className="relative pl-1">
              <div className="absolute left-3.5 top-0 bottom-0 w-px bg-slate-100" />
              <div className="space-y-3">
                {(events.data ?? []).map(ev => (
                  <div key={ev.id} className="flex gap-3 relative">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 z-10"
                      style={{ backgroundColor: ev.type === 'action_taken' ? '#ffdad6' : '#e5eeff' }}>
                      <Icon name={EVENT_ICON[ev.type] ?? 'info'} style={{ fontSize: '13px', color: ev.type === 'action_taken' ? '#ba1a1a' : '#82d8ff' }} />
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

          {!isDone && (
            <div className="pt-2">
              <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2}
                placeholder="Ajouter une note admin…"
                className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 resize-none outline-none focus:border-[#82d8ff] text-[#0b1c30] placeholder-[#bec8ce] bg-[#f8f9ff]" />
              <button disabled={!comment.trim() || addComment.isPending}
                onClick={() => { addComment.mutate(comment.trim()); setComment('') }}
                className="mt-1.5 w-full py-2 rounded-xl text-xs font-bold text-white disabled:opacity-40" style={{ backgroundColor: '#82d8ff' }}>
                Enregistrer la note
              </button>
            </div>
          )}
        </div>

        {!isDone && (
          <div className="px-5 pb-5 space-y-2">
            <button onClick={() => updateStatus.mutate({ status: 'under_review' })}
              disabled={dispute.status === 'under_review' || updateStatus.isPending}
              className="w-full py-2.5 rounded-xl text-xs font-bold border disabled:opacity-40" style={{ borderColor: '#bec8ce', color: '#3f484d' }}>
              <span className="flex items-center justify-center gap-1.5"><Icon name="hourglass_top" style={{ fontSize: '14px' }} />Mettre en examen</span>
            </button>
            <button onClick={() => issueWarning.mutate()} disabled={issueWarning.isPending}
              className="w-full py-2.5 rounded-xl text-xs font-bold" style={{ backgroundColor: '#fff8e1', color: '#705d00', border: '1px solid rgba(112,93,0,0.20)' }}>
              <span className="flex items-center justify-center gap-1.5"><Icon name="warning" style={{ fontSize: '14px' }} />Émettre un avertissement</span>
            </button>
            <button onClick={() => suspendAccount.mutate(dispute.patient_id)}
              disabled={dispute.patient?.account_status === 'suspended' || suspendAccount.isPending}
              className="w-full py-2.5 rounded-xl text-xs font-bold disabled:opacity-40" style={{ backgroundColor: '#ffdad6', color: '#ba1a1a', border: '1px solid rgba(186,26,26,0.20)' }}>
              <span className="flex items-center justify-center gap-1.5">
                <Icon name="block" style={{ fontSize: '14px' }} />
                {dispute.patient?.account_status === 'suspended' ? 'Compte déjà suspendu' : 'Suspendre le compte'}
              </span>
            </button>
            <button onClick={() => updateStatus.mutate({ status: 'resolved', notes: 'Résolu par admin.' })}
              disabled={updateStatus.isPending}
              className="w-full py-2.5 rounded-xl text-xs font-bold text-white" style={{ backgroundColor: '#1d7a3a' }}>
              <span className="flex items-center justify-center gap-1.5"><Icon name="check_circle" style={{ fontSize: '14px' }} />Marquer comme résolu</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
