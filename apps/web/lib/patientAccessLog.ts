import { supabase } from '@/lib/supabase'

// "Journal d'accès" (apps/web/app/patient/journal-acces/page.tsx) promises
// the patient that every access to their data by a practitioner is logged —
// but nothing ever wrote to patient_access_logs, so it was always empty.
// Best-effort, fire-and-forget: a logging failure must never block the
// practitioner's own page from rendering.
export function logPatientAccess(patientId: string, practitionerId: string, section: string) {
  void supabase.from('patient_access_logs').insert({
    patient_id: patientId,
    practitioner_id: practitionerId,
    accessed_section: section,
  })
}
