export type UserRole = 'patient' | 'practitioner' | 'admin'
export type VerificationStatus = 'pending' | 'under_review' | 'approved' | 'rejected'
export type DocumentType = 'diploma' | 'license' | 'id_card' | 'other'

export interface UserProfile {
  id: string
  role: UserRole
  full_name: string
  phone: string | null
  country: string
  language: string
  date_of_birth: string | null
  onboarding_completed: boolean
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Practitioner {
  id: string
  user_id: string
  speciality: string
  bio: string | null
  languages: string[]
  session_price: number | null
  session_currency: string
  session_duration_min: number
  is_verified: boolean
  verification_status: VerificationStatus
  rating: number | null
  total_reviews: number
  timezone: string
  stamp_url: string | null
  signature_url: string | null
  created_at: string
}

export interface VerificationDocument {
  id: string
  practitioner_id: string
  document_type: DocumentType
  file_url: string
  status: 'pending' | 'approved' | 'rejected'
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}
