import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'

// Fuseau de référence de la plateforme (cf. lib/availabilitySlots.ts côté web
// et l'affichage des RDV patient) — tout est interprété en heure du Sénégal.
const TZ = 'Africa/Dakar'

export type AppointmentType = 'video' | 'audio' | 'presentiel' | 'chat'

export interface AgendaPayment {
  amount: number | null
  currency: string | null
  provider: string | null
  status: string | null
}

export interface AgendaAppointment {
  id: string
  patientId: string
  patientName: string
  patientInitials: string
  scheduledAt: string
  durationMin: number
  type: AppointmentType
  status: string
  notes: string | null
  payment: AgendaPayment | null
}

/** Clé de jour (YYYY-MM-DD) dans le fuseau de la plateforme, pas celui du téléphone. */
export function dayKey(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  // en-CA donne directement le format YYYY-MM-DD
  return date.toLocaleDateString('en-CA', { timeZone: TZ })
}

export function startOfWeek(d: Date): Date {
  const date = new Date(d)
  const day = (date.getDay() + 6) % 7 // lundi = 0
  date.setDate(date.getDate() - day)
  date.setHours(0, 0, 0, 0)
  return date
}

export function weekDays(from: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(from)
    d.setDate(from.getDate() + i)
    return d
  })
}

interface AgendaData {
  /** RDV du jour sélectionné, triés par heure. */
  day: AgendaAppointment[]
  /** Nombre de RDV par jour sur la semaine affichée (pastilles du sélecteur). */
  countsByDay: Record<string, number>
  /** Demandes en attente, toutes dates futures confondues. */
  pending: AgendaAppointment[]
}

/**
 * Agenda praticien : une seule requête couvrant la semaine affichée + les
 * demandes en attente, découpée côté client. Fournit durée, type réel et
 * état de paiement — nécessaires à l'affichage type Doctolib de l'accueil.
 */
export function useAgenda(practitionerId: string, selectedDate: Date) {
  const weekStart = startOfWeek(selectedDate)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)

  return useQuery<AgendaData>({
    queryKey: ['practitioner-agenda', practitionerId, dayKey(weekStart)],
    enabled: !!practitionerId,
    staleTime: 15_000,
    queryFn: async () => {
      const now = new Date()
      const rangeStart = weekStart < now ? weekStart : now
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id, scheduled_at, duration_min, status, notes, type, patient_id,
          users!appointments_patient_id_fkey(full_name),
          payments(amount, currency, provider, status)
        `)
        .eq('practitioner_id', practitionerId)
        .in('status', ['pending', 'confirmed', 'completed', 'no_show'])
        .gte('scheduled_at', new Date(Math.min(rangeStart.getTime(), weekStart.getTime())).toISOString())
        .order('scheduled_at', { ascending: true })

      if (error) throw error

      const all: AgendaAppointment[] = (data ?? []).map((a) => {
        const patient = a.users as unknown as { full_name: string } | null
        const name = patient?.full_name ?? 'Patient'
        const pay = (a.payments as unknown as AgendaPayment[] | null)?.[0] ?? null
        return {
          id: a.id as string,
          patientId: a.patient_id as string,
          patientName: name,
          patientInitials: name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
          scheduledAt: a.scheduled_at as string,
          durationMin: (a.duration_min as number) ?? 30,
          type: ((a.type as AppointmentType) ?? 'video'),
          status: a.status as string,
          notes: (a.notes as string) ?? null,
          payment: pay,
        }
      })

      const selectedKey = dayKey(selectedDate)
      const countsByDay: Record<string, number> = {}
      for (const appt of all) {
        if (appt.status === 'no_show') continue
        const k = dayKey(appt.scheduledAt)
        countsByDay[k] = (countsByDay[k] ?? 0) + 1
      }

      return {
        day: all.filter(a => dayKey(a.scheduledAt) === selectedKey),
        countsByDay,
        pending: all.filter(a => a.status === 'pending' && new Date(a.scheduledAt) >= now),
      }
    },
  })
}
