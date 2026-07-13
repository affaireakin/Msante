// Shared slot-generation logic between the patient booking page
// (patient/book/[id]) and the practitioner-initiated booking page
// (practitioner/patients/[patientId]/book) — both need to turn a
// practitioner's weekly + one-off availability into bookable time slots
// using the exact same rules (buffers, blocked periods, booking window).

export interface ConsultationType {
  id: string; name: string; duration_min: number
  price: number | null; currency: string; color: string
  description: string | null; mode: 'presentiel' | 'video' | 'both'
}
export interface WeeklyAvail {
  day_of_week: number | null; specific_date: string | null
  start_time: string; end_time: string
  consultation_type_ids: string[]; is_active: boolean
  location?: { name: string; address: string | null; city: string | null; is_teleconsult: boolean } | null
}
export interface BlockedPeriod { start_date: string; end_date: string; start_time: string | null; end_time: string | null }
export interface BookingSettings { min_booking_delay_h: number; max_booking_days_ahead: number; buffer_between_min: number; auto_confirm: boolean }

export interface TimeSlot {
  date: string          // YYYY-MM-DD
  start_time: string   // HH:MM
  end_time: string
  type: ConsultationType
  location: WeeklyAvail['location']
  taken: boolean
}

function pad(n: number) { return String(n).padStart(2, '0') }

export function generateSlots(
  weekly: WeeklyAvail[],
  types: ConsultationType[],
  blocked: BlockedPeriod[],
  taken: string[],
  settings: BookingSettings,
): TimeSlot[] {
  const slots: TimeSlot[] = []
  const now = new Date()
  const minDelay = settings.min_booking_delay_h * 60 * 60 * 1000
  const earliest = new Date(now.getTime() + minDelay)
  const latest = new Date(now)
  latest.setUTCDate(latest.getUTCDate() + settings.max_booking_days_ahead)

  // Use UTC dates — slot times are stored in Dakar/UTC+0, so UTC is the canonical reference.
  // Local-time methods would cause France (UTC+2) browsers to skip today or mismap day-of-week.
  function utcDateStr(d: Date) {
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
  }

  // Build blocked set (UTC dates)
  const blockedDates = new Set<string>()
  for (const b of blocked) {
    const d = new Date(b.start_date + 'T00:00:00Z')
    const end = new Date(b.end_date + 'T00:00:00Z')
    while (d <= end) {
      blockedDates.add(utcDateStr(d))
      d.setUTCDate(d.getUTCDate() + 1)
    }
  }

  // Walk each day in window (UTC — keeps day-of-week consistent with Dakar timezone)
  const cursor = new Date(earliest)
  cursor.setUTCHours(0, 0, 0, 0)
  while (cursor <= latest) {
    const dateStr = utcDateStr(cursor)
    const dow = cursor.getUTCDay()

    if (!blockedDates.has(dateStr)) {
      const daySlots = weekly.filter(w => w.is_active && (w.day_of_week === dow || w.specific_date === dateStr))
      for (const avail of daySlots) {
        const availTypes = types.filter(t => avail.consultation_type_ids.includes(t.id))
        if (availTypes.length === 0) continue

        for (const ctype of availTypes) {
          const [sh, sm] = avail.start_time.split(':').map(Number)
          const [eh, em] = avail.end_time.split(':').map(Number)
          let cur = sh * 60 + sm
          const endMin = eh * 60 + em
          const dur = ctype.duration_min + settings.buffer_between_min

          while (cur + ctype.duration_min <= endMin) {
            const startStr = `${pad(Math.floor(cur / 60))}:${pad(cur % 60)}`
            const endMin2 = cur + ctype.duration_min
            const endStr = `${pad(Math.floor(endMin2 / 60))}:${pad(endMin2 % 60)}`
            // Parse slot as UTC (Dakar = UTC+0), compare against UTC earliest
            const slotDt = new Date(`${dateStr}T${startStr}:00Z`)
            const takenKey = `${dateStr}T${startStr}:00`

            if (slotDt >= earliest) {
              slots.push({ date: dateStr, start_time: startStr, end_time: endStr, type: ctype, location: avail.location ?? null, taken: taken.includes(takenKey) })
            }
            cur += dur
          }
        }
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return slots
}

export function groupByDate(slots: TimeSlot[]) {
  const map = new Map<string, TimeSlot[]>()
  for (const s of slots) {
    if (!map.has(s.date)) map.set(s.date, [])
    map.get(s.date)!.push(s)
  }
  return map
}

export function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function formatDateLong(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
