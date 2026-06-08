import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/features/auth/store/authStore'

export interface HistoryEvent {
  id: string
  event_type: 'consultation' | 'prescription' | 'note_shared'
  date: string
  practitioner_name?: string
  practitioner_speciality?: string
  title: string
  summary?: string
  reference_id: string
}

interface ConsultationRow {
  id: string
  started_at: string | null
  appointments: {
    type: string
    notes: string | null
    patient_id: string
    practitioners: {
      speciality: string
      users: { full_name: string }
    } | null
  } | null
}

interface PrescriptionRow {
  id: string
  created_at: string
  diagnosis: string | null
  medications: unknown[]
  practitioners: {
    speciality: string
    users: { full_name: string }
  } | null
}

interface NoteRow {
  id: string
  created_at: string
  note_type: string
  title: string | null
  content: string
  practitioners: {
    speciality: string
    users: { full_name: string }
  } | null
}

export function useMedicalHistory() {
  const { profile } = useAuthStore()

  return useQuery<HistoryEvent[]>({
    queryKey: ['medical-history', profile?.id],
    enabled: !!profile?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const patientId = profile!.id

      // Ended consultations — join via appointments to filter by patient
      const { data: consultations } = await supabase
        .from('consultations')
        .select(`
          id, started_at,
          appointments!inner (
            type, notes, patient_id,
            practitioners (
              speciality,
              users ( full_name )
            )
          )
        `)
        .eq('appointments.patient_id', patientId)
        .eq('status', 'ended')
        .order('started_at', { ascending: false })
        .limit(50)

      // Prescriptions linked to patient
      const { data: prescriptions } = await supabase
        .from('prescriptions')
        .select(`
          id, created_at, diagnosis, medications,
          practitioners (
            speciality,
            users ( full_name )
          )
        `)
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(50)

      // Notes shared with patient
      const { data: notes } = await supabase
        .from('practitioner_notes')
        .select(`
          id, created_at, note_type, title, content,
          practitioners (
            speciality,
            users ( full_name )
          )
        `)
        .eq('patient_id', patientId)
        .eq('is_shared_with_patient', true)
        .order('created_at', { ascending: false })
        .limit(50)

      const consultationEvents: HistoryEvent[] = (consultations ?? []).map(
        (c: unknown) => {
          const row = c as ConsultationRow
          return {
            id: row.id,
            event_type: 'consultation' as const,
            date: row.started_at ?? new Date().toISOString(),
            practitioner_name: row.appointments?.practitioners?.users?.full_name,
            practitioner_speciality: row.appointments?.practitioners?.speciality,
            title: 'Consultation',
            summary:
              row.appointments?.type === 'video'
                ? 'Téléconsultation vidéo'
                : row.appointments?.type === 'audio'
                  ? 'Consultation audio'
                  : 'Consultation',
            reference_id: row.id,
          }
        }
      )

      const prescriptionEvents: HistoryEvent[] = (prescriptions ?? []).map(
        (p: unknown) => {
          const row = p as PrescriptionRow
          const medCount = Array.isArray(row.medications) ? row.medications.length : 0
          return {
            id: row.id,
            event_type: 'prescription' as const,
            date: row.created_at,
            practitioner_name: row.practitioners?.users?.full_name,
            practitioner_speciality: row.practitioners?.speciality,
            title: row.diagnosis ?? 'Ordonnance',
            summary: `${medCount} médicament${medCount > 1 ? 's' : ''}`,
            reference_id: row.id,
          }
        }
      )

      const noteEvents: HistoryEvent[] = (notes ?? []).map((n: unknown) => {
        const row = n as NoteRow
        return {
          id: row.id,
          event_type: 'note_shared' as const,
          date: row.created_at,
          practitioner_name: row.practitioners?.users?.full_name,
          practitioner_speciality: row.practitioners?.speciality,
          title: row.title ?? 'Note de consultation',
          summary:
            typeof row.content === 'string'
              ? row.content.slice(0, 100)
              : undefined,
          reference_id: row.id,
        }
      })

      const all = [
        ...consultationEvents,
        ...prescriptionEvents,
        ...noteEvents,
      ]

      return all.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )
    },
  })
}
