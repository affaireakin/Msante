import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import type { PractitionerWithUser } from './usePractitioners'

export function usePractitioner(id: string) {
  return useQuery({
    queryKey: ['practitioner', id],
    queryFn: async (): Promise<PractitionerWithUser | null> => {
      const { data, error } = await supabase
        .from('practitioners')
        .select('*, users(full_name, avatar_url), organizations(name, logo_url)')
        .eq('id', id)
        .single()
      if (error) return null
      return data as PractitionerWithUser
    },
    enabled: !!id,
  })
}
