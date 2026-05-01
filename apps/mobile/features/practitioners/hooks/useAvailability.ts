import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import type { TimeSlot } from '@/types/booking'

function generateSlots(
  availabilities: Array<{ day_of_week: number; start_time: string; end_time: string }>,
  takenSlots: string[],
  durationMin: number,
  daysAhead = 14
): TimeSlot[] {
  const slots: TimeSlot[] = []
  const today = new Date()

  for (let d = 0; d < daysAhead; d++) {
    const date = new Date(today)
    date.setDate(today.getDate() + d)
    const dayOfWeek = date.getDay()
    const dateStr = date.toISOString().split('T')[0]

    const dayAvail = availabilities.filter(a => a.day_of_week === dayOfWeek)

    for (const avail of dayAvail) {
      const [startH, startM] = avail.start_time.split(':').map(Number)
      const [endH, endM] = avail.end_time.split(':').map(Number)
      let currentMinutes = startH * 60 + startM
      const endMinutes = endH * 60 + endM

      while (currentMinutes + durationMin <= endMinutes) {
        const startHour = Math.floor(currentMinutes / 60).toString().padStart(2, '0')
        const startMin = (currentMinutes % 60).toString().padStart(2, '0')
        const endMins = currentMinutes + durationMin
        const endHour = Math.floor(endMins / 60).toString().padStart(2, '0')
        const endMinStr = (endMins % 60).toString().padStart(2, '0')

        const slotKey = `${dateStr}T${startHour}:${startMin}:00`
        slots.push({
          date: dateStr,
          start_time: `${startHour}:${startMin}`,
          end_time: `${endHour}:${endMinStr}`,
          available: !takenSlots.includes(slotKey),
        })

        currentMinutes += durationMin
      }
    }
  }

  return slots
}

export function useAvailability(practitionerId: string, durationMin = 60) {
  return useQuery({
    queryKey: ['availability', practitionerId, durationMin],
    queryFn: async (): Promise<TimeSlot[]> => {
      const [{ data: avails }, { data: appointments }] = await Promise.all([
        supabase
          .from('availabilities')
          .select('day_of_week, start_time, end_time')
          .eq('practitioner_id', practitionerId)
          .eq('is_active', true),
        supabase
          .from('appointments')
          .select('scheduled_at')
          .eq('practitioner_id', practitionerId)
          .not('status', 'in', '("cancelled","no_show")')
          .gte('scheduled_at', new Date().toISOString()),
      ])

      const takenSlots = (appointments ?? []).map(a =>
        a.scheduled_at.substring(0, 19)
      )

      return generateSlots(avails ?? [], takenSlots, durationMin)
    },
    enabled: !!practitionerId,
    staleTime: 2 * 60 * 1000,
  })
}
