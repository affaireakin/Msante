export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
export type SessionType = 'video' | 'audio' | 'chat'
export type PaymentProvider = 'wave' | 'orange_money' | 'card' | 'simulated'
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded'

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
}
