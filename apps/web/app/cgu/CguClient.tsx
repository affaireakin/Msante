'use client'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import DOMPurify from 'dompurify'
import { supabase } from '@/lib/supabase'

function useCguContent() {
  return useQuery({
    queryKey: ['public-content-page', 'cgu'],
    queryFn: async () => {
      const { data, error } = await supabase.from('content_pages').select('title, body, updated_at').eq('slug', 'cgu').single()
      if (error) throw error
      return data
    },
  })
}

export default function CguClient() {
  const { data, isLoading } = useCguContent()

  return (
    <div className="min-h-screen bg-[#f8f9ff]">
      <header className="bg-white/70 backdrop-blur-xl border-b border-slate-200/50 px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#82d8ff] flex items-center justify-center shadow">
            <span className="material-symbols-outlined text-white" style={{ fontSize: '16px' }}>medical_services</span>
          </div>
          <span className="text-base font-black tracking-tighter text-[#0b1c30]">M-Santé</span>
        </Link>
        {data && (
          <span className="text-xs text-[#6f787e] font-semibold ml-auto">
            Dernière mise à jour : {new Date(data.updated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        )}
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 space-y-10">
        <div>
          <h1 className="text-3xl font-black text-[#0b1c30] mb-2">{data?.title ?? 'Conditions Générales d’Utilisation'}</h1>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-2xl bg-white/40 animate-pulse" />)}
          </div>
        ) : (
          <div
            className="space-y-5 text-sm text-[#3f484d] leading-relaxed [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-[#0b1c30] [&_h2]:mt-8 [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:list-inside [&_ul]:space-y-1 [&_strong]:text-[#0b1c30]"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(data?.body ?? '') }}
          />
        )}

        <div className="pt-6 border-t border-slate-200/50 flex items-center gap-4">
          <Link
            href="/auth/signup"
            className="px-6 py-2.5 bg-[#82d8ff] text-[#0b1c30] text-sm font-bold rounded-xl hover:shadow-lg hover:shadow-[#82d8ff]/20 transition-all"
          >
            Créer mon compte
          </Link>
          <Link href="/auth/login" className="text-sm text-[#82d8ff] font-semibold hover:underline">
            Se connecter
          </Link>
        </div>
      </main>
    </div>
  )
}
