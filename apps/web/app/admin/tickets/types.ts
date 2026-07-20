export type TicketType = 'bug' | 'evolution' | 'support' | 'incident' | 'tache' | 'litige'
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
  litige:    { label: 'Litige',    icon: 'gavel',          color: '#ba1a1a', bg: '#ffdad6' },
}

// Sections 15-16 : les litiges (table `disputes`, toujours créés côté
// patient/praticien exactement comme avant) sont affichés dans le même
// board que les tickets côté admin — ces mappings traduisent leur statut
// à 4 valeurs vers les 6 colonnes du kanban, sans jamais toucher aux pages
// patient/praticien ni au vocabulaire de statut des litiges en base.
export type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'closed'
export type DisputePriority = 'normal' | 'urgent'

export interface Dispute {
  id: string
  case_number: string
  status: DisputeStatus
  priority: DisputePriority
  reason: string
  description: string | null
  resolution_notes: string | null
  patient_id: string
  practitioner_id: string
  assigned_to: string | null
  created_at: string
  updated_at: string
  patient: { full_name: string; account_status: string } | null
  practitioner: { full_name: string } | null
  assignee: { full_name: string } | null
}

export interface DisputeEvent {
  id: string
  dispute_id: string
  type: string
  actor_role: string
  content: string
  created_at: string
  metadata: Record<string, unknown>
}

export const DISPUTE_STATUS_TO_KANBAN: Record<DisputeStatus, TicketStatus> = {
  open: 'a_faire', under_review: 'en_cours', resolved: 'valide', closed: 'deploye',
}
export const KANBAN_TO_DISPUTE_STATUS: Record<TicketStatus, DisputeStatus> = {
  a_faire: 'open', en_cours: 'under_review', en_test: 'under_review', corrige: 'under_review', valide: 'resolved', deploye: 'closed',
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
