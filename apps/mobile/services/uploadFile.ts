import { File } from 'expo-file-system'
import { supabase } from '@/services/supabase'

/**
 * Envoi d'un fichier local (photo prise, image de galerie, PDF choisi) vers
 * Supabase Storage.
 *
 * Bug remonté de façon répétée sur TOUS les points d'upload (documents
 * praticien, documents organisation, photo de profil, cachet, signature,
 * logo) : "Network request failed". Toutes ces implémentations partageaient
 * le même motif `await fetch(uri)` puis `.blob()`.
 *
 * Sur React Native, `fetch()` sur une URI locale + `.blob()` est notoirement
 * peu fiable : le Blob obtenu est un objet de compatibilité qui ne porte pas
 * toujours les données exploitables par la couche réseau, et l'échec remonte
 * sous la forme générique "Network request failed" — indiscernable d'une vraie
 * coupure réseau, ce qui a longtemps fait croire à un problème de connexion.
 *
 * `expo-file-system` lit le fichier nativement et renvoie un ArrayBuffer réel,
 * que supabase-js sait envoyer directement. C'est l'approche recommandée pour
 * Expo + Supabase Storage.
 */
export async function uploadLocalFile(
  bucket: string,
  path: string,
  uri: string,
  contentType: string,
  opts?: { upsert?: boolean },
): Promise<void> {
  const arrayBuffer = await new File(uri).arrayBuffer()
  const { error } = await supabase.storage.from(bucket).upload(path, arrayBuffer, {
    contentType,
    upsert: opts?.upsert ?? true,
  })
  if (error) throw error
}

/** Type MIME déduit de l'extension — les buckets ont une liste blanche stricte. */
export function mimeFromUri(uri: string, fallback = 'application/octet-stream'): string {
  const ext = uri.split('?')[0].split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'png': return 'image/png'
    case 'webp': return 'image/webp'
    case 'jpg':
    case 'jpeg': return 'image/jpeg'
    case 'pdf': return 'application/pdf'
    case 'm4a': return 'audio/m4a'
    case 'mp3': return 'audio/mpeg'
    default: return fallback
  }
}
