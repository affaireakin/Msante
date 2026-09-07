import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'

// Retour terrain (2026-09-07) : un praticien ne modifie jamais sa
// profession/préfixe lui-même — il soumet une demande, un admin valide
// (cf. supabase/migrations/20260907000001_profession_change_requests.sql).

export interface ProfessionChangeRequest {
  id: string
  requested_speciality: string
  requested_prefix_id: string | null
  reason: string | null
  status: 'pending' | 'approved' | 'rejected'
  admin_note: string | null
  created_at: string
}

export interface PrefixOption {
  id: string
  prefix: string
  label: string
}

export function usePrefixOptions() {
  return useQuery<PrefixOption[]>({
    queryKey: ['prefix-options', 'practitioner'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('professional_prefixes')
        .select('id, prefix, label')
        .contains('allowed_roles', ['practitioner'])
        .eq('is_active', true)
        .order('sort_order')
      if (error) throw error
      return data ?? []
    },
    staleTime: 5 * 60_000,
  })
}

export function useLatestProfessionChangeRequest(practitionerId: string | undefined) {
  return useQuery<ProfessionChangeRequest | null>({
    queryKey: ['profession-change-request', practitionerId],
    enabled: !!practitionerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profession_change_requests')
        .select('id, requested_speciality, requested_prefix_id, reason, status, admin_note, created_at')
        .eq('practitioner_id', practitionerId!)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useSubmitProfessionChangeRequest(practitionerId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { current_speciality: string; requested_speciality: string; current_prefix_id: string | null; requested_prefix_id: string | null; reason: string }) => {
      if (!practitionerId) throw new Error('Praticien introuvable')
      const { error } = await supabase.from('profession_change_requests').insert({
        practitioner_id: practitionerId,
        ...input,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profession-change-request', practitionerId] }),
  })
}
