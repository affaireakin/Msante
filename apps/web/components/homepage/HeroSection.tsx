'use client'
import Link from 'next/link'
import { useHomepageContent, DEFAULT_HOMEPAGE_CONTENT } from '@/lib/useHomepageContent'
import HeroCarousel from './HeroCarousel'
import RichTextDisplay from '@/components/RichTextDisplay'

function Icon({ name, className = '', style }: { name: string; className?: string; style?: React.CSSProperties }) {
  return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>
}

export default function HeroSection() {
  const { data } = useHomepageContent()
  const c = (data ?? DEFAULT_HOMEPAGE_CONTENT).hero

  return (
    <section className="relative min-h-[90vh] flex items-center pt-10 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(130,216,255,0.15) 0%, transparent 70%)' }} />

      <div className="max-w-7xl mx-auto px-6 w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div className="z-10 space-y-8">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#82d8ff]/30 border border-[#82d8ff]/20 text-[#82d8ff] text-xs font-bold uppercase tracking-widest">
            {c.badge}
          </div>
          <h1 className="text-5xl lg:text-6xl font-black leading-[1.05] tracking-tight text-[#0b1c30]">
            {c.titleMain}{' '}
            <span className="text-[#82d8ff]">{c.titleHighlight}</span>
          </h1>
          <RichTextDisplay html={c.subtitle} className="text-lg text-[#6f787e] max-w-lg leading-relaxed" />
          <div className="flex flex-wrap gap-4 pt-2">
            <Link href="/auth/signup" className="px-8 py-4 bg-[#82d8ff] text-[#0b1c30] font-bold rounded-xl shadow-xl shadow-[#82d8ff]/20 hover:scale-105 active:scale-95 transition-all">
              {c.ctaPrimary}
            </Link>
            <Link href="#praticiens" className="px-8 py-4 font-semibold rounded-xl hover:bg-white/80 transition-all text-[#0b1c30]" style={{ background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.3)' }}>
              {c.ctaSecondary}
            </Link>
          </div>
        </div>

        <div className="relative group hidden lg:block">
          <div className="absolute -inset-4 bg-[#82d8ff]/10 blur-3xl rounded-full opacity-50 group-hover:opacity-70 transition-opacity" />
          {c.carouselImage1Url ? (
            <HeroCarousel image1={c.carouselImage1Url} image2={c.carouselImage2Url} />
          ) : (
            <div className="relative rounded-3xl overflow-hidden shadow-2xl aspect-square p-2" style={{ background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.3)' }}>
              <div className="w-full h-full rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #e5eeff 0%, #82d8ff 40%, #bee9ff 70%, #f8f9ff 100%)' }}>
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center space-y-4">
                    <div className="w-24 h-24 rounded-full bg-[#82d8ff] flex items-center justify-center mx-auto shadow-2xl">
                      <Icon name="medical_services" className="text-white" style={{ fontSize: '48px' }} />
                    </div>
                    <div className="bg-white/90 backdrop-blur-sm rounded-2xl px-5 py-4 shadow-lg">
                      <p className="text-xl font-black text-[#0b1c30]">Dr. Aminata Diallo</p>
                      <p className="text-sm text-[#6f787e] font-medium">Psychologue Clinicienne</p>
                      <div className="flex items-center justify-center gap-1 mt-2">
                        {[1, 2, 3, 4, 5].map(i => (
                          <Icon key={i} name="star" className="text-[#ffde5c]" style={{ fontSize: '16px' }} />
                        ))}
                        <span className="text-xs text-[#6f787e] ml-1">5.0</span>
                      </div>
                      <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#82d8ff] text-[#0b1c30] rounded-full text-xs font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80]" />
                        Disponible maintenant
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!c.carouselImage1Url && (
            <div className="absolute -bottom-6 -left-6 p-5 rounded-2xl shadow-xl max-w-[200px]" style={{ background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.3)' }}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-[#ffde5c] flex items-center justify-center text-[#705d00]">
                  <Icon name="auto_awesome" style={{ fontSize: '20px' }} />
                </div>
                <span className="font-bold text-2xl leading-none text-[#82d8ff]">{c.statBadgeValue}</span>
              </div>
              <p className="text-sm text-[#6f787e]">{c.statBadgeLabel}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
