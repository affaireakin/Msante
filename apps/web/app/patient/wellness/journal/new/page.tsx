'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span className="material-symbols-outlined" style={{ fontSize: '20px', ...style }}>{name}</span>
}

const EMOTIONS = [
  { id: 'joyful',    label: 'Joyeux',    icon: 'mood' },
  { id: 'calm',      label: 'Calme',     icon: 'spa' },
  { id: 'grateful',  label: 'Reconnaissant', icon: 'favorite' },
  { id: 'anxious',   label: 'Anxieux',   icon: 'psychology' },
  { id: 'sad',       label: 'Triste',    icon: 'sentiment_sad' },
  { id: 'tired',     label: 'Fatigué',   icon: 'bedtime' },
  { id: 'stressed',  label: 'Stressé',   icon: 'electric_bolt' },
  { id: 'hopeful',   label: 'Optimiste', icon: 'wb_sunny' },
  { id: 'angry',     label: 'En colère', icon: 'warning' },
  { id: 'confused',  label: 'Confus',    icon: 'help' },
]

const REFLECTION_PROMPTS = [
  'Quelle sensation physique est la plus présente en ce moment ?',
  'Identifiez une petite victoire des dernières 24 heures.',
  'Si votre humeur avait une couleur, laquelle serait-ce ?',
  'Pour quoi êtes-vous reconnaissant(e) aujourd\'hui ?',
]

export default function JournalNewPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>([])
  const [moodScore, setMoodScore] = useState<number | null>(null)

  const toggle = (id: string) =>
    setSelectedEmotions(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id])

  const addPrompt = (prompt: string) =>
    setContent(prev => prev + (prev ? '\n\n' : '') + prompt + '\n')

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')
      const { data, error } = await supabase
        .from('journal_entries')
        .insert({
          patient_id: user.id,
          title: title.trim() || null,
          content: content.trim(),
          tags: selectedEmotions,
          mood_score: moodScore,
          is_private: true,
        })
        .select('id')
        .single()
      if (error) throw error
      return data.id as string
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] })
      queryClient.invalidateQueries({ queryKey: ['patient-wellness'] })
      router.push(`/patient/wellness/journal/${id}`)
    },
  })

  const canSave = content.trim().length > 0

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/patient/wellness/journal" className="w-9 h-9 flex items-center justify-center rounded-full bg-white/70 border border-slate-200/50 text-[#6f787e] hover:bg-white transition-colors">
            <Icon name="arrow_back" />
          </Link>
          <h1 className="text-xl font-black text-[#0b1c30]">Nouvelle entrée</h1>
        </div>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={!canSave || saveMutation.isPending}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
          style={{
            backgroundColor: canSave ? '#006685' : '#bec8ce',
            cursor: canSave ? 'pointer' : 'not-allowed',
            boxShadow: canSave ? '0 4px 12px rgba(0,102,133,0.20)' : 'none',
          }}
        >
          <Icon name="save" style={{ color: '#fff', fontSize: '18px' }} />
          {saveMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>

      {/* Writing area */}
      <div className="rounded-2xl p-6 space-y-5" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
        {/* Titre */}
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Titre de l'entrée..."
          className="w-full bg-transparent text-xl font-bold text-[#0b1c30] placeholder-[#bec8ce] outline-none border-b border-slate-100 pb-4"
          style={{ fontFamily: 'Manrope' }}
        />

        {/* Humeur rapide */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-[#6f787e] uppercase tracking-widest">Humeur du moment</p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
              <button
                key={n}
                onClick={() => setMoodScore(moodScore === n ? null : n)}
                className="flex-1 h-8 rounded-lg text-xs font-bold transition-all"
                style={{
                  backgroundColor: moodScore === n ? '#006685' : '#f1f5f9',
                  color: moodScore === n ? '#fff' : '#6f787e',
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Émotions */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-[#6f787e] uppercase tracking-widest">Vos émotions</p>
          <div className="flex flex-wrap gap-2">
            {EMOTIONS.map(e => {
              const active = selectedEmotions.includes(e.id)
              return (
                <button
                  key={e.id}
                  onClick={() => toggle(e.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                  style={{
                    backgroundColor: active ? '#006685' : '#f1f5f9',
                    color: active ? '#fff' : '#3f484d',
                    border: active ? 'none' : '1px solid #bec8ce',
                  }}
                >
                  <Icon name={e.icon} style={{ fontSize: '13px', color: active ? '#fff' : '#6f787e' }} />
                  {e.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Contenu */}
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Écrivez librement. Comment votre esprit traite-t-il la journée ?"
          rows={8}
          className="w-full bg-transparent text-sm text-[#3f484d] placeholder-[#bec8ce] outline-none resize-none leading-relaxed"
          style={{ fontFamily: 'Manrope' }}
        />
      </div>

      {/* Réflexions guidées */}
      <div className="rounded-2xl p-5 space-y-3" style={{ backgroundColor: 'rgba(190,233,255,0.20)', border: '1px solid rgba(130,216,255,0.30)' }}>
        <p className="text-xs font-bold text-[#006685] uppercase tracking-widest flex items-center gap-1.5">
          <Icon name="lightbulb" style={{ fontSize: '14px', color: '#006685' }} />
          Réflexions guidées
        </p>
        <div className="space-y-2">
          {REFLECTION_PROMPTS.map((prompt, i) => (
            <button
              key={i}
              onClick={() => addPrompt(prompt)}
              className="w-full text-left px-4 py-3 rounded-xl text-sm text-[#0b1c30] hover:bg-white/60 transition-all"
              style={{ backgroundColor: 'rgba(255,255,255,0.50)', border: '1px solid rgba(255,255,255,0.60)' }}
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-center text-[#6f787e]">Vos entrées sont privées et chiffrées</p>
    </div>
  )
}
