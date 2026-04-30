import type { User } from '@supabase/supabase-js'
import type { UserProfile, Practitioner, DocumentType } from './database'

export interface AuthResult {
  user: User | null
  error: string | null
}

export interface PatientOnboardingData {
  full_name: string
  phone: string
  country: string
  date_of_birth: string
  language: string
}

export interface PractitionerOnboardingData {
  speciality: string
  bio: string
  languages: string[]
  session_price: number
  session_currency: string
  session_duration_min: number
  documents: Array<{
    document_type: DocumentType
    uri: string
    name: string
  }>
}

export type { User, UserProfile, Practitioner }
