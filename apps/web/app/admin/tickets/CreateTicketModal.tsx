'use client'
import { useState } from 'react'
import type { TicketType, TicketPriority } from './types'
import { TYPE_META, PRIORITY_META } from './types'

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span className="material-symbols-outlined" style={style}>{name}</span>
}

export function CreateTicketModal({
  adminUsers, onClose, onCreate, creating,
}: {
  adminUsers: { id: string; full_name: string }[]
  onClose: () => void
  onCreate: (input: { title: string; description: string; type: TicketType; priority: TicketPriority; assignee_id: string | null; due_date: string | null }) => void
  creating: boolean
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<TicketType>('tache')
  const [priority, setPriority] = useState<TicketPriority>('medium')
  const [assigneeId, setAssigneeId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { setError('Le titre est requis'); return }
    onCreate({
      title: title.trim(),
      description: description.trim(),
      type, priority,
      assignee_id: assigneeId || null,
      due_date: dueDate || null,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-[#0b1c30]">Nouveau ticket</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <Icon name="close" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-[#0b1c30] mb-1.5">Titre <span className="text-[#ba1a1a]">*</span></label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="w-full rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm text-[#0b1c30] focus:outline-none focus:border-[#82d8ff]"
              placeholder="Ex : Le bouton Annuler ne fonctionne pas" />
          </div>
          <div>
            <label className="block text-sm font-bold text-[#0b1c30] mb-1.5">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              className="w-full rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm text-[#0b1c30] focus:outline-none focus:border-[#82d8ff] resize-none" />
          </div>
          <div>
            <label className="block text-sm font-bold text-[#0b1c30] mb-1.5">Type</label>
            <div className="flex gap-2 flex-wrap">
              {(Object.keys(TYPE_META) as TicketType[]).map(t => (
                <button key={t} type="button" onClick={() => setType(t)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all"
                  style={{
                    backgroundColor: type === t ? TYPE_META[t].bg : 'white',
                    color: TYPE_META[t].color,
                    borderColor: type === t ? TYPE_META[t].color : '#e2e8f0',
                  }}>
                  <Icon name={TYPE_META[t].icon} style={{ fontSize: '14px' }} />
                  {TYPE_META[t].label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-[#0b1c30] mb-1.5">Priorité</label>
            <div className="flex gap-2 flex-wrap">
              {(Object.keys(PRIORITY_META) as TicketPriority[]).map(p => (
                <button key={p} type="button" onClick={() => setPriority(p)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all"
                  style={{
                    backgroundColor: priority === p ? PRIORITY_META[p].bg : 'white',
                    color: PRIORITY_META[p].color,
                    borderColor: priority === p ? PRIORITY_META[p].color : '#e2e8f0',
                  }}>
                  {PRIORITY_META[p].label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-bold text-[#0b1c30] mb-1.5">Responsable</label>
              <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)}
                className="w-full rounded-xl border-2 border-slate-200 px-3 py-2.5 text-sm text-[#0b1c30] focus:outline-none focus:border-[#82d8ff]">
                <option value="">Non assigné</option>
                {adminUsers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-[#0b1c30] mb-1.5">Échéance</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="w-full rounded-xl border-2 border-slate-200 px-3 py-2.5 text-sm text-[#0b1c30] focus:outline-none focus:border-[#82d8ff]" />
            </div>
          </div>
          {error && <p className="text-sm text-[#ba1a1a] font-semibold">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border-2 border-slate-200 text-[#0b1c30] rounded-xl py-2.5 text-sm font-bold hover:bg-slate-50">
              Annuler
            </button>
            <button type="submit" disabled={creating} className="flex-1 bg-[#82d8ff] text-[#0b1c30] rounded-xl py-2.5 text-sm font-bold disabled:opacity-50">
              {creating ? 'Création...' : 'Créer le ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
