import type { User } from '@supabase/supabase-js'
import type { UserProfile, Practitioner, DocumentType } from './database'
import type { PatientOnboardingFormData, PractitionerStep1FormData } from '@/features/auth/schemas/authSchemas'

export interface AuthResult {
  user: User | null
  error: string | null
}

// Re-export Zod-inferred types as canonical types
export type PatientOnboardingData = PatientOnboardingFormData
export type PractitionerOnboardingStep1Data = PractitionerStep1FormData

export interface PractitionerOnboardingData extends PractitionerOnboardingStep1Data {
  documents: Array<{
    document_type: DocumentType
    uri: string
    name: string
  }>
  profilePhotoUri?: string
}

export type { User, UserProfile, Practitioner, DocumentType }
