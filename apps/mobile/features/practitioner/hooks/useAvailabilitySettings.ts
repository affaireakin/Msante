import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'

// Backed by the SAME tables the web practitioner availability screen uses
// (apps/web/app/practitioner/availability/page.tsx) — this used to target a
// legacy table set (`availabilities`, `availability_exceptions`,
// `practitioner_services`) that a migration silently broke (dropped
// `availabilities.day_of_week`) and that the booking engine never reads.
// Locations aren't managed here (mobile always writes location_id: null) —
// full location management stays a web-only flow for now, it doesn't block
// booking (generateSlots treats location as display metadata, not a filter).

export interface ConsultationType {
  id: string
  name: string
  duration_min: number
  price: number | null
  currency: string
  color: string
  description: string | null
  mode: 'presentiel' | 'video' | 'both'
  is_active: boolean
  sort_order: number
}

export type ConsultationTypeDraft = Omit<ConsultationType, 'id' | 'sort_order'>

export interface WeeklyBlock {
  id: string
  day_of_week: number
  start_time: string
  end_time: string
  consultation_type_ids: string[]
  is_active: boolean
}

export interface BlockedPeriod {
  id: string
  start_date: string
  end_date: string
  start_time: string | null
  end_time: string | null
  reason_type: string
  reason_label: string | null
}

const QUERY_KEY = (practitionerId: string) => ['availability-v2', practitionerId]

export function useAvailabilityV2(practitionerId: string) {
  return useQuery({
    queryKey: QUERY_KEY(practitionerId),
    queryFn: async () => {
      const [{ data: types, error: typesErr }, { data: weekly, error: weeklyErr }, { data: blocked, error: blockedErr }] = await Promise.all([
        supabase.from('consultation_types').select('*').eq('practitioner_id', practitionerId).order('sort_order'),
        supabase.from('weekly_availabilities').select('id, day_of_week, start_time, end_time, consultation_type_ids, is_active')
          .eq('practitioner_id', practitionerId).not('day_of_week', 'is', null).order('day_of_week').order('start_time'),
        supabase.from('blocked_periods').select('*').eq('practitioner_id', practitionerId)
          .gte('end_date', new Date().toISOString().split('T')[0]).order('start_date'),
      ])
      if (typesErr) throw typesErr
      if (weeklyErr) throw weeklyErr
      if (blockedErr) throw blockedErr

      return {
        types: (types ?? []) as ConsultationType[],
        weekly: (weekly ?? []) as WeeklyBlock[],
        blocked: (blocked ?? []) as BlockedPeriod[],
      }
    },
    enabled: !!practitionerId,
    staleTime: 30_000,
  })
}

function invalidate(qc: ReturnType<typeof useQueryClient>, practitionerId: string) {
  void qc.invalidateQueries({ queryKey: QUERY_KEY(practitionerId) })
  // Read by the patient-facing booking screen (useAvailability.ts) — must
  // refresh too, or a practitioner's change stays invisible to patients
  // until they happen to refetch some other way.
  void qc.invalidateQueries({ queryKey: ['availability', practitionerId] })
}

// ── Consultation types ("Mes prestations") ──────────────────────────────────

export function useCreateConsultationType(practitionerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (draft: ConsultationTypeDraft) => {
      const { data: existing } = await supabase.from('consultation_types').select('id').eq('practitioner_id', practitionerId)
      const { error } = await supabase.from('consultation_types').insert({ ...draft, practitioner_id: practitionerId, sort_order: existing?.length ?? 0 })
      if (error) throw error
    },
    onSuccess: () => invalidate(qc, practitionerId),
  })
}

export function useUpdateConsultationType(practitionerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<ConsultationTypeDraft> & { id: string }) => {
      const { error } = await supabase.from('consultation_types').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidate(qc, practitionerId),
  })
}

export function useDeleteConsultationType(practitionerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('consultation_types').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidate(qc, practitionerId),
  })
}

// ── Weekly planning ───────────────────────────────────────────────────────────

export function useAddWeeklyBlock(practitionerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (block: { day_of_week: number; start_time: string; end_time: string; consultation_type_ids: string[] }) => {
      const { error } = await supabase.from('weekly_availabilities').insert({
        practitioner_id: practitionerId,
        day_of_week: block.day_of_week,
        start_time: block.start_time,
        end_time: block.end_time,
        location_id: null,
        consultation_type_ids: block.consultation_type_ids,
      })
      if (error) throw error
    },
    onSuccess: () => invalidate(qc, practitionerId),
  })
}

export function useToggleWeeklyBlock(practitionerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('weekly_availabilities').update({ is_active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidate(qc, practitionerId),
  })
}

export function useDeleteWeeklyBlock(practitionerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('weekly_availabilities').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidate(qc, practitionerId),
  })
}

// ── Congés / indisponibilités ─────────────────────────────────────────────────

export function useAddBlockedPeriod(practitionerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (period: { start_date: string; end_date: string; reason_type: string; reason_label: string | null }) => {
      const { error } = await supabase.from('blocked_periods').insert({
        practitioner_id: practitionerId,
        start_date: period.start_date,
        end_date: period.end_date,
        start_time: null,
        end_time: null,
        reason_type: period.reason_type,
        reason_label: period.reason_label,
      })
      if (error) throw error
    },
    onSuccess: () => invalidate(qc, practitionerId),
  })
}

export function useDeleteBlockedPeriod(practitionerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('blocked_periods').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidate(qc, practitionerId),
  })
}

// Local-midnight parse (not UTC) so the displayed day always matches the
// stored 'YYYY-MM-DD' regardless of device timezone — same pattern as
// apps/web/lib/availabilitySlots.ts formatDate/formatDateLong.
export function formatDateFr(isoDate: string, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }): string {
  try {
    return new Date(`${isoDate}T00:00:00`).toLocaleDateString('fr-FR', opts)
  } catch {
    return isoDate
  }
}
