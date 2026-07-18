export type TicketType = 'bug' | 'evolution' | 'support' | 'incident' | 'tache'
export type TicketStatus = 'a_faire' | 'en_cours' | 'en_test' | 'corrige' | 'valide' | 'deploye'
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface Ticket {
  id: string
  title: string
  description: string | null
  type: TicketType
  priority: TicketPriority
  status: TicketStatus
  assignee_id: string | null
  due_date: string | null
  created_by: string
  created_at: string
  updated_at: string
  assignee: { full_name: string } | null
  creator: { full_name: string } | null
}

export interface TicketComment {
  id: string
  ticket_id: string
  author_id: string
  body: string
  created_at: string
  author: { full_name: string } | null
}

export interface TicketAttachment {
  id: string
  ticket_id: string
  file_url: string
  file_name: string
  uploaded_by: string
  created_at: string
}

export interface TicketHistoryEntry {
  id: string
  ticket_id: string
  actor_id: string | null
  field_changed: string
  old_value: string | null
  new_value: string | null
  created_at: string
  actor: { full_name: string } | null
}

export const STATUS_COLUMNS: { key: TicketStatus; label: string }[] = [
  { key: 'a_faire', label: 'À faire' },
  { key: 'en_cours', label: 'En cours' },
  { key: 'en_test', label: 'En test' },
  { key: 'corrige', label: 'Corrigé' },
  { key: 'valide', label: 'Validé' },
  { key: 'deploye', label: 'Déployé' },
]

export const TYPE_META: Record<TicketType, { label: string; icon: string; color: string; bg: string }> = {
  bug:       { label: 'Bug',       icon: 'bug_report',     color: '#ba1a1a', bg: '#ffdad6' },
  evolution: { label: 'Évolution', icon: 'trending_up',    color: '#005e7a', bg: '#e5eeff' },
  support:   { label: 'Support',   icon: 'support_agent',  color: '#1d7a3a', bg: '#e8f5e9' },
  incident:  { label: 'Incident',  icon: 'warning',        color: '#705d00', bg: '#fff8e1' },
  tache:     { label: 'Tâche',     icon: 'task_alt',       color: '#5c5f61', bg: '#e0e3e5' },
}

export const PRIORITY_META: Record<TicketPriority, { label: string; color: string; bg: string }> = {
  low:    { label: 'Basse',    color: '#5c5f61', bg: '#e0e3e5' },
  medium: { label: 'Moyenne',  color: '#005e7a', bg: '#e5eeff' },
  high:   { label: 'Haute',    color: '#705d00', bg: '#fff8e1' },
  urgent: { label: 'Urgente',  color: '#ba1a1a', bg: '#ffdad6' },
}

export const FIELD_LABELS: Record<string, string> = {
  status: 'Statut',
  assignee_id: 'Responsable',
  priority: 'Priorité',
}
