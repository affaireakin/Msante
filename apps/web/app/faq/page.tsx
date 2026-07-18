'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

interface FaqItem {
  id: string
  question: string
  answer: string
}

function useFaq() {
  return useQuery<FaqItem[]>({
    queryKey: ['public-faq'],
    queryFn: async () => {
      const { data, error } = await supabase.from('faq_items').select('id, question, answer').eq('is_published', true).order('sort_order')
      if (error) throw error
      return data ?? []
    },
  })
}

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span className="material-symbols-outlined" style={style}>{name}</span>
}

export default function FaqPage() {
  const { data = [], isLoading } = useFaq()
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <div className="min-h-screen bg-[#f8f9ff]">
      <header className="bg-white/70 backdrop-blur-xl border-b border-slate-200/50 px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#82d8ff] flex items-center justify-center shadow">
            <span className="material-symbols-outlined text-white" style={{ fontSize: '16px' }}>medical_services</span>
          </div>
          <span className="text-base font-black tracking-tighter text-[#0b1c30]">M-Santé</span>
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 space-y-6">
        <div>
          <h1 className="text-3xl font-black text-[#0b1c30] mb-2">Questions fréquentes</h1>
          <p className="text-sm text-[#6f787e]">Tout ce qu&apos;il faut savoir pour utiliser M-Santé</p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-16 rounded-2xl bg-white/40 animate-pulse" />)}
          </div>
        ) : data.length === 0 ? (
          <p className="text-sm text-[#6f787e]">Aucune question disponible pour le moment.</p>
        ) : (
          <div className="space-y-3">
            {data.map(item => {
              const isOpen = openId === item.id
              return (
                <div key={item.id} className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
                  <button onClick={() => setOpenId(isOpen ? null : item.id)}
                    className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left">
                    <span className="font-bold text-[#0b1c30] text-sm">{item.question}</span>
                    <Icon name={isOpen ? 'expand_less' : 'expand_more'} style={{ fontSize: '20px', color: '#82d8ff', flexShrink: 0 }} />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4">
                      <p className="text-sm text-[#3f484d] leading-relaxed">{item.answer}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="pt-6 border-t border-slate-200/50">
          <Link href="/auth/signup" className="px-6 py-2.5 bg-[#82d8ff] text-[#0b1c30] text-sm font-bold rounded-xl hover:shadow-lg hover:shadow-[#82d8ff]/20 transition-all inline-block">
            Créer mon compte
          </Link>
        </div>
      </main>
    </div>
  )
}
