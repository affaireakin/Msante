import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'

// Reads the SAME tables the web patient booking page uses
// (apps/web/app/patient/book/[id]/page.tsx + apps/web/lib/availabilitySlots.ts).
// Used to read `availabilities.day_of_week`, a column dropped from that table
// months ago (supabase/migrations/20260602000003_availability_date_based.sql)
// — every query against it failed, so patients always saw zero slots,
// regardless of what any practitioner configured (mobile or web).
//
// generateSlots() below is a deliberate duplicate of
// apps/web/lib/availabilitySlots.ts's function, not a shared import — Metro
// (React Native's bundler) isn't configured to resolve modules outside
// apps/mobile, matching how apps/web/lib/worldCountries.ts was duplicated
// into apps/mobile/constants/worldCountries.ts earlier this project. Keep
// both in sync if the slot-generation rules change.

export interface ConsultationType {
  id: string
  name: string
  duration_min: number
  price: number | null
  currency: string
  mode: 'presentiel' | 'video' | 'both'
}

interface WeeklyAvail {
  day_of_week: number | null
  specific_date: string | null
  start_time: string
  end_time: string
  consultation_type_ids: string[]
  is_active: boolean
}

interface BlockedPeriod { start_date: string; end_date: string }

export interface AvailabilitySlot {
  date: string        // YYYY-MM-DD
  start_time: string  // HH:MM
  end_time: string
  type: ConsultationType
  taken: boolean
}

function pad(n: number) { return String(n).padStart(2, '0') }

function generateSlots(
  weekly: WeeklyAvail[],
  types: ConsultationType[],
  blocked: BlockedPeriod[],
  taken: number[],
  daysAhead: number,
): AvailabilitySlot[] {
  const slots: AvailabilitySlot[] = []
  const now = new Date()
  const earliest = new Date(now.getTime() + 2 * 60 * 60 * 1000) // 2h min delay, matches web default
  const latest = new Date(now)
  latest.setUTCDate(latest.getUTCDate() + daysAhead)

  // UTC throughout — Dakar = UTC+0, matches apps/web/lib/availabilitySlots.ts.
  function utcDateStr(d: Date) {
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
  }

  const blockedDates = new Set<string>()
  for (const b of blocked) {
    const d = new Date(b.start_date + 'T00:00:00Z')
    const end = new Date(b.end_date + 'T00:00:00Z')
    while (d <= end) {
      blockedDates.add(utcDateStr(d))
      d.setUTCDate(d.getUTCDate() + 1)
    }
  }

  const cursor = new Date(earliest)
  cursor.setUTCHours(0, 0, 0, 0)
  while (cursor <= latest) {
    const dateStr = utcDateStr(cursor)
    const dow = cursor.getUTCDay()

    if (!blockedDates.has(dateStr)) {
      const daySlots = weekly.filter(w => w.is_active && (w.day_of_week === dow || w.specific_date === dateStr))
      for (const avail of daySlots) {
        const availTypes = types.filter(t => avail.consultation_type_ids.includes(t.id))
        for (const ctype of availTypes) {
          const [sh, sm] = avail.start_time.split(':').map(Number)
          const [eh, em] = avail.end_time.split(':').map(Number)
          let cur = sh * 60 + sm
          const endMin = eh * 60 + em

          while (cur + ctype.duration_min <= endMin) {
            const startStr = `${pad(Math.floor(cur / 60))}:${pad(cur % 60)}`
            const endMin2 = cur + ctype.duration_min
            const endStr = `${pad(Math.floor(endMin2 / 60))}:${pad(endMin2 % 60)}`
            const slotDt = new Date(`${dateStr}T${startStr}:00Z`)

            if (slotDt >= earliest) {
              // Bug remonté : un créneau déjà réservé restait sélectionnable et
              // n'échouait qu'au moment de payer ("Slot already taken"). La
              // détection comparait des CHAÎNES de dates (préfixe de 19
              // caractères de scheduled_at) — au moindre écart de format ou de
              // fuseau renvoyé par Postgres, plus aucune correspondance. On
              // compare désormais des instants réels.
              slots.push({ date: dateStr, start_time: startStr, end_time: endStr, type: ctype, taken: taken.includes(slotDt.getTime()) })
            }
            cur += ctype.duration_min
          }
        }
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return slots
}

export function useAvailability(practitionerId: string, daysAhead = 30) {
  return useQuery({
    queryKey: ['availability', practitionerId],
    queryFn: async () => {
      const [{ data: types, error: typesErr }, { data: weekly, error: weeklyErr }, { data: blocked, error: blockedErr }, { data: appointments, error: apptErr }] = await Promise.all([
        supabase.from('consultation_types').select('id, name, duration_min, price, currency, mode').eq('practitioner_id', practitionerId).eq('is_active', true).order('sort_order'),
        supabase.from('weekly_availabilities').select('day_of_week, specific_date, start_time, end_time, consultation_type_ids, is_active').eq('practitioner_id', practitionerId).eq('is_active', true),
        supabase.from('blocked_periods').select('start_date, end_date').eq('practitioner_id', practitionerId).gte('end_date', new Date().toISOString().split('T')[0]),
        supabase.from('appointments').select('scheduled_at').eq('practitioner_id', practitionerId).not('status', 'in', '("cancelled","no_show")').gte('scheduled_at', new Date().toISOString()),
      ])
      if (typesErr) throw typesErr
      if (weeklyErr) throw weeklyErr
      if (blockedErr) throw blockedErr
      if (apptErr) throw apptErr

      const taken = (appointments ?? []).map(a => new Date(a.scheduled_at as string).getTime())
      const consultationTypes = (types ?? []) as ConsultationType[]
      const slots = generateSlots((weekly ?? []) as WeeklyAvail[], consultationTypes, (blocked ?? []) as BlockedPeriod[], taken, daysAhead)

      return { types: consultationTypes, slots }
    },
    enabled: !!practitionerId,
    staleTime: 60_000,
  })
}
