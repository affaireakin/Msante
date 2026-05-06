import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'

export interface PatientItem {
  patientId: string
  patientName: string
  patientInitials: string
  shortId: string
  lastConsultDate: string | null
  lastConsultNotes: string | null
  status: 'follow-up' | 'stable'
}

export function usePatients(practitionerId: string) {
  return useQuery({
    queryKey: ['practitioner-patients', practitionerId],
    queryFn: async (): Promise<PatientItem[]> => {
      const { data, error } = await supabase
        .from('appointments')
        .select(
          'patient_id, scheduled_at, notes, status, users!appointments_patient_id_fkey(id, full_name)',
        )
        .eq('practitioner_id', practitionerId)
        .in('status', ['completed', 'confirmed', 'cancelled'])
        .order('scheduled_at', { ascending: false })

      if (error) throw error

      const patientMap = new Map<string, PatientItem>()
      for (const appt of data ?? []) {
        const patient = appt.users as unknown as { id: string; full_name: string } | null
        if (!patient || patientMap.has(appt.patient_id)) continue
        const name = patient.full_name
        const initials = name
          .split(' ')
          .map((n: string) => n[0])
          .join('')
          .slice(0, 2)
          .toUpperCase()
        const shortId = appt.patient_id.replace(/-/g, '').slice(-4).toUpperCase()
        const daysSince = appt.scheduled_at
          ? Math.floor((Date.now() - new Date(appt.scheduled_at).getTime()) / 86_400_000)
          : 999
        patientMap.set(appt.patient_id, {
          patientId: appt.patient_id,
          patientName: name,
          patientInitials: initials,
          shortId: `MS-${shortId}`,
          lastConsultDate: appt.scheduled_at,
          lastConsultNotes: appt.notes,
          status: daysSince > 30 ? 'follow-up' : 'stable',
        })
      }

      return Array.from(patientMap.values())
    },
    staleTime: 30_000,
    enabled: !!practitionerId,
  })
}
