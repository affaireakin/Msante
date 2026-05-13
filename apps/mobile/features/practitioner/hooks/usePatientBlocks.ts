import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/features/auth/store/authStore'

export interface PatientBlock {
  id: string
  patient_id: string
  cooldown_until: string | null
  reason: string | null
  created_at: string
  patient: { id: string; full_name: string } | null
}

export interface NoShowPatient {
  patient: { id: string; full_name: string; avatar_url: string | null }
  count: number
}

export function usePatientBlocks() {
  const { practitioner } = useAuthStore()
  const qc = useQueryClient()

  const noShowPatients = useQuery<NoShowPatient[]>({
    queryKey: ['no-show-patients', practitioner?.id],
    enabled: !!practitioner?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('appointments')
        .select('patient_id, users!appointments_patient_id_fkey(id, full_name, avatar_url)')
        .eq('practitioner_id', practitioner!.id)
        .eq('status', 'no_show')
      const counts: Record<string, NoShowPatient> = {}
      for (const row of data ?? []) {
        const pid = row.patient_id
        if (!counts[pid]) counts[pid] = { patient: row.users as any, count: 0 }
        counts[pid].count++
      }
      return Object.values(counts)
    },
  })

  const blocks = useQuery<PatientBlock[]>({
    queryKey: ['patient-blocks', practitioner?.id],
    enabled: !!practitioner?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('practitioner_patient_blocks')
        .select('*, patient:users!practitioner_patient_blocks_patient_id_fkey(id, full_name)')
        .eq('practitioner_id', practitioner!.id)
        .is('unblocked_at', null)
      return (data ?? []) as PatientBlock[]
    },
  })

  const blockPatient = useMutation({
    mutationFn: async ({
      patientId,
      cooldownDays,
      reason,
    }: {
      patientId: string
      cooldownDays: number | null
      reason?: string
    }) => {
      const cooldownUntil = cooldownDays
        ? new Date(Date.now() + cooldownDays * 86_400_000).toISOString().split('T')[0]
        : null
      await supabase.from('practitioner_patient_blocks').upsert({
        practitioner_id: practitioner!.id,
        patient_id: patientId,
        cooldown_until: cooldownUntil,
        reason: reason ?? null,
        unblocked_at: null,
      }, { onConflict: 'practitioner_id,patient_id' })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patient-blocks'] })
      qc.invalidateQueries({ queryKey: ['no-show-patients'] })
    },
  })

  const unblockPatient = useMutation({
    mutationFn: async (patientId: string) => {
      await supabase
        .from('practitioner_patient_blocks')
        .update({ unblocked_at: new Date().toISOString() })
        .eq('practitioner_id', practitioner!.id)
        .eq('patient_id', patientId)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patient-blocks'] }),
  })

  return { noShowPatients, blocks, blockPatient, unblockPatient }
}
