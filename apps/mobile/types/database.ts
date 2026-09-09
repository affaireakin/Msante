// 'organization_pending' : demandeur d'organisation, du dépôt du dossier
// jusqu'à sa validation (cf. 20260909000001). Il n'accorde aucun droit —
// il évite surtout que ces comptes soient enregistrés comme patients, ce
// qui leur donnait réellement les permissions patient et gonflait les
// indicateurs "Patients inscrits".
export type UserRole = 'patient' | 'practitioner' | 'admin' | 'organization_admin' | 'organization_member' | 'organization_pending' | 'secretary'
export type VerificationStatus = 'pending' | 'under_review' | 'approved' | 'rejected'
// Doit rester strictement aligné avec le CHECK constraint Postgres
// (verification_documents_document_type_check) — toute autre valeur
// fait échouer l'insert en base.
export type DocumentType =
  | 'diploma'
  | 'license'
  | 'id_card'
  | 'order_certificate'
  | 'professional_insurance'
  | 'other'

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
  accepting_new_patients: boolean
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
