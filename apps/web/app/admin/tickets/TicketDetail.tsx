'use client'
import { useRef, useState } from 'react'
import type { Ticket, TicketStatus, TicketPriority } from './types'
import { STATUS_COLUMNS, TYPE_META, PRIORITY_META, FIELD_LABELS, MODULE_LABELS, isValidTicketTransition } from './types'
import { useTicketDetail } from './useTickets'

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span className="material-symbols-outlined" style={style}>{name}</span>
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function TicketDetail({
  ticket, adminUsers, onClose, onUpdate,
}: {
  ticket: Ticket
  adminUsers: { id: string; full_name: string }[]
  onClose: () => void
  onUpdate: (patch: { id: string } & Partial<Pick<Ticket, 'status' | 'assignee_id' | 'priority' | 'due_date'>>) => void
}) {
  const { comments, attachments, history, addComment, uploadAttachment, openAttachment } = useTicketDetail(ticket.id)
  const [tab, setTab] = useState<'comments' | 'attachments' | 'history'>('comments')
  const [commentText, setCommentText] = useState('')
  const [statusError, setStatusError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const type = TYPE_META[ticket.type]

  const handleStatusChange = (newStatus: TicketStatus) => {
    if (!isValidTicketTransition(ticket.status, newStatus)) {
      const nextLabel = STATUS_COLUMNS[STATUS_COLUMNS.findIndex(s => s.key === ticket.status) + 1]?.label
      setStatusError(`Étape ignorée : ce ticket doit d'abord passer par "${nextLabel}".`)
      return
    }
    setStatusError(null)
    onUpdate({ id: ticket.id, status: newStatus })
  }

  const handleAddComment = () => {
    if (!commentText.trim()) return
    addComment.mutate(commentText.trim())
    setCommentText('')
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" />
      <div className="relative w-full sm:w-[420px] h-full bg-white shadow-2xl flex flex-col overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: type.bg, color: type.color }}>
            <Icon name={type.icon} style={{ fontSize: '13px' }} />
            {type.label}
          </span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
            <Icon name="close" style={{ fontSize: '18px' }} />
          </button>
        </div>

        <div className="p-5 space-y-4 border-b border-slate-100">
          <h3 className="font-bold text-[#0b1c30] text-lg leading-snug">{ticket.title}</h3>
          {ticket.description && <p className="text-sm text-[#3f484d] leading-relaxed">{ticket.description}</p>}
          {ticket.source ? (
            <p className="text-xs text-[#705d00] bg-[#fff8e1] rounded-lg px-2.5 py-1.5 inline-block">
              Détecté automatiquement ({ticket.source}) le {fmtDateTime(ticket.created_at)}
            </p>
          ) : (
            <p className="text-xs text-[#6f787e]">Créé par {ticket.creator?.full_name ?? '—'} le {fmtDateTime(ticket.created_at)}</p>
          )}
          {(ticket.module || ticket.related_user) && (
            <div className="flex flex-wrap gap-2">
              {ticket.module && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                  Module : {MODULE_LABELS[ticket.module] ?? ticket.module}
                </span>
              )}
              {ticket.related_user && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                  Utilisateur concerné : {ticket.related_user.full_name}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Edit fields */}
        <div className="p-5 space-y-3 border-b border-slate-100">
          <div>
            <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Statut</label>
            <select value={ticket.status} onChange={e => handleStatusChange(e.target.value as TicketStatus)}
              className="w-full mt-1 rounded-xl border-2 border-slate-200 px-3 py-2 text-sm text-[#0b1c30] focus:outline-none focus:border-[#82d8ff]">
              {STATUS_COLUMNS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            {statusError && <p className="text-xs text-amber-700 mt-1">{statusError}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Priorité</label>
              <select value={ticket.priority} onChange={e => onUpdate({ id: ticket.id, priority: e.target.value as TicketPriority })}
                className="w-full mt-1 rounded-xl border-2 border-slate-200 px-3 py-2 text-sm text-[#0b1c30] focus:outline-none focus:border-[#82d8ff]">
                {(Object.keys(PRIORITY_META) as TicketPriority[]).map(p => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Responsable</label>
              <select value={ticket.assignee_id ?? ''} onChange={e => onUpdate({ id: ticket.id, assignee_id: e.target.value || null })}
                className="w-full mt-1 rounded-xl border-2 border-slate-200 px-3 py-2 text-sm text-[#0b1c30] focus:outline-none focus:border-[#82d8ff]">
                <option value="">Non assigné</option>
                {adminUsers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Échéance</label>
            <input type="date" value={ticket.due_date ?? ''} onChange={e => onUpdate({ id: ticket.id, due_date: e.target.value || null })}
              className="w-full mt-1 rounded-xl border-2 border-slate-200 px-3 py-2 text-sm text-[#0b1c30] focus:outline-none focus:border-[#82d8ff]" />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100">
          {(['comments', 'attachments', 'history'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 py-3 text-xs font-bold transition-colors"
              style={{ color: tab === t ? '#82d8ff' : '#6f787e', borderBottom: tab === t ? '2px solid #82d8ff' : '2px solid transparent' }}>
              {t === 'comments' ? `Commentaires (${comments.data?.length ?? 0})` : t === 'attachments' ? `Pièces jointes (${attachments.data?.length ?? 0})` : 'Historique'}
            </button>
          ))}
        </div>

        <div className="flex-1 p-5">
          {tab === 'comments' && (
            <div className="space-y-4">
              <div className="space-y-3">
                {(comments.data ?? []).map(c => (
                  <div key={c.id} className="flex gap-2">
                    <div className="w-7 h-7 rounded-full bg-[#82d8ff] flex items-center justify-center text-[9px] font-bold text-[#0b1c30] flex-shrink-0">
                      {initials(c.author?.full_name ?? '?')}
                    </div>
                    <div className="flex-1 bg-slate-50 rounded-xl px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[#0b1c30]">{c.author?.full_name ?? '—'}</span>
                        <span className="text-[10px] text-[#6f787e]">{fmtDateTime(c.created_at)}</span>
                      </div>
                      <p className="text-sm text-[#3f484d] mt-0.5">{c.body}</p>
                    </div>
                  </div>
                ))}
                {(comments.data ?? []).length === 0 && <p className="text-sm text-[#bec8ce] text-center py-4">Aucun commentaire</p>}
              </div>
              <div className="flex gap-2">
                <input value={commentText} onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddComment() }}
                  placeholder="Ajouter un commentaire..."
                  className="flex-1 rounded-xl border-2 border-slate-200 px-3 py-2 text-sm text-[#0b1c30] focus:outline-none focus:border-[#82d8ff]" />
                <button onClick={handleAddComment} disabled={addComment.isPending || !commentText.trim()}
                  className="px-4 py-2 rounded-xl bg-[#82d8ff] text-[#0b1c30] text-sm font-bold disabled:opacity-50">
                  Envoyer
                </button>
              </div>
            </div>
          )}

          {tab === 'attachments' && (
            <div className="space-y-3">
              {(attachments.data ?? []).map(a => (
                <button key={a.id} onClick={() => void openAttachment(a.file_url)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors text-left">
                  <Icon name="attach_file" style={{ fontSize: '18px', color: '#82d8ff' }} />
                  <span className="text-sm text-[#0b1c30] font-medium truncate flex-1">{a.file_name}</span>
                  <Icon name="download" style={{ fontSize: '16px', color: '#6f787e' }} />
                </button>
              ))}
              {(attachments.data ?? []).length === 0 && <p className="text-sm text-[#bec8ce] text-center py-4">Aucune pièce jointe</p>}
              <input ref={fileInputRef} type="file" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadAttachment.mutate(f); e.target.value = '' }} />
              <button onClick={() => fileInputRef.current?.click()} disabled={uploadAttachment.isPending}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-[#82d8ff] bg-[#e5eeff] disabled:opacity-50">
                {uploadAttachment.isPending ? 'Envoi...' : '+ Ajouter une pièce jointe'}
              </button>
            </div>
          )}

          {tab === 'history' && (
            <div className="space-y-3 relative pl-4">
              <div className="absolute left-1 top-1 bottom-1 w-px bg-slate-200" />
              {(history.data ?? []).map(h => (
                <div key={h.id} className="relative">
                  <div className="absolute -left-4 top-1.5 w-2 h-2 rounded-full bg-[#82d8ff]" />
                  <p className="text-xs text-[#0b1c30]">
                    <span className="font-bold">{h.actor?.full_name ?? 'Système'}</span> a changé{' '}
                    <span className="font-semibold">{FIELD_LABELS[h.field_changed] ?? h.field_changed}</span>
                  </p>
                  <p className="text-[10px] text-[#6f787e]">{fmtDateTime(h.created_at)}</p>
                </div>
              ))}
              {(history.data ?? []).length === 0 && <p className="text-sm text-[#bec8ce] text-center py-4">Aucun historique</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
