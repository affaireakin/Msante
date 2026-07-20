import type { Metadata } from 'next'
import { supabase } from '@/lib/supabase'
import CguClient from './CguClient'

export async function generateMetadata(): Promise<Metadata> {
  const { data } = await supabase.from('content_pages').select('title').eq('slug', 'cgu').maybeSingle()
  return {
    title: `${data?.title ?? 'Conditions Générales d\'Utilisation'} | M-Santé`,
    description: 'Conditions générales d\'utilisation de la plateforme M-Santé.',
  }
}

export default function CGUPage() {
  return <CguClient />
}
