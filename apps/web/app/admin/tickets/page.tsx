'use client'
import { useMemo, useState } from 'react'
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { useTickets } from './useTickets'
import { STATUS_COLUMNS, TYPE_META } from './types'
import type { Ticket, TicketStatus, TicketType } from './types'
import { KanbanColumn } from './KanbanColumn'
import { CreateTicketModal } from './CreateTicketModal'
import { TicketDetail } from './TicketDetail'

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span className="material-symbols-outlined" style={style}>{name}</span>
}

export default function TicketsPage() {
  const { tickets, adminUsers, createTicket, updateTicket } = useTickets()
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState<Ticket | null>(null)
  const [typeFilter, setTypeFilter] = useState<TicketType | 'all'>('all')
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all')

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const filtered = useMemo(() => {
    return (tickets.data ?? []).filter(t =>
      (typeFilter === 'all' || t.type === typeFilter) &&
      (assigneeFilter === 'all' || t.assignee_id === assigneeFilter || (assigneeFilter === 'none' && !t.assignee_id))
    )
  }, [tickets.data, typeFilter, assigneeFilter])

  const byStatus = useMemo(() => {
    const map: Record<TicketStatus, Ticket[]> = { a_faire: [], en_cours: [], en_test: [], corrige: [], valide: [], deploye: [] }
    for (const t of filtered) map[t.status].push(t)
    return map
  }, [filtered])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return
    const newStatus = over.id as TicketStatus
    const ticket = (tickets.data ?? []).find(t => t.id === active.id)
    if (ticket && ticket.status !== newStatus) {
      updateTicket.mutate({ id: ticket.id, status: newStatus })
      setSelected(sel => sel && sel.id === ticket.id ? { ...sel, status: newStatus } : sel)
    }
  }

  // Keep the open detail panel's fields in sync with live updates from other admins.
  const selectedLive = selected ? (tickets.data ?? []).find(t => t.id === selected.id) ?? selected : null

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1c30]">Tickets</h1>
          <p className="text-sm text-[#6f787e] mt-0.5">Bugs, évolutions, support, incidents — suivi de l&apos;équipe</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-[#0b1c30] hover:shadow-lg transition-all"
          style={{ backgroundColor: '#82d8ff' }}>
          <Icon name="add" style={{ fontSize: '18px' }} />
          Nouveau ticket
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as TicketType | 'all')}
          className="px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 text-[#0b1c30] bg-white">
          <option value="all">Tous types</option>
          {(Object.keys(TYPE_META) as TicketType[]).map(t => <option key={t} value={t}>{TYPE_META[t].label}</option>)}
        </select>
        <select value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)}
          className="px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 text-[#0b1c30] bg-white">
          <option value="all">Tous responsables</option>
          <option value="none">Non assigné</option>
          {(adminUsers.data ?? []).map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
        </select>
      </div>

      {tickets.isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {STATUS_COLUMNS.map(s => <div key={s.key} className="w-72 h-64 rounded-2xl bg-white/40 animate-pulse flex-shrink-0" />)}
        </div>
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {STATUS_COLUMNS.map(col => (
              <KanbanColumn key={col.key} status={col.key} label={col.label} tickets={byStatus[col.key]} onOpen={setSelected} />
            ))}
          </div>
        </DndContext>
      )}

      {showCreate && (
        <CreateTicketModal
          adminUsers={adminUsers.data ?? []}
          onClose={() => setShowCreate(false)}
          creating={createTicket.isPending}
          onCreate={input => createTicket.mutate(input, { onSuccess: () => setShowCreate(false) })}
        />
      )}

      {selectedLive && (
        <TicketDetail
          ticket={selectedLive}
          adminUsers={adminUsers.data ?? []}
          onClose={() => setSelected(null)}
          onUpdate={patch => updateTicket.mutate(patch)}
        />
      )}
    </div>
  )
}
