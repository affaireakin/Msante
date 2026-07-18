'use client'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { Ticket } from './types'
import { TYPE_META, PRIORITY_META } from './types'

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span className="material-symbols-outlined" style={style}>{name}</span>
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export function TicketCard({ ticket, onOpen }: { ticket: Ticket; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: ticket.id })
  const type = TYPE_META[ticket.type]
  const priority = PRIORITY_META[ticket.priority]
  const overdue = ticket.due_date ? new Date(ticket.due_date) < new Date() && ticket.status !== 'deploye' : false

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onOpen}
      style={{
        transform: transform ? CSS.Translate.toString(transform) : undefined,
        opacity: isDragging ? 0.4 : 1,
        touchAction: 'none',
      }}
      className="rounded-xl p-3 cursor-grab active:cursor-grabbing space-y-2 bg-white/80 border border-white/90 hover:shadow-md transition-shadow"
    >
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: type.bg, color: type.color }}>
          <Icon name={type.icon} style={{ fontSize: '11px' }} />
          {type.label}
        </span>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: priority.bg, color: priority.color }}>
          {priority.label}
        </span>
      </div>
      <p className="text-sm font-semibold text-[#0b1c30] leading-snug">{ticket.title}</p>
      <div className="flex items-center justify-between pt-1">
        {ticket.assignee ? (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-[#82d8ff] flex items-center justify-center text-[8px] font-bold text-[#0b1c30]">
              {initials(ticket.assignee.full_name)}
            </div>
            <span className="text-[10px] text-[#6f787e] truncate max-w-[80px]">{ticket.assignee.full_name}</span>
          </div>
        ) : (
          <span className="text-[10px] text-[#bec8ce] italic">Non assigné</span>
        )}
        {ticket.due_date && (
          <span className={`text-[10px] font-semibold ${overdue ? 'text-[#ba1a1a]' : 'text-[#6f787e]'}`}>
            {new Date(ticket.due_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>
    </div>
  )
}
