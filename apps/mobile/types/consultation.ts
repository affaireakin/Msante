export type ConsultationStatus = 'waiting' | 'active' | 'ended'

export interface ChatMessage {
  id: string
  role: 'patient' | 'practitioner'
  content: string
  timestamp: number
}

export interface Consultation {
  id: string
  appointmentId: string
  roomName: string | null
  roomUrl: string | null
  patientToken: string | null
  practitionerToken: string | null
  startedAt: string | null
  endedAt: string | null
  durationActualMin: number | null
  chatHistory: ChatMessage[]
  aiSummary: string | null
  prescriptionUrl: string | null
  status: ConsultationStatus
  createdAt: string
}

export interface CreateConsultationRoomResponse {
  consultationId: string
  roomUrl: string
  patientToken: string
}

export interface JoinConsultationResponse {
  practitionerToken: string
  roomUrl: string
  consultationId: string
}
