import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/features/auth/store/authStore'

export type SessionType = 'video' | 'audio' | 'presentiel'

export interface PractitionerService {
  id: string
  name: string
  duration_min: number
  price: number | null
  session_types: SessionType[]
  is_active: boolean
}

export function usePractitionerServices() {
  const { practitioner } = useAuthStore()
  const qc = useQueryClient()

  const services = useQuery<PractitionerService[]>({
    queryKey: ['practitioner-services', practitioner?.id],
    enabled: !!practitioner?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('practitioner_services')
        .select('*')
        .eq('practitioner_id', practitioner!.id)
        .eq('is_active', true)
        .order('created_at')
      return (data ?? []) as PractitionerService[]
    },
  })

  const createService = useMutation({
    mutationFn: async (service: Omit<PractitionerService, 'id' | 'is_active'>) => {
      const { error } = await supabase.from('practitioner_services').insert({
        ...service,
        practitioner_id: practitioner!.id,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['practitioner-services'] }),
  })

  const updateService = useMutation({
    mutationFn: async ({ id, ...data }: Partial<PractitionerService> & { id: string }) => {
      const { error } = await supabase.from('practitioner_services').update(data).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['practitioner-services'] }),
  })

  const deleteService = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('practitioner_services')
        .update({ is_active: false })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['practitioner-services'] }),
  })

  return { services, createService, updateService, deleteService }
}
