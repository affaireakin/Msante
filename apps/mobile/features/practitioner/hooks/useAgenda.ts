import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'

export interface AgendaAppointment {
  id: string
  patientName: string
  patientInitials: string
  patientId: string
  consultationType: string
  scheduledAt: string
  notes: string | null
  status: string
}

export function useAgenda(practitionerId: string) {
  return useQuery({
    queryKey: ['practitioner-agenda', practitionerId],
    queryFn: async () => {
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      const todayEnd = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
      ).toISOString()

      // "Demandes en attente" doit remonter toute requête future, pas
      // uniquement celles du jour même (sinon l'écran paraît vide dès qu'il
      // n'y a rien programmé aujourd'hui) ; seul "Confirmés aujourd'hui"
      // reste borné à la journée en cours.
      const { data, error } = await supabase
        .from('appointments')
        .select('id, scheduled_at, status, notes, type, patient_id, users!appointments_patient_id_fkey(full_name)')
        .eq('practitioner_id', practitionerId)
        .in('status', ['pending', 'confirmed'])
        .gte('scheduled_at', todayStart)
        .order('scheduled_at', { ascending: true })

      if (error) throw error

      const appointments: AgendaAppointment[] = (data ?? []).map((a) => {
        const patient = a.users as unknown as { full_name: string } | null
        const name = patient?.full_name ?? 'Patient'
        const initials = name
          .split(' ')
          .map((n: string) => n[0])
          .join('')
          .slice(0, 2)
          .toUpperCase()
        return {
          id: a.id,
          patientName: name,
          patientInitials: initials,
          patientId: a.patient_id,
          consultationType: a.type === 'video' ? 'Telehealth' : 'In-person',
          scheduledAt: a.scheduled_at,
          notes: a.notes,
          status: a.status,
        }
      })

      return {
        pending: appointments.filter((a) => a.status === 'pending'),
        confirmed: appointments.filter(
          (a) => a.status === 'confirmed' && a.scheduledAt >= todayStart && a.scheduledAt <= todayEnd,
        ),
      }
    },
    staleTime: 15_000,
    enabled: !!practitionerId,
  })
}
