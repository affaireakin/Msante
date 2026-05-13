'use client'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span className="material-symbols-outlined" style={{ fontSize: '20px', ...style }}>{name}</span>
}

const MOOD_CONFIG: Record<number, { label: string; color: string; bg: string }> = {
  1:  { label: 'Très bas',  color: '#ba1a1a', bg: '#ffdad6' },
  2:  { label: 'Bas',       color: '#ba1a1a', bg: '#ffdad6' },
  3:  { label: 'Faible',    color: '#c05000', bg: '#ffe5d0' },
  4:  { label: 'Moyen',     color: '#705d00', bg: '#fff8e1' },
  5:  { label: 'Correct',   color: '#705d00', bg: '#fff8e1' },
  6:  { label: 'Bien',      color: '#006685', bg: '#e5eeff' },
  7:  { label: 'Bien',      color: '#006685', bg: '#e5eeff' },
  8:  { label: 'Très bien', color: '#1d7a3a', bg: '#e8f5e9' },
  9:  { label: 'Excellent', color: '#1d7a3a', bg: '#e8f5e9' },
  10: { label: 'Parfait',   color: '#1d7a3a', bg: '#e8f5e9' },
}

interface MoodEntry {
  id: string
  score: number
  emotions: string[]
  note: string | null
  entry_date: string
}

function useMoodHistory() {
  return useQuery<MoodEntry[]>({
    queryKey: ['mood-history'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')
      const { data, error } = await supabase
        .from('mood_entries')
        .select('id, score, emotions, note, entry_date')
        .eq('patient_id', user.id)
        .order('entry_date', { ascending: false })
        .limit(30)
      if (error) throw error
      return (data ?? []) as MoodEntry[]
    },
  })
}

export default function MoodHistoryPage() {
  const { data: entries = [], isLoading } = useMoodHistory()

  const avgScore = entries.length
    ? Math.round(entries.reduce((s, e) => s + e.score, 0) / entries.length)
    : null

  // Build last 30 days grid
  const today = new Date()
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - 29 + i)
    const dateStr = d.toISOString().split('T')[0]
    const entry = entries.find(e => e.entry_date === dateStr)
    return { date: d, dateStr, entry }
  })

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/patient/wellness" className="w-9 h-9 flex items-center justify-center rounded-full bg-white/70 border border-slate-200/50 text-[#6f787e] hover:bg-white transition-colors">
          <Icon name="arrow_back" />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-[#0b1c30]">Historique humeur</h1>
          <p className="text-sm text-[#6f787e]">30 derniers jours</p>
        </div>
        <Link href="/patient/wellness/mood" className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white bg-[#006685] hover:shadow-lg transition-all">
          <Icon name="add" style={{ color: '#fff', fontSize: '18px' }} />
          Check-in
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: 'Humeur moyenne',
            value: avgScore ? `${avgScore}/10` : '—',
            color: avgScore ? MOOD_CONFIG[avgScore]?.color : '#6f787e',
            bg: avgScore ? MOOD_CONFIG[avgScore]?.bg : '#f1f5f9',
            icon: 'trending_up',
          },
          {
            label: 'Entrées ce mois',
            value: entries.length,
            color: '#006685',
            bg: '#e5eeff',
            icon: 'calendar_month',
          },
          {
            label: 'Jours trackés',
            value: `${Math.round((entries.length / 30) * 100)}%`,
            color: '#1d7a3a',
            bg: '#e8f5e9',
            icon: 'bar_chart',
          },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-5 flex items-center gap-3" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: s.bg }}>
              <Icon name={s.icon} style={{ color: s.color, fontSize: '20px' }} />
            </div>
            <div>
              <p className="text-xl font-black" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs text-[#6f787e]">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Bar chart — 30 jours */}
      <div className="rounded-2xl p-6" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
        <p className="text-sm font-bold text-[#0b1c30] mb-4">Évolution sur 30 jours</p>
        {isLoading ? (
          <div className="h-24 bg-[#f1f5f9] animate-pulse rounded-xl" />
        ) : (
          <div className="flex items-end gap-1 h-28">
            {days.map(({ date, dateStr, entry }, i) => {
              const isToday = dateStr === today.toISOString().split('T')[0]
              const cfg = entry ? MOOD_CONFIG[entry.score] : null
              const barH = entry ? `${(entry.score / 10) * 100}%` : '4px'
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div
                    className="w-full rounded-t-sm transition-all"
                    style={{
                      height: barH,
                      minHeight: '4px',
                      backgroundColor: cfg ? cfg.color : '#e2e8f0',
                      opacity: isToday ? 1 : 0.75,
                    }}
                  />
                  {/* Tooltip */}
                  {entry && (
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#0b1c30] text-white text-xs rounded-lg px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      {date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · {entry.score}/10
                    </div>
                  )}
                  {i % 7 === 0 && (
                    <span className="text-[9px] text-[#6f787e]">
                      {date.toLocaleDateString('fr-FR', { day: 'numeric' })}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Liste des entrées */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-[#0b1c30]">Toutes les entrées</h2>
        {isLoading ? (
          [1, 2, 3].map(i => <div key={i} className="h-16 rounded-2xl bg-white/40 animate-pulse" />)
        ) : entries.length === 0 ? (
          <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.60)', border: '1px solid rgba(255,255,255,0.80)' }}>
            <Icon name="mood" style={{ fontSize: '48px', color: '#bec8ce' }} />
            <p className="font-semibold text-[#0b1c30] mt-3">Aucune entrée</p>
            <Link href="/patient/wellness/mood" className="mt-4 inline-block px-5 py-2 bg-[#006685] text-white text-sm font-bold rounded-xl">
              Premier check-in
            </Link>
          </div>
        ) : (
          entries.map(entry => {
            const cfg = MOOD_CONFIG[entry.score]
            return (
              <div
                key={entry.id}
                className="rounded-2xl p-4 flex items-center gap-4"
                style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}
              >
                <div className="w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0" style={{ backgroundColor: cfg.bg }}>
                  <p className="text-lg font-black leading-none" style={{ color: cfg.color }}>{entry.score}</p>
                  <p className="text-[9px] font-semibold" style={{ color: cfg.color }}>/10</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#0b1c30]">
                    {new Date(entry.entry_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(entry.emotions ?? []).slice(0, 3).map((em: string) => (
                      <span key={em} className="text-[10px] px-2 py-0.5 rounded-full bg-[#e5eeff] text-[#006685] font-semibold">{em}</span>
                    ))}
                  </div>
                  {entry.note && (
                    <p className="text-xs text-[#6f787e] mt-1 truncate">{entry.note}</p>
                  )}
                </div>
                <span className="text-xs font-bold px-2 py-1 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                  {cfg.label}
                </span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
