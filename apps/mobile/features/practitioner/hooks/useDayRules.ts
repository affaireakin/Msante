import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/features/auth/store/authStore'

export const DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'] as const

export interface DayRule {
  id: string
  day_of_week: number
  allowed_types: string[]
}

export function useDayRules() {
  const { practitioner } = useAuthStore()
  const qc = useQueryClient()

  const dayRules = useQuery<DayRule[]>({
    queryKey: ['day-rules', practitioner?.id],
    enabled: !!practitioner?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('availability_day_rules')
        .select('id, day_of_week, allowed_types')
        .eq('practitioner_id', practitioner!.id)
      return (data ?? []) as DayRule[]
    },
  })

  const upsertDayRule = useMutation({
    mutationFn: async ({
      dayOfWeek,
      allowedTypes,
    }: {
      dayOfWeek: number
      allowedTypes: string[]
    }) => {
      const { error } = await supabase
        .from('availability_day_rules')
        .upsert(
          {
            practitioner_id: practitioner!.id,
            day_of_week: dayOfWeek,
            allowed_types: allowedTypes,
          },
          { onConflict: 'practitioner_id,day_of_week' }
        )
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['day-rules'] }),
  })

  return { dayRules, upsertDayRule, DAYS }
}
