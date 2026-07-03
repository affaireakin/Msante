'use client'
import Link from 'next/link'

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span className="material-symbols-outlined" style={{ fontSize: '20px', ...style }}>{name}</span>
}

const SESSIONS = [
  {
    id: 'coherence',
    title: 'Cohérence cardiaque',
    desc: 'Inspirez 5s · Expirez 5s',
    duration: 300,
    color: '#82d8ff',
    bg: '#e5eeff',
    icon: 'favorite',
    tagline: 'Idéal pour démarrer la journée ou avant une consultation',
  },
  {
    id: 'box',
    title: 'Box Breathing',
    desc: '4-4-4-4 · Clarté mentale',
    duration: 480,
    color: '#1d7a3a',
    bg: '#e8f5e9',
    icon: 'crop_square',
    tagline: 'Technique utilisée par les forces spéciales pour gérer le stress',
  },
  {
    id: '478',
    title: 'Relaxation profonde',
    desc: '4-7-8 · Réduction du stress',
    duration: 1200,
    color: '#705d00',
    bg: '#fff8e1',
    icon: 'bedtime',
    tagline: 'Technique du Dr Weil pour calmer le système nerveux en profondeur',
  },
]

export default function MeditationCataloguePage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/patient/wellness" className="w-9 h-9 flex items-center justify-center rounded-full bg-white/70 border border-slate-200/50 text-[#6f787e] hover:bg-white transition-colors">
          <Icon name="arrow_back" />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-[#0b1c30]">Méditation guidée</h1>
          <p className="text-sm text-[#6f787e]">Respirez · Centrez-vous · Apaisez</p>
        </div>
      </div>

      {/* Intro */}
      <div className="rounded-2xl p-5 flex items-center gap-4" style={{ background: 'linear-gradient(135deg, rgba(0,102,133,0.06) 0%, rgba(130,216,255,0.10) 100%)', border: '1px solid rgba(130,216,255,0.30)' }}>
        <div className="w-12 h-12 rounded-2xl bg-[#e5eeff] flex items-center justify-center flex-shrink-0">
          <Icon name="self_improvement" style={{ fontSize: '28px', color: '#82d8ff' }} />
        </div>
        <div>
          <p className="text-sm font-semibold text-[#0b1c30]">3 techniques de respiration</p>
          <p className="text-xs text-[#6f787e] mt-0.5">Chaque technique a un effet distinct sur votre système nerveux. Choisissez selon votre besoin.</p>
        </div>
      </div>

      {/* Sessions */}
      <div className="space-y-4">
        {SESSIONS.map(s => (
          <Link
            key={s.id}
            href={`/patient/wellness/meditation/${s.id}`}
            className="block rounded-2xl p-6 hover:-translate-y-0.5 hover:shadow-lg transition-all"
            style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: s.bg }}>
                <Icon name={s.icon} style={{ fontSize: '28px', color: s.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-[#0b1c30]">{s.title}</p>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0" style={{ backgroundColor: s.bg, color: s.color }}>
                    {Math.round(s.duration / 60)} min
                  </span>
                </div>
                <p className="text-sm font-semibold mt-0.5" style={{ color: s.color }}>{s.desc}</p>
                <p className="text-xs text-[#6f787e] mt-1 leading-relaxed">{s.tagline}</p>
              </div>
              <Icon name="arrow_forward_ios" style={{ fontSize: '16px', color: '#bec8ce', flexShrink: 0 }} />
            </div>
          </Link>
        ))}
      </div>

      {/* Tip */}
      <div className="rounded-2xl p-4 flex items-start gap-3" style={{ backgroundColor: 'rgba(255,248,225,0.60)', border: '1px solid rgba(228,197,70,0.30)' }}>
        <Icon name="lightbulb" style={{ fontSize: '18px', color: '#705d00', flexShrink: 0, marginTop: '1px' }} />
        <p className="text-xs text-[#705d00] leading-relaxed">
          <span className="font-bold">Conseil :</span> Pratiquez dans un endroit calme, assis confortablement.
          Fermez les yeux et laissez l'animation guider votre respiration.
        </p>
      </div>
    </div>
  )
}
