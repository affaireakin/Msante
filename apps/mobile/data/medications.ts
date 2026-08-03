// apps/mobile/data/medications.ts
// Recherche de médicaments via la BDPM (Base de Données Publique des
// Médicaments, ANSM) — remplace l'ancienne liste statique "pré-VIDAL".
import { supabase } from '@/services/supabase'

export interface BdpmMedication {
  cis_code: string
  denomination: string
  forme_pharmaceutique: string | null
}

export async function searchBdpmMedications(query: string): Promise<BdpmMedication[]> {
  if (query.trim().length < 2) return []
  const { data, error } = await supabase
    .from('bdpm_medications')
    .select('cis_code, denomination, forme_pharmaceutique')
    .ilike('denomination', `%${query.trim()}%`)
    .order('denomination')
    .limit(6)
  if (error) return []
  return (data ?? []) as BdpmMedication[]
}
