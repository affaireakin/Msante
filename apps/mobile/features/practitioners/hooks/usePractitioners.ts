import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import type { PractitionerFilter } from '@/types/booking'
import type { Practitioner } from '@/types/database'

export interface PractitionerWithUser extends Practitioner {
  users: { full_name: string; avatar_url: string | null }
}

export function usePractitioners(filters: PractitionerFilter = {}) {
  return useQuery({
    queryKey: ['practitioners', filters],
    queryFn: async (): Promise<PractitionerWithUser[]> => {
      let query = supabase
        .from('practitioners')
        .select('*, users(full_name, avatar_url)')
        .eq('verification_status', 'approved')
        .eq('is_verified', true)

      if (filters.speciality) {
        query = query.ilike('speciality', `%${filters.speciality}%`)
      }
      if (filters.language) {
        query = query.contains('languages', [filters.language])
      }
      if (filters.maxPrice) {
        query = query.lte('session_price', filters.maxPrice)
      }
      if (filters.acceptingNewPatients) {
        query = query.eq('accepting_new_patients', true)
      }

      const { data, error } = await query.order('rating', { ascending: false })
      if (error) throw error
      return (data ?? []) as PractitionerWithUser[]
    },
    staleTime: 5 * 60 * 1000,
  })
}
