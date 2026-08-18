'use client'
import { useHomepageContent, DEFAULT_HOMEPAGE_CONTENT } from '@/lib/useHomepageContent'
import RichTextDisplay from '@/components/RichTextDisplay'

function Icon({ name, className = '', style }: { name: string; className?: string; style?: React.CSSProperties }) {
  return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>
}

const ITEM_ICONS = ['biotech', 'spa', 'hub']

export default function ValuePropositionSection() {
  const { data } = useHomepageContent()
  const c = (data ?? DEFAULT_HOMEPAGE_CONTENT).valueProposition

  return (
    <section className="py-24 bg-[#eff4ff] overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">

          <div className="relative order-2 lg:order-1">
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-[#82d8ff]/20 rounded-full blur-3xl" />
            <div className="relative rounded-[2.5rem] p-12 overflow-hidden" style={{ background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.3)' }}>
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <Icon name="vital_signs" style={{ fontSize: '72px', color: '#82d8ff' }} />
              </div>
              <h2 className="text-2xl font-bold text-[#0b1c30] mb-10">{c.heading}</h2>
              <div className="space-y-8">
                {c.items.map((item, i) => (
                  <div key={item.title} className="flex gap-6">
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[#82d8ff] text-[#0b1c30] flex items-center justify-center shadow-lg shadow-[#82d8ff]/20">
                      <Icon name={ITEM_ICONS[i]} />
                    </div>
                    <div>
                      <h4 className="font-bold text-[#0b1c30] mb-1">{item.title}</h4>
                      <RichTextDisplay html={item.desc} className="text-sm text-[#6f787e]" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="order-1 lg:order-2 space-y-6">
            <div className="aspect-video rounded-[2rem] overflow-hidden shadow-2xl relative" style={{ background: 'linear-gradient(135deg, #0b1c30 0%, #82d8ff 100%)' }}>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-20 h-20 rounded-full flex items-center justify-center border border-white/30 hover:scale-110 transition-transform cursor-pointer" style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}>
                  <Icon name="play_arrow" className="text-white" style={{ fontSize: '40px' }} />
                </div>
              </div>
              <div className="absolute bottom-4 left-4 right-4 p-4 rounded-xl flex items-center gap-4" style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.2)' }}>
                <div className="w-10 h-10 rounded-full bg-[#82d8ff] flex items-center justify-center text-[#0b1c30]">
                  <Icon name="play_circle" style={{ fontSize: '20px' }} />
                </div>
                <span className="font-bold text-sm text-white">{c.videoLabel}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-6 rounded-2xl bg-white shadow-sm border border-[#bec8ce]/20">
                <span className="block text-2xl font-black text-[#82d8ff] mb-1">{c.stat1Value}</span>
                <span className="text-sm text-[#6f787e]">{c.stat1Label}</span>
              </div>
              <div className="p-6 rounded-2xl bg-white shadow-sm border border-[#bec8ce]/20">
                <span className="block text-2xl font-black text-[#82d8ff] mb-1">{c.stat2Value}</span>
                <span className="text-sm text-[#6f787e]">{c.stat2Label}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
