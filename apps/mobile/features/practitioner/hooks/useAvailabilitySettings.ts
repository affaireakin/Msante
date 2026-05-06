import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'

export interface DaySlot {
  id?: string
  day_of_week: number
  start_time: string
  end_time: string
  is_active: boolean
}

export interface AvailabilityException {
  id: string
  label: string
  start_date: string
  end_date: string
}

const DAYS = [1, 2, 3, 4, 5, 6, 0]
const DEFAULT_SLOTS: DaySlot[] = DAYS.map((d) => ({
  day_of_week: d,
  start_time: '09:00',
  end_time: '17:00',
  is_active: d >= 1 && d <= 5,
}))

export function useAvailabilitySettings(practitionerId: string) {
  return useQuery({
    queryKey: ['availability-settings', practitionerId],
    queryFn: async () => {
      const [{ data: slots }, { data: exceptions }] = await Promise.all([
        supabase
          .from('availabilities')
          .select('id, day_of_week, start_time, end_time, is_active')
          .eq('practitioner_id', practitionerId)
          .order('day_of_week'),
        supabase
          .from('availability_exceptions')
          .select('id, label, start_date, end_date')
          .eq('practitioner_id', practitionerId)
          .order('start_date'),
      ])

      const merged: DaySlot[] = DEFAULT_SLOTS.map((def) => {
        const existing = slots?.find((s) => s.day_of_week === def.day_of_week)
        return existing
          ? {
              id: existing.id,
              day_of_week: existing.day_of_week,
              start_time: existing.start_time.slice(0, 5),
              end_time: existing.end_time.slice(0, 5),
              is_active: existing.is_active,
            }
          : def
      })

      return {
        slots: merged,
        exceptions: (exceptions ?? []) as AvailabilityException[],
      }
    },
    enabled: !!practitionerId,
    staleTime: 60_000,
  })
}

export function useSaveSchedule(practitionerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (slots: DaySlot[]) => {
      for (const slot of slots) {
        if (slot.id) {
          await supabase
            .from('availabilities')
            .update({
              start_time: slot.start_time,
              end_time: slot.end_time,
              is_active: slot.is_active,
            })
            .eq('id', slot.id)
        } else {
          await supabase.from('availabilities').insert({
            practitioner_id: practitionerId,
            day_of_week: slot.day_of_week,
            start_time: slot.start_time,
            end_time: slot.end_time,
            is_active: slot.is_active,
          })
        }
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['availability-settings', practitionerId] })
      void qc.invalidateQueries({ queryKey: ['availability', practitionerId] })
    },
  })
}

export function useAddException(practitionerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (exc: Omit<AvailabilityException, 'id'>) => {
      await supabase.from('availability_exceptions').insert({
        practitioner_id: practitionerId,
        ...exc,
      })
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['availability-settings', practitionerId] }),
  })
}

export function useDeleteException(practitionerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('availability_exceptions').delete().eq('id', id)
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['availability-settings', practitionerId] }),
  })
}
