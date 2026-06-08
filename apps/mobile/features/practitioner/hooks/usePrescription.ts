import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { useAuth } from '@/features/auth/hooks/useAuth'

export interface MedicationLine {
  name: string
  dosage: string
  frequency: string
  duration: string
  instructions: string
}

export interface CreatePrescriptionInput {
  patientId: string
  appointmentId: string  // required — prescriptions must be linked to an appointment
  consultationId?: string
  medications: MedicationLine[]
  diagnosis: string
  instructions: string
  consultationType?: 'video' | 'audio' | 'presentiel' | 'standalone'
}

// Basic local medication list for autocomplete (no external API dependency)
export const COMMON_MEDICATIONS: string[] = [
  'Paracétamol', 'Ibuprofène', 'Amoxicilline', 'Azithromycine', 'Ciprofloxacine',
  'Metformine', 'Amlodipine', 'Losartan', 'Atorvastatine', 'Oméprazole',
  'Métronidazole', 'Cotrimoxazole', 'Artemether-Luméfantrine', 'Chloroquine',
  'Fer ferreux', 'Acide folique', 'Vitamine C', 'Zinc', 'Salbutamol', 'Prednisolone',
  'Diazépam', 'Haloperidol', 'Amitriptyline', 'Fluoxétine', 'Sertraline',
]

export function useCreatePrescription() {
  const { practitioner } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreatePrescriptionInput) => {
      const { data, error } = await supabase
        .from('prescriptions')
        .insert({
          practitioner_id: practitioner!.id,
          patient_id: input.patientId,
          appointment_id: input.appointmentId,
          consultation_id: input.consultationId ?? null,
          medications: input.medications,
          diagnosis: input.diagnosis,
          instructions: input.instructions,
          consultation_type: input.consultationType ?? 'standalone',
          status: 'draft',
        })
        .select('id')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['prescriptions', vars.patientId] })
    },
  })
}

// Fetch prescriptions for a patient (used by practitioner)
export function usePatientPrescriptions(patientId: string) {
  const { practitioner } = useAuth()
  return useQuery({
    queryKey: ['prescriptions', patientId],
    enabled: !!practitioner?.id && !!patientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prescriptions')
        .select('id, diagnosis, medications, status, created_at, consultation_type')
        .eq('patient_id', patientId)
        .eq('practitioner_id', practitioner!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}
