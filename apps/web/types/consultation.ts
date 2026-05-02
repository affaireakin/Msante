export type ConsultationStatus = 'waiting' | 'active' | 'ended'

export interface ChatMessage {
  id: string
  role: 'patient' | 'practitioner'
  content: string
  timestamp: number
}

export interface Consultation {
  id: string
  appointment_id: string
  room_url: string | null
  practitioner_token: string | null
  started_at: string | null
  ended_at: string | null
  duration_actual_min: number | null
  chat_history: ChatMessage[]
  ai_summary: string | null
  prescription_url: string | null
  status: ConsultationStatus
}
