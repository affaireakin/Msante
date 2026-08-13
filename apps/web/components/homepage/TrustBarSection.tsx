'use client'
import { useHomepageContent, DEFAULT_HOMEPAGE_CONTENT } from '@/lib/useHomepageContent'

function Icon({ name, className = '', style }: { name: string; className?: string; style?: React.CSSProperties }) {
  return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>
}

const PARTNER_ICONS = ['waves', 'cell_tower', 'shield']

export default function TrustBarSection() {
  const { data } = useHomepageContent()
  const c = (data ?? DEFAULT_HOMEPAGE_CONTENT).trustBar

  return (
    <section className="py-12 bg-[#eff4ff] border-y border-[#bec8ce]/30">
      <div className="max-w-7xl mx-auto px-6">
        <p className="text-center text-xs font-bold text-[#6f787e] mb-8 uppercase tracking-widest opacity-60">{c.label}</p>
        <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24 grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all duration-500">
          {c.partners.map((p, i) => (
            <div key={p.label} className="flex items-center gap-2">
              <Icon name={PARTNER_ICONS[i]} className="text-[#82d8ff]" />
              <span className="font-bold text-[#0b1c30]/50">{p.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
