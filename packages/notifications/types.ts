// packages/notifications/types.ts

export type NotificationChannel = 'push' | 'email' | 'whatsapp' | 'sms'

export type NotificationEventType =
  | 'appointment_confirm'
  | 'appointment_reminder'
  | 'payment_success'
  | 'payment_failed'
  | 'consultation_starting'
  | 'practitioner_approved'
  | 'mood_low_streak'
  | 'mood_check_in'

export interface NotificationUser {
  id: string
  full_name: string
  email?: string | null
  push_token?: string | null
}

export interface NotificationEvent {
  type: NotificationEventType
  recipient: NotificationUser
  data: Record<string, string | number>
}

export interface NotificationAdapter {
  send(event: NotificationEvent): Promise<void>
}

export interface NotificationResult {
  channel: NotificationChannel
  status: 'sent' | 'failed'
  error?: string
}
