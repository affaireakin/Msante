'use client'
import Link from 'next/link'
import { useHomepageContent, DEFAULT_HOMEPAGE_CONTENT } from '@/lib/useHomepageContent'

function Icon({ name, className = '', style }: { name: string; className?: string; style?: React.CSSProperties }) {
  return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>
}

// Icônes/couleurs/dégradés restent fixes (non éditables) — seuls le titre et
// la description de chaque carte viennent de la base (voir useHomepageContent).
const CARD_STYLE = [
  { icon: 'psychology', iconBg: '#82d8ff', iconColor: '#006685', gradient: 'from-[#e5eeff] to-[#bee9ff]' },
  { icon: 'verified_user', iconBg: '#ffde5c', iconColor: '#705d00', gradient: 'from-[#fff8e1] to-[#ffde5c]/30' },
  { icon: 'video_chat', iconBg: '#82d8ff', iconColor: '#006685', gradient: 'from-[#e5eeff] to-[#82d8ff]/20' },
  { icon: 'location_on', iconBg: '#fce4ec', iconColor: '#c2185b', gradient: 'from-[#fce4ec] to-[#f8bbd0]/30' },
]

export default function FeaturesSection() {
  const { data } = useHomepageContent()
  const features = (data ?? DEFAULT_HOMEPAGE_CONTENT).features

  return (
    <section id="features" className="py-24 max-w-7xl mx-auto px-6">
      <div className="text-center mb-16 space-y-4">
        <h2 className="text-4xl md:text-[40px] font-black text-[#0b1c30]">Des solutions pensées pour vous</h2>
        <p className="text-[#6f787e] max-w-2xl mx-auto">
          Allier la technologie de pointe à la chaleur humaine pour transformer votre expérience de santé.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {features.map((card, i) => {
          const style = CARD_STYLE[i]
          return (
            <Link
              key={card.title}
              href="/auth/signup"
              className="group rounded-[2rem] hover:shadow-2xl hover:-translate-y-2 transition-all py-12 px-8 text-center flex flex-col items-center"
              style={{ background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.3)' }}
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-8 group-hover:rotate-6 transition-transform"
                style={{ backgroundColor: style.iconBg }}
              >
                <Icon name={style.icon} style={{ fontSize: '36px', color: style.iconColor }} />
              </div>
              <h3 className="text-xl font-bold text-[#0b1c30] mb-4">{card.title}</h3>
              <p className="text-[#6f787e] text-sm leading-relaxed mb-6">{card.desc}</p>
              <div className={`w-full h-36 rounded-xl bg-gradient-to-br ${style.gradient} flex items-center justify-center`}>
                <Icon name={style.icon} className="opacity-20" style={{ fontSize: '72px', color: style.iconColor }} />
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
