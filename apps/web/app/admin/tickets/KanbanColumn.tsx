'use client'
import { useDroppable } from '@dnd-kit/core'
import type { TicketStatus } from './types'
import { TicketCard, type IncidentCardData } from './TicketCard'

export function KanbanColumn({
  status, label, cards, onOpen,
}: {
  status: TicketStatus
  label: string
  cards: IncidentCardData[]
  onOpen: (id: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div className="flex flex-col w-64 sm:w-72 flex-shrink-0">
      <div className="flex items-center justify-between px-1 mb-2">
        <p className="text-sm font-bold text-[#0b1c30]">{label}</p>
        <span className="text-xs font-semibold text-[#6f787e] bg-slate-100 px-2 py-0.5 rounded-full">{cards.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className="flex-1 space-y-2 rounded-2xl p-2 min-h-[120px] transition-colors"
        style={{
          backgroundColor: isOver ? 'rgba(130,216,255,0.12)' : 'rgba(255,255,255,0.35)',
          border: isOver ? '1px dashed #82d8ff' : '1px solid rgba(255,255,255,0.60)',
        }}
      >
        {cards.map(c => <TicketCard key={c.id} card={c} onOpen={() => onOpen(c.id)} />)}
        {cards.length === 0 && (
          <p className="text-xs text-[#bec8ce] text-center py-6">Aucun incident</p>
        )}
      </div>
    </div>
  )
}
