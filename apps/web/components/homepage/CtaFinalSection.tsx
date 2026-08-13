'use client'
import Link from 'next/link'
import { useHomepageContent, DEFAULT_HOMEPAGE_CONTENT } from '@/lib/useHomepageContent'

export default function CtaFinalSection() {
  const { data } = useHomepageContent()
  const c = (data ?? DEFAULT_HOMEPAGE_CONTENT).ctaFinal

  return (
    <section className="py-24 px-6">
      <div className="max-w-5xl mx-auto rounded-[3rem] p-12 md:p-20 text-center relative overflow-hidden shadow-2xl bg-[#213145]">
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ background: 'radial-gradient(circle at 50% -20%, rgba(130,216,255,0.15), transparent 70%)' }} />
        <div className="relative z-10 space-y-8">
          <h2 className="text-3xl md:text-5xl font-black text-white leading-tight">
            {c.heading}
          </h2>
          <p className="text-white/70 max-w-xl mx-auto text-base">
            {c.subtitle}
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link href="/auth/signup" className="px-10 py-4 bg-[#82d8ff] text-[#0b1c30] font-bold rounded-2xl shadow-xl shadow-[#82d8ff]/30 hover:scale-105 active:scale-95 transition-all">
              {c.ctaPrimary}
            </Link>
            <Link href="/auth/login" className="px-10 py-4 font-bold rounded-2xl hover:bg-white/20 transition-all text-white border border-white/20" style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)' }}>
              {c.ctaSecondary}
            </Link>
          </div>
          <p className="text-white/40 text-sm">{c.disclaimer}</p>
        </div>
      </div>
    </section>
  )
}
