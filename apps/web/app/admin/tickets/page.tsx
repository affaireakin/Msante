'use client'
import { useMemo, useState } from 'react'
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { useTickets } from './useTickets'
import { useDisputesBoard } from './useDisputesBoard'
import { STATUS_COLUMNS, TYPE_META, DISPUTE_STATUS_TO_KANBAN, KANBAN_TO_DISPUTE_STATUS, isValidTicketTransition } from './types'
import type { Ticket, TicketStatus, TicketType, Dispute } from './types'
import { KanbanColumn } from './KanbanColumn'
import type { IncidentCardData } from './TicketCard'
import { CreateTicketModal } from './CreateTicketModal'
import { TicketDetail } from './TicketDetail'
import { DisputeDetail } from './DisputeDetail'

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span className="material-symbols-outlined" style={style}>{name}</span>
}

export default function TicketsPage() {
  const { tickets, adminUsers, createTicket, updateTicket } = useTickets()
  const { disputes, updateDisputeStatus } = useDisputesBoard()
  const [showCreate, setShowCreate] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<TicketType | 'all'>('all')
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all')
  const [transitionError, setTransitionError] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const filteredTickets = useMemo(() => {
    return (tickets.data ?? []).filter(t =>
      (typeFilter === 'all' || t.type === typeFilter) &&
      (assigneeFilter === 'all' || t.assignee_id === assigneeFilter || (assigneeFilter === 'none' && !t.assignee_id))
    )
  }, [tickets.data, typeFilter, assigneeFilter])

  const filteredDisputes = useMemo(() => {
    if (typeFilter !== 'all' && typeFilter !== 'litige') return []
    return (disputes.data ?? []).filter(d =>
      assigneeFilter === 'all' || d.assigned_to === assigneeFilter || (assigneeFilter === 'none' && !d.assigned_to)
    )
  }, [disputes.data, typeFilter, assigneeFilter])

  const byStatus = useMemo(() => {
    const map: Record<TicketStatus, IncidentCardData[]> = { a_faire: [], en_cours: [], en_test: [], corrige: [], valide: [], deploye: [], cloture: [] }
    for (const t of filteredTickets) {
      map[t.status].push({
        id: t.id, title: t.title, type: t.type, priority: t.priority, status: t.status,
        assigneeName: t.assignee?.full_name ?? null, dueDate: t.due_date,
      })
    }
    for (const d of filteredDisputes) {
      const status = DISPUTE_STATUS_TO_KANBAN[d.status]
      map[status].push({
        id: d.id, title: `${d.case_number} — ${d.reason}`, type: 'litige',
        priority: d.priority === 'urgent' ? 'urgent' : 'medium', status,
        assigneeName: d.assignee?.full_name ?? null, dueDate: null,
      })
    }
    return map
  }, [filteredTickets, filteredDisputes])

  const selectedTicket: Ticket | null = selectedId ? (tickets.data ?? []).find(t => t.id === selectedId) ?? null : null
  const selectedDispute: Dispute | null = selectedId && !selectedTicket ? (disputes.data ?? []).find(d => d.id === selectedId) ?? null : null

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return
    const newStatus = over.id as TicketStatus
    const ticket = (tickets.data ?? []).find(t => t.id === active.id)
    if (ticket) {
      if (ticket.status === newStatus) return
      if (!isValidTicketTransition(ticket.status, newStatus)) {
        setTransitionError(`Étape ignorée : un ticket "${STATUS_COLUMNS.find(s => s.key === ticket.status)?.label}" doit d'abord passer par "${STATUS_COLUMNS[STATUS_COLUMNS.findIndex(s => s.key === ticket.status) + 1]?.label}".`)
        return
      }
      updateTicket.mutate({ id: ticket.id, status: newStatus })
      return
    }
    const dispute = (disputes.data ?? []).find(d => d.id === active.id)
    if (dispute) {
      const newDisputeStatus = KANBAN_TO_DISPUTE_STATUS[newStatus]
      if (dispute.status !== newDisputeStatus) updateDisputeStatus.mutate({ id: dispute.id, status: newDisputeStatus })
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1c30]">Gestion des incidents</h1>
          <p className="text-sm text-[#6f787e] mt-0.5">Bugs, évolutions, support, litiges — un seul espace de suivi</p>
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

      {transitionError && (
        <div className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 bg-amber-50 border border-amber-200 text-sm text-amber-800">
          <span>{transitionError}</span>
          <button onClick={() => setTransitionError(null)} className="text-amber-600 hover:text-amber-900 flex-shrink-0">
            <Icon name="close" style={{ fontSize: '16px' }} />
          </button>
        </div>
      )}

      {(tickets.isLoading || disputes.isLoading) ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {STATUS_COLUMNS.map(s => <div key={s.key} className="w-72 h-64 rounded-2xl bg-white/40 animate-pulse flex-shrink-0" />)}
        </div>
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {STATUS_COLUMNS.map(col => (
              <KanbanColumn key={col.key} status={col.key} label={col.label} cards={byStatus[col.key]} onOpen={setSelectedId} />
            ))}
          </div>
        </DndContext>
      )}

      {showCreate && (
        <CreateTicketModal
          adminUsers={adminUsers.data ?? []}
          onClose={() => setShowCreate(false)}
          creating={createTicket.isPending}
          serverError={createError}
          onCreate={input => {
            setCreateError(null)
            createTicket.mutate(input, {
              onSuccess: (ticket) => { setShowCreate(false); if (ticket) setSelectedId(ticket.id) },
              onError: (err: Error) => setCreateError(err.message),
            })
          }}
        />
      )}

      {selectedTicket && (
        <TicketDetail
          ticket={selectedTicket}
          adminUsers={adminUsers.data ?? []}
          onClose={() => setSelectedId(null)}
          onUpdate={patch => updateTicket.mutate(patch)}
        />
      )}

      {selectedDispute && (
        <DisputeDetail dispute={selectedDispute} adminUsers={adminUsers.data ?? []} onClose={() => setSelectedId(null)} />
      )}
    </div>
  )
}
