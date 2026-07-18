'use client'
import { useDroppable } from '@dnd-kit/core'
import type { Ticket, TicketStatus } from './types'
import { TicketCard } from './TicketCard'

export function KanbanColumn({
  status, label, tickets, onOpen,
}: {
  status: TicketStatus
  label: string
  tickets: Ticket[]
  onOpen: (ticket: Ticket) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div className="flex flex-col w-72 flex-shrink-0">
      <div className="flex items-center justify-between px-1 mb-2">
        <p className="text-sm font-bold text-[#0b1c30]">{label}</p>
        <span className="text-xs font-semibold text-[#6f787e] bg-slate-100 px-2 py-0.5 rounded-full">{tickets.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className="flex-1 space-y-2 rounded-2xl p-2 min-h-[120px] transition-colors"
        style={{
          backgroundColor: isOver ? 'rgba(130,216,255,0.12)' : 'rgba(255,255,255,0.35)',
          border: isOver ? '1px dashed #82d8ff' : '1px solid rgba(255,255,255,0.60)',
        }}
      >
        {tickets.map(t => <TicketCard key={t.id} ticket={t} onOpen={() => onOpen(t)} />)}
        {tickets.length === 0 && (
          <p className="text-xs text-[#bec8ce] text-center py-6">Aucun ticket</p>
        )}
      </div>
    </div>
  )
}
