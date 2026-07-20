import { supabase } from '@/lib/supabase'

/**
 * The 'documents' bucket (verification/organization documents) is private.
 * `file_url` historically stored the full getPublicUrl() string from when the
 * bucket was public; new uploads store the bare storage path. Both forms are
 * accepted here so existing rows keep working without a data migration.
 */
export async function getSignedDocumentUrl(fileUrlOrPath: string): Promise<string | null> {
  const marker = '/documents/'
  const idx = fileUrlOrPath.indexOf(marker)
  const path = idx === -1 ? fileUrlOrPath : fileUrlOrPath.slice(idx + marker.length)
  const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 300)
  if (error || !data) return null
  return data.signedUrl
}
