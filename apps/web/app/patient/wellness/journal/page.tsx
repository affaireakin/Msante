'use client'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span className="material-symbols-outlined" style={{ fontSize: '20px', ...style }}>{name}</span>
}

interface JournalEntry {
  id: string
  title: string | null
  content: string
  mood_score: number | null
  emotions: string[]
  created_at: string
}

const MOOD_COLORS: Record<number, string> = {
  1: '#ba1a1a', 2: '#ba1a1a', 3: '#c05000', 4: '#705d00', 5: '#705d00',
  6: '#82d8ff', 7: '#82d8ff', 8: '#1d7a3a', 9: '#1d7a3a', 10: '#1d7a3a',
}

function useJournalEntries() {
  return useQuery<JournalEntry[]>({
    queryKey: ['journal-entries'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')
      const { data, error } = await supabase
        .from('journal_entries')
        .select('id, title, content, mood_score, emotions, created_at')
        .eq('patient_id', user.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as JournalEntry[]
    },
  })
}

export default function JournalListPage() {
  const { data: entries = [], isLoading } = useJournalEntries()

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/patient/wellness" className="w-9 h-9 flex items-center justify-center rounded-full bg-white/70 border border-slate-200/50 text-[#6f787e] hover:bg-white transition-colors flex-shrink-0">
            <Icon name="arrow_back" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-[#0b1c30]">Journal émotionnel</h1>
            <p className="text-sm text-[#6f787e]">{entries.length} entrée{entries.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <Link
          href="/patient/wellness/journal/new"
          className="flex items-center gap-2 px-5 py-2.5 bg-[#82d8ff] text-[#0b1c30] text-sm font-bold rounded-xl hover:shadow-lg hover:shadow-[#82d8ff]/20 transition-all flex-shrink-0"
        >
          <Icon name="edit" style={{ color: '#fff', fontSize: '18px' }} />
          Nouvelle entrée
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-28 rounded-2xl bg-white/40 animate-pulse" />)}
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-2xl p-16 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.60)', border: '1px solid rgba(255,255,255,0.80)' }}>
          <Icon name="book" style={{ fontSize: '56px', color: '#bec8ce' }} />
          <h3 className="text-lg font-bold text-[#0b1c30] mt-4">Votre journal est vide</h3>
          <p className="text-sm text-[#6f787e] mt-2 max-w-xs mx-auto">
            Écrire régulièrement aide à mieux comprendre vos émotions et à avancer.
          </p>
          <Link
            href="/patient/wellness/journal/new"
            className="mt-5 inline-flex items-center gap-2 px-6 py-3 bg-[#82d8ff] text-[#0b1c30] text-sm font-bold rounded-xl hover:shadow-lg transition-all"
          >
            <Icon name="edit" style={{ color: '#fff', fontSize: '18px' }} />
            Première entrée
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map(entry => {
            const dt = new Date(entry.created_at)
            const moodColor = entry.mood_score ? MOOD_COLORS[entry.mood_score] : '#6f787e'
            return (
              <Link
                key={entry.id}
                href={`/patient/wellness/journal/${entry.id}`}
                className="block rounded-2xl p-5 hover:shadow-md transition-all"
                style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#fff8e1] flex flex-col items-center justify-center flex-shrink-0">
                      <span className="text-sm font-black text-[#705d00] leading-none">{dt.getDate()}</span>
                      <span className="text-[9px] text-[#705d00] font-semibold uppercase">
                        {dt.toLocaleDateString('fr-FR', { month: 'short' })}
                      </span>
                    </div>
                    <div>
                      <p className="font-bold text-[#0b1c30]">{entry.title || 'Sans titre'}</p>
                      <p className="text-xs text-[#6f787e]">
                        {dt.toLocaleDateString('fr-FR', { weekday: 'long', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  {entry.mood_score && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#f8f9ff', color: moodColor, border: `1px solid ${moodColor}30` }}>
                      {entry.mood_score}/10
                    </span>
                  )}
                </div>
                <p className="text-sm text-[#6f787e] line-clamp-2 ml-13" style={{ marginLeft: '52px' }}>
                  {entry.content}
                </p>
                {(entry.emotions ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2" style={{ marginLeft: '52px' }}>
                    {entry.emotions.slice(0, 3).map((emotion: string) => (
                      <span key={emotion} className="text-[10px] px-2 py-0.5 rounded-full bg-[#e5eeff] text-[#82d8ff] font-semibold">{emotion}</span>
                    ))}
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
