import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { useAuth } from '@/features/auth/hooks/useAuth'

export type NoteType =
  | 'observation'
  | 'compte_rendu'
  | 'note_suivi'
  | 'bilan'
  | 'alerte'
  | 'prescription_note'

export interface PatientNote {
  id: string
  note_type: NoteType
  title: string | null
  content: string
  is_shared_with_patient: boolean
  tags: string[]
  created_at: string
}

interface CreateNoteInput {
  patientId: string
  appointmentId?: string
  noteType: NoteType
  title?: string
  content: string
  isSharedWithPatient: boolean
  tags: string[]
}

export function usePatientNotes(patientId: string) {
  const { practitioner } = useAuth()

  return useQuery<PatientNote[]>({
    queryKey: ['patient-notes', practitioner?.id, patientId],
    enabled: !!practitioner?.id && !!patientId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('practitioner_notes')
        .select('id, note_type, title, content, is_shared_with_patient, tags, created_at')
        .eq('practitioner_id', practitioner!.id)
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as PatientNote[]
    },
  })
}

export function useCreateNote() {
  const { practitioner } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateNoteInput) => {
      const { error } = await supabase.from('practitioner_notes').insert({
        practitioner_id: practitioner!.id,
        patient_id: input.patientId,
        appointment_id: input.appointmentId ?? null,
        consultation_id: null,
        note_type: input.noteType,
        title: input.title ?? null,
        content: input.content,
        is_shared_with_patient: input.isSharedWithPatient,
        shared_at: input.isSharedWithPatient ? new Date().toISOString() : null,
        tags: input.tags,
      })
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['patient-notes', practitioner?.id, variables.patientId],
      })
    },
  })
}
