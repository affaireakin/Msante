'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
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
  is_private: boolean
  created_at: string
}

const MOOD_CONFIG: Record<number, { label: string; color: string; bg: string }> = {
  1:  { label: 'Très bas',  color: '#ba1a1a', bg: '#ffdad6' },
  2:  { label: 'Bas',       color: '#ba1a1a', bg: '#ffdad6' },
  3:  { label: 'Faible',    color: '#c05000', bg: '#ffe5d0' },
  4:  { label: 'Moyen',     color: '#705d00', bg: '#fff8e1' },
  5:  { label: 'Correct',   color: '#705d00', bg: '#fff8e1' },
  6:  { label: 'Bien',      color: '#82d8ff', bg: '#e5eeff' },
  7:  { label: 'Bien',      color: '#82d8ff', bg: '#e5eeff' },
  8:  { label: 'Très bien', color: '#1d7a3a', bg: '#e8f5e9' },
  9:  { label: 'Excellent', color: '#1d7a3a', bg: '#e8f5e9' },
  10: { label: 'Parfait',   color: '#1d7a3a', bg: '#e8f5e9' },
}

export default function JournalEntryPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const id = params.id as string
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { data: entry, isLoading } = useQuery<JournalEntry>({
    queryKey: ['journal-entry', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('journal_entries')
        .select('id, title, content, mood_score, emotions, is_private, created_at')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as JournalEntry
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('journal_entries').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] })
      queryClient.invalidateQueries({ queryKey: ['patient-wellness'] })
      router.push('/patient/wellness/journal')
    },
  })

  if (isLoading) return (
    <div className="max-w-2xl mx-auto space-y-4">
      {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-2xl bg-white/40 animate-pulse" />)}
    </div>
  )

  if (!entry) return (
    <div className="max-w-2xl mx-auto text-center py-20">
      <Icon name="error" style={{ fontSize: '48px', color: '#ba1a1a' }} />
      <p className="font-semibold text-[#0b1c30] mt-3">Entrée introuvable</p>
      <Link href="/patient/wellness/journal" className="mt-4 inline-block text-sm font-bold text-[#82d8ff] hover:underline">
        ← Retour au journal
      </Link>
    </div>
  )

  const dt = new Date(entry.created_at)
  const moodCfg = entry.mood_score ? MOOD_CONFIG[entry.mood_score] : null

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/patient/wellness/journal" className="w-9 h-9 flex items-center justify-center rounded-full bg-white/70 border border-slate-200/50 text-[#6f787e] hover:bg-white transition-colors">
            <Icon name="arrow_back" />
          </Link>
          <div>
            <p className="text-xs font-bold text-[#6f787e] uppercase tracking-widest">
              {dt.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <p className="text-xs text-[#6f787e]">
              {dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
        <button
          onClick={() => setConfirmDelete(true)}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-red-50 transition-colors text-[#ba1a1a]"
        >
          <Icon name="delete" style={{ color: '#ba1a1a', fontSize: '18px' }} />
        </button>
      </div>

      {/* Entrée */}
      <div className="rounded-2xl p-6 space-y-5" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
        {/* Titre */}
        {entry.title && (
          <h1 className="text-2xl font-black text-[#0b1c30] border-b border-slate-100 pb-4">
            {entry.title}
          </h1>
        )}

        {/* Méta (humeur + émotions) */}
        <div className="flex flex-wrap items-center gap-2">
          {moodCfg && (
            <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full" style={{ backgroundColor: moodCfg.bg, color: moodCfg.color }}>
              <Icon name="mood" style={{ fontSize: '14px', color: moodCfg.color }} />
              {entry.mood_score}/10 · {moodCfg.label}
            </span>
          )}
          {(entry.emotions ?? []).map((emotion: string) => (
            <span key={emotion} className="text-xs px-2.5 py-1 rounded-full bg-[#e5eeff] text-[#82d8ff] font-semibold">{emotion}</span>
          ))}
          {entry.is_private && (
            <span className="flex items-center gap-1 text-xs text-[#6f787e]">
              <Icon name="lock" style={{ fontSize: '13px', color: '#6f787e' }} />
              Privé
            </span>
          )}
        </div>

        {/* Contenu */}
        <div className="text-[#3f484d] leading-relaxed whitespace-pre-wrap text-sm" style={{ fontFamily: 'Manrope' }}>
          {entry.content}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Link
          href="/patient/wellness/journal/new"
          className="flex-1 py-3 rounded-xl border border-slate-200/50 bg-white/60 text-sm font-semibold text-[#0b1c30] hover:bg-white transition-all text-center flex items-center justify-center gap-2"
        >
          <Icon name="edit" style={{ fontSize: '16px' }} />
          Nouvelle entrée
        </Link>
        <Link
          href="/patient/wellness/journal"
          className="flex-1 py-3 rounded-xl bg-[#82d8ff] text-[#0b1c30] text-sm font-semibold hover:shadow-lg transition-all text-center"
        >
          Toutes les entrées
        </Link>
      </div>

      {/* Modal confirmation suppression */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-80 space-y-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#ffdad6] flex items-center justify-center flex-shrink-0">
                <Icon name="delete" style={{ color: '#ba1a1a', fontSize: '20px' }} />
              </div>
              <div>
                <p className="font-bold text-[#0b1c30]">Supprimer cette entrée ?</p>
                <p className="text-xs text-[#6f787e]">Cette action est irréversible.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-[#3f484d] hover:bg-slate-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="flex-1 py-2.5 rounded-xl bg-[#ba1a1a] text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
