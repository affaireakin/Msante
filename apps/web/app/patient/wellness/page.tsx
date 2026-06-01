'use client'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span className="material-symbols-outlined" style={style}>{name}</span>
}

const MOOD_CONFIG: Record<number, { label: string; color: string; bg: string; icon: string }> = {
  1: { label: 'Très bas', color: '#ba1a1a', bg: '#ffdad6', icon: 'sentiment_very_dissatisfied' },
  2: { label: 'Bas', color: '#ba1a1a', bg: '#ffdad6', icon: 'sentiment_dissatisfied' },
  3: { label: 'Moyen', color: '#705d00', bg: '#fff8e1', icon: 'sentiment_neutral' },
  4: { label: 'Moyen', color: '#705d00', bg: '#fff8e1', icon: 'sentiment_neutral' },
  5: { label: 'Correct', color: '#006685', bg: '#e5eeff', icon: 'sentiment_satisfied' },
  6: { label: 'Correct', color: '#006685', bg: '#e5eeff', icon: 'sentiment_satisfied' },
  7: { label: 'Bien', color: '#1d7a3a', bg: '#e8f5e9', icon: 'sentiment_satisfied_alt' },
  8: { label: 'Très bien', color: '#1d7a3a', bg: '#e8f5e9', icon: 'sentiment_very_satisfied' },
  9: { label: 'Excellent', color: '#1d7a3a', bg: '#e8f5e9', icon: 'sentiment_very_satisfied' },
  10: { label: 'Parfait', color: '#1d7a3a', bg: '#e8f5e9', icon: 'sentiment_very_satisfied' },
}

interface MoodEntry { id: string; score: number; emotions: string[]; note: string | null; entry_date: string }
interface JournalEntry { id: string; title: string | null; content: string; mood_score: number | null; created_at: string }

function useWellness() {
  return useQuery({
    queryKey: ['patient-wellness'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')

      const [{ data: moods }, { data: journals }] = await Promise.all([
        supabase.from('mood_entries').select('id, score, emotions, note, entry_date').eq('patient_id', user.id).order('entry_date', { ascending: false }).limit(7),
        supabase.from('journal_entries').select('id, title, content, mood_score, created_at').eq('patient_id', user.id).order('created_at', { ascending: false }).limit(3),
      ])

      return {
        moods: (moods ?? []) as MoodEntry[],
        journals: (journals ?? []) as JournalEntry[],
        avgMood: moods?.length ? Math.round(moods.reduce((s, m) => s + m.score, 0) / moods.length) : null,
      }
    },
  })
}

export default function WellnessPage() {
  const { data, isLoading } = useWellness()

  if (isLoading) return (
    <div className="space-y-4">
      {[1,2,3].map(i => <div key={i} className="h-32 rounded-2xl bg-white/40 animate-pulse" />)}
    </div>
  )

  const { moods, journals, avgMood } = data ?? { moods: [], journals: [], avgMood: null }
  const moodCfg = avgMood ? MOOD_CONFIG[avgMood] : null

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-black text-[#0b1c30]">Bien-être</h1>
        <p className="text-sm text-[#6f787e] mt-1">Votre suivi émotionnel et mental</p>
      </div>

      {/* Mood summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl p-6 md:col-span-1 flex flex-col items-center justify-center text-center" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
          {moodCfg ? (
            <>
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: moodCfg.bg }}>
                <Icon name={moodCfg.icon} style={{ fontSize: '32px', color: moodCfg.color }} />
              </div>
              <p className="text-3xl font-black" style={{ color: moodCfg.color }}>{avgMood}/10</p>
              <p className="text-sm text-[#6f787e] mt-1">Humeur moyenne (7 jours)</p>
            </>
          ) : (
            <>
              <Icon name="mood" style={{ fontSize: '48px', color: '#bec8ce' }} />
              <p className="font-semibold text-[#0b1c30] mt-2">Aucune donnée</p>
              <p className="text-xs text-[#6f787e]">Commencez à tracker votre humeur</p>
            </>
          )}
        </div>

        <div className="rounded-2xl p-6 md:col-span-2" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[#0b1c30]">Historique humeur (7 jours)</h3>
          </div>
          {moods.length === 0 ? (
            <div className="flex items-center justify-center h-20 text-[#6f787e] text-sm">
              Aucun enregistrement cette semaine
            </div>
          ) : (
            <div className="flex items-end gap-2 h-24">
              {moods.slice().reverse().map(m => {
                const cfg = MOOD_CONFIG[m.score] ?? MOOD_CONFIG[5]
                const height = `${(m.score / 10) * 100}%`
                return (
                  <div key={m.id} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full rounded-t-lg transition-all" style={{ height, backgroundColor: cfg.color, minHeight: '8px' }} />
                    <span className="text-xs text-[#6f787e]">{new Date(m.entry_date).toLocaleDateString('fr-FR', { weekday: 'short' })}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Tools */}
      <div>
        <h2 className="text-lg font-bold text-[#0b1c30] mb-4">Outils bien-être</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { href: '/patient/wellness/mood',              icon: 'mood',             label: 'Check-in humeur', color: '#006685', bg: '#e5eeff', desc: 'Enregistrer votre état' },
            { href: '/patient/wellness/journal',           icon: 'book',             label: 'Journal',         color: '#705d00', bg: '#fff8e1', desc: 'Écrire vos pensées' },
            { href: '/patient/wellness/mood/history',      icon: 'bar_chart',        label: 'Historique',      color: '#1d7a3a', bg: '#e8f5e9', desc: 'Tendances humeur' },
            { href: '/patient/wellness/meditation',        icon: 'self_improvement', label: 'Méditation',      color: '#006685', bg: '#bee9ff', desc: 'Respiration guidée' },
            { href: '/patient/assistant',                  icon: 'favorite',         label: 'Mounima',         color: '#5c5f61', bg: '#e0e3e5', desc: 'Compagnon émotionnel' },
          ].map(t => (
            <Link key={t.label} href={t.href} className="rounded-2xl p-5 text-left hover:-translate-y-1 hover:shadow-lg transition-all block" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: t.bg }}>
                <Icon name={t.icon} style={{ color: t.color, fontSize: '22px' }} />
              </div>
              <p className="font-bold text-[#0b1c30] text-sm">{t.label}</p>
              <p className="text-xs text-[#6f787e] mt-0.5">{t.desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent journal entries */}
      {journals.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[#0b1c30]">Journal récent</h2>
            <Link href="/patient/wellness/journal" className="text-xs font-bold text-[#006685] hover:underline uppercase tracking-wide">
              Voir tout →
            </Link>
          </div>
          <div className="space-y-3">
            {journals.map(j => (
              <Link key={j.id} href={`/patient/wellness/journal/${j.id}`} className="block rounded-2xl p-5 hover:shadow-md transition-all" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-[#0b1c30]">{j.title || 'Sans titre'}</p>
                  <span className="text-xs text-[#6f787e]">
                    {new Date(j.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
                <p className="text-sm text-[#6f787e] line-clamp-2">{j.content}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* CTA si aucune donnée */}
      {moods.length === 0 && journals.length === 0 && (
        <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: '#e5eeff', border: '1px solid #82d8ff' }}>
          <Icon name="self_improvement" style={{ fontSize: '56px', color: '#006685' }} />
          <h3 className="text-xl font-bold text-[#0b1c30] mt-4">Commencez votre parcours bien-être</h3>
          <p className="text-sm text-[#6f787e] mt-2 max-w-md mx-auto">
            Trackez votre humeur quotidiennement, écrivez dans votre journal et parlez à Mounima.
          </p>
          <div className="flex items-center justify-center gap-3 mt-5">
            <Link href="/patient/wellness/mood" className="flex items-center gap-2 px-5 py-2.5 bg-[#006685] text-white text-sm font-bold rounded-xl hover:shadow-lg transition-all">
              <Icon name="mood" style={{ fontSize: '18px', color: '#fff' }} />
              Premier check-in
            </Link>
            <Link href="/patient/wellness/journal/new" className="flex items-center gap-2 px-5 py-2.5 bg-white text-[#006685] text-sm font-bold rounded-xl border border-[#bec8ce] hover:shadow-md transition-all">
              <Icon name="edit" style={{ fontSize: '18px', color: '#006685' }} />
              Écrire dans le journal
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
