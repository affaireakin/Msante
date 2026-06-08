import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/features/auth/store/authStore'

export interface DataPermissions {
  id: string
  practitioner_id: string
  allow_medical_history: boolean
  allow_biological_analyses: boolean
  allow_prescriptions: boolean
  allow_consultation_reports: boolean
  allow_psychological_data: boolean
  allow_gynecological_data: boolean
  allow_shared_documents: boolean
  allow_appointment_history: boolean
  allow_mood_journal: boolean
}

type PermissionKey = keyof Omit<DataPermissions, 'id' | 'practitioner_id'>

export const PERMISSION_CONFIG: {
  key: PermissionKey
  label: string
  description: string
  group: 'medical' | 'mental' | 'documents'
  icon: string // MaterialIcons name
}[] = [
  {
    key: 'allow_medical_history',
    label: 'Historique médical',
    description: 'Antécédents et maladies chroniques',
    group: 'medical',
    icon: 'history',
  },
  {
    key: 'allow_biological_analyses',
    label: 'Analyses biologiques',
    description: 'Résultats de laboratoire et bilans',
    group: 'medical',
    icon: 'science',
  },
  {
    key: 'allow_prescriptions',
    label: 'Ordonnances',
    description: 'Médicaments prescrits et historique',
    group: 'medical',
    icon: 'medication',
  },
  {
    key: 'allow_consultation_reports',
    label: 'Comptes-rendus',
    description: 'Résumés des consultations passées',
    group: 'medical',
    icon: 'description',
  },
  {
    key: 'allow_appointment_history',
    label: 'Historique des consultations',
    description: 'Dates et types de consultations',
    group: 'medical',
    icon: 'event',
  },
  {
    key: 'allow_psychological_data',
    label: 'Données psychologiques',
    description: 'Notes et suivis thérapeutiques',
    group: 'mental',
    icon: 'psychology',
  },
  {
    key: 'allow_gynecological_data',
    label: 'Données gynécologiques',
    description: 'Suivi gynécologique et obstétrique',
    group: 'mental',
    icon: 'pregnant_woman',
  },
  {
    key: 'allow_mood_journal',
    label: 'Humeur & Journal',
    description: 'Scores mood et entrées de journal',
    group: 'mental',
    icon: 'mood',
  },
  {
    key: 'allow_shared_documents',
    label: 'Documents partagés',
    description: 'Fichiers et documents médicaux',
    group: 'documents',
    icon: 'folder-shared',
  },
]

export const GROUP_LABELS: Record<'medical' | 'mental' | 'documents', string> = {
  medical: 'Données médicales',
  mental: 'Santé mentale',
  documents: 'Documents',
}

export function useDataPermissions(practitionerId: string) {
  const { profile } = useAuthStore()
  return useQuery({
    queryKey: ['data-permissions', profile?.id, practitionerId],
    enabled: !!profile?.id && !!practitionerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patient_data_permissions')
        .select('*')
        .eq('patient_id', profile!.id)
        .eq('practitioner_id', practitionerId)
        .maybeSingle()
      if (error) throw error
      return data as DataPermissions | null
    },
  })
}

export function useUpdatePermissions(practitionerId: string) {
  const { profile } = useAuthStore()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (
      updates: Partial<Omit<DataPermissions, 'id' | 'practitioner_id'>>
    ) => {
      const { error } = await supabase
        .from('patient_data_permissions')
        .upsert(
          {
            patient_id: profile!.id,
            practitioner_id: practitionerId,
            ...updates,
          },
          { onConflict: 'patient_id,practitioner_id' }
        )
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ['data-permissions', profile?.id, practitionerId],
      })
    },
  })
}
