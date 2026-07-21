export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
export type SessionType = 'video' | 'audio' | 'presentiel' | 'suivi' | 'urgence'
export type PaymentProvider = 'wave' | 'orange_money' | 'card'
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded'

// QA finding: patient/appointments and secretary/index each hardcoded their own
// status color map with different shades for the same statuses, and the
// patient-side "completed" badge used near-identical light-blue text on a
// light-blue background (barely legible). Single shared source of truth.
export const APPOINTMENT_STATUS_STYLES: Record<AppointmentStatus, { label: string; bg: string; text: string }> = {
  pending:   { label: 'En attente', bg: '#fff8e1', text: '#705d00' },
  confirmed: { label: 'Confirmé',   bg: '#e8f5e9', text: '#1d7a3a' },
  cancelled: { label: 'Annulé',     bg: '#fce4ec', text: '#ba1a1a' },
  completed: { label: 'Terminé',    bg: '#e5eeff', text: '#005e7a' },
  no_show:   { label: 'Absent',     bg: '#f5f5f5', text: '#6f787e' },
}

export interface Availability {
  id: string
  practitioner_id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_active: boolean
}

export interface TimeSlot {
  date: string           // 'YYYY-MM-DD'
  start_time: string     // 'HH:MM'
  end_time: string       // 'HH:MM'
  available: boolean
}

export interface Appointment {
  id: string
  patient_id: string
  practitioner_id: string
  scheduled_at: string
  duration_min: number
  status: AppointmentStatus
  type: SessionType
  payment_id: string | null
  notes: string | null
  created_at: string
}

export interface Payment {
  id: string
  appointment_id: string | null
  patient_id: string
  practitioner_id: string
  amount: number
  currency: string
  provider: PaymentProvider
  provider_ref: string | null
  status: PaymentStatus
  retry_count: number
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface PractitionerFilter {
  speciality?: string
  language?: string
  maxPrice?: number
  hasAvailability?: boolean
  acceptingNewPatients?: boolean
}

export interface CreateAppointmentRequest {
  practitioner_id: string
  scheduled_at: string
  duration_min: number
  type: SessionType
}

export interface CreateAppointmentResponse {
  appointmentId: string
  amount: number
  currency: string
}

export interface ProcessPaymentRequest {
  appointment_id: string
  provider: PaymentProvider
  phone?: string
}

export interface ProcessPaymentResponse {
  paymentId: string
  status: PaymentStatus
  checkoutUrl?: string
  paydunya_token?: string
  mockCheckout?: boolean
}

export interface PractitionerService {
  id: string
  practitioner_id: string
  name: string
  type: SessionType
  duration_min: number
  price: number
  currency: string
  is_active: boolean
}
