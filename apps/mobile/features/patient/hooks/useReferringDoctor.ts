import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/features/auth/store/authStore'

export interface GeneralPractitioner {
  id: string
  speciality: string
  session_price: number | null
  users: { full_name: string; avatar_url: string | null }
}

export function useReferringDoctor() {
  const { profile } = useAuthStore()
  const qc = useQueryClient()

  const generalPractitioners = useQuery<GeneralPractitioner[]>({
    queryKey: ['general-practitioners'],
    queryFn: async () => {
      const { data } = await supabase
        .from('practitioners')
        .select('id, speciality, session_price, users!practitioners_user_id_fkey!inner(full_name, avatar_url)')
        .ilike('speciality', '%generaliste%')
        .eq('is_verified', true)
        .eq('account_status', 'active')
      return (data ?? []) as unknown as GeneralPractitioner[]
    },
  })

  const setReferringDoctor = useMutation({
    mutationFn: async (practitionerId: string) => {
      const { error } = await supabase.from('users').update({
        referring_doctor_id: practitionerId,
        referring_doctor_status: 'pending',
      }).eq('id', profile!.id)
      if (error) throw error
      await supabase.functions.invoke('notify-referring-doctor', {
        body: { patient_id: profile!.id, practitioner_id: practitionerId },
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  })

  const removeReferringDoctor = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('users').update({
        referring_doctor_id: null,
        referring_doctor_status: 'none',
      }).eq('id', profile!.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  })

  return { generalPractitioners, setReferringDoctor, removeReferringDoctor }
}
