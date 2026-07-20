import type { Metadata } from 'next'
import { supabase } from '@/lib/supabase'
import GenericContentClient from './GenericContentClient'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const { data } = await supabase.from('content_pages').select('title').eq('slug', slug).maybeSingle()
  return {
    title: data ? `${data.title} | M-Santé` : 'M-Santé',
    description: data ? `${data.title} — M-Santé, plateforme de santé mentale au Sénégal.` : undefined,
  }
}

export default async function GenericContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <GenericContentClient slug={slug} />
}
