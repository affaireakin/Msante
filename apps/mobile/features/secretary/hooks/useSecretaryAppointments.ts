import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'

export interface SecretaryAppointment {
  id: string
  patientName: string
  patientInitials: string
  patientId: string
  practitionerName: string
  consultationType: string
  scheduledAt: string
  notes: string | null
  status: string
}

function initialsOf(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
}

// No practitioner_id filter here on purpose — RLS (secretary_read_appointments /
// org_permission_read_appointments) already scopes rows to whichever
// practitioner(s) this secretary is linked to, whether personal or org-wide.
export function useSecretaryAppointments(filter: 'today' | 'upcoming' | 'past') {
  return useQuery({
    queryKey: ['secretary-appointments', filter],
    staleTime: 15_000,
    queryFn: async () => {
      const now = new Date()
      let query = supabase
        .from('appointments')
        .select(`
          id, scheduled_at, status, notes, type, patient_id,
          users!appointments_patient_id_fkey(full_name),
          practitioner:practitioner_id(speciality, users!practitioners_user_id_fkey(full_name))
        `)
        .order('scheduled_at', { ascending: filter !== 'past' })

      if (filter === 'today') {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString()
        query = query.gte('scheduled_at', start).lte('scheduled_at', end).not('status', 'in', '("cancelled")')
      } else if (filter === 'upcoming') {
        query = query.gte('scheduled_at', now.toISOString()).not('status', 'in', '("cancelled","no_show","completed")')
      } else {
        query = query.lt('scheduled_at', now.toISOString()).limit(50)
      }

      const { data, error } = await query
      if (error) throw error

      return (data ?? []).map((a): SecretaryAppointment => {
        const patient = a.users as unknown as { full_name: string } | null
        const pract = a.practitioner as unknown as { users: { full_name: string } | null } | null
        const name = patient?.full_name ?? 'Patient'
        return {
          id: a.id,
          patientName: name,
          patientInitials: initialsOf(name),
          patientId: a.patient_id,
          practitionerName: pract?.users?.full_name ?? '',
          consultationType: a.type === 'video' ? 'Telehealth' : a.type === 'audio' ? 'Audio' : 'In-person',
          scheduledAt: a.scheduled_at,
          notes: a.notes,
          status: a.status,
        }
      })
    },
  })
}
