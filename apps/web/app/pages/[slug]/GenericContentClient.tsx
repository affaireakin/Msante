'use client'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import DOMPurify from 'dompurify'
import { supabase } from '@/lib/supabase'
import SiteLogo from '@/components/SiteLogo'

function useContentPage(slug: string) {
  return useQuery({
    queryKey: ['public-content-page', slug],
    queryFn: async () => {
      const { data, error } = await supabase.from('content_pages').select('title, body, updated_at').eq('slug', slug).maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export default function GenericContentClient({ slug }: { slug: string }) {
  const { data, isLoading, isFetched } = useContentPage(slug)

  if (isFetched && !data) notFound()

  return (
    <div className="min-h-screen bg-[#f8f9ff]">
      <header className="bg-white/70 backdrop-blur-xl border-b border-slate-200/50 px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
        <Link href="/" className="flex items-center gap-3">
          <SiteLogo size={32} />
          <span className="text-base font-black tracking-tighter text-[#0b1c30]">M-Santé</span>
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 space-y-6">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-2xl bg-white/40 animate-pulse" />)}
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-black text-[#0b1c30]">{data?.title}</h1>
            <div
              className="space-y-4 text-sm text-[#3f484d] leading-relaxed [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-[#0b1c30] [&_h2]:mt-8 [&_h2]:mb-2 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-[#0b1c30] [&_h3]:mt-6 [&_h3]:mb-2 [&_ul]:list-disc [&_ul]:list-inside [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:list-inside [&_ol]:space-y-1 [&_strong]:text-[#0b1c30] [&_a]:text-[#82d8ff] [&_a]:underline [&_a]:font-semibold"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(data?.body ?? '', { ADD_ATTR: ['target', 'rel'] }) }}
            />
          </>
        )}

        <div className="pt-6 border-t border-slate-200/50">
          <Link href="/" className="text-sm text-[#82d8ff] font-semibold hover:underline">
            ← Retour à l&apos;accueil
          </Link>
        </div>
      </main>
    </div>
  )
}
