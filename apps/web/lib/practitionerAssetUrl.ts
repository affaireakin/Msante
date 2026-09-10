import { supabase } from '@/lib/supabase'

const BUCKET = 'practitioner-assets'

/**
 * Le cachet et la signature d'un praticien sont des artefacts juridiques :
 * ils vivent dans un bucket privé, et leur valeur en base est un chemin nu.
 *
 * Deux formes héritées coexistent et doivent continuer de fonctionner sans
 * migration de données :
 *  - une URL publique du bucket `avatars` (ce que le web écrivait avant —
 *    elle fonctionne telle quelle, on la renvoie inchangée) ;
 *  - une URL "publique" de `practitioner-assets` (ce que le mobile écrivait —
 *    elle n'a jamais fonctionné, on en extrait le chemin pour la signer).
 */
export async function getSignedPractitionerAssetUrl(value: string | null): Promise<string | null> {
  if (!value) return null

  const marker = `/${BUCKET}/`
  const idx = value.indexOf(marker)
  if (idx === -1 && /^https?:\/\//i.test(value)) return value

  const path = idx === -1 ? value : value.slice(idx + marker.length)
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
  if (error || !data) return null
  return data.signedUrl
}
