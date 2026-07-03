'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span className="material-symbols-outlined" style={{ fontSize: '20px', ...style }}>{name}</span>
}

const MOOD_CONFIG: Record<number, { label: string; color: string; bg: string; icon: string }> = {
  1:  { label: 'Très bas',  color: '#ba1a1a', bg: '#ffdad6', icon: 'sentiment_very_dissatisfied' },
  2:  { label: 'Bas',       color: '#ba1a1a', bg: '#ffdad6', icon: 'sentiment_dissatisfied' },
  3:  { label: 'Faible',    color: '#c05000', bg: '#ffe5d0', icon: 'sentiment_dissatisfied' },
  4:  { label: 'Moyen',     color: '#705d00', bg: '#fff8e1', icon: 'sentiment_neutral' },
  5:  { label: 'Correct',   color: '#705d00', bg: '#fff8e1', icon: 'sentiment_neutral' },
  6:  { label: 'Bien',      color: '#82d8ff', bg: '#e5eeff', icon: 'sentiment_satisfied' },
  7:  { label: 'Bien',      color: '#82d8ff', bg: '#e5eeff', icon: 'sentiment_satisfied_alt' },
  8:  { label: 'Très bien', color: '#1d7a3a', bg: '#e8f5e9', icon: 'sentiment_very_satisfied' },
  9:  { label: 'Excellent', color: '#1d7a3a', bg: '#e8f5e9', icon: 'sentiment_very_satisfied' },
  10: { label: 'Parfait',   color: '#1d7a3a', bg: '#e8f5e9', icon: 'sentiment_very_satisfied' },
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

export default function MoodCheckinPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [score, setScore] = useState(6)
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(false)

  const cfg = MOOD_CONFIG[score]

  const toggle = (id: string) =>
    setSelectedEmotions(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')
      const today = new Date().toISOString().split('T')[0]
      const { error } = await supabase.from('mood_entries').upsert(
        { patient_id: user.id, score, emotions: selectedEmotions, note: note.trim() || null, entry_date: today },
        { onConflict: 'patient_id,entry_date' }
      )
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-wellness'] })
      setSaved(true)
      setTimeout(() => {
        if (score < 3) {
          router.push('/patient/practitioners')
        } else {
          router.push('/patient/wellness')
        }
      }, 1200)
    },
  })

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/patient/wellness" className="w-9 h-9 flex items-center justify-center rounded-full bg-white/70 border border-slate-200/50 text-[#6f787e] hover:bg-white transition-colors">
          <Icon name="arrow_back" />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-[#0b1c30]">Check-in humeur</h1>
          <p className="text-sm text-[#6f787e]">Comment vous sentez-vous aujourd&apos;hui ?</p>
        </div>
      </div>

      {/* Score card */}
      <div className="rounded-2xl p-6 space-y-6" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
        {/* Emoji + label */}
        <div className="flex flex-col items-center gap-3 py-2">
          <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ backgroundColor: cfg.bg }}>
            <Icon name={cfg.icon} style={{ fontSize: '40px', color: cfg.color }} />
          </div>
          <div className="text-center">
            <p className="text-4xl font-black" style={{ color: cfg.color }}>{score}</p>
            <p className="text-sm font-semibold text-[#6f787e] mt-0.5">{cfg.label}</p>
          </div>
        </div>

        {/* Slider */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-[#6f787e] font-medium">
            <span>1 · Très bas</span>
            <span>10 · Parfait</span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={score}
            onChange={e => setScore(Number(e.target.value))}
            className="w-full accent-[#82d8ff] cursor-pointer"
          />
          <div className="flex justify-between">
            {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
              <button
                key={n}
                onClick={() => setScore(n)}
                className="w-7 h-7 rounded-full text-xs font-bold transition-all"
                style={{
                  backgroundColor: score === n ? cfg.color : '#f1f5f9',
                  color: score === n ? '#fff' : '#6f787e',
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Emotions */}
      <div className="rounded-2xl p-6 space-y-4" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
        <p className="text-xs font-bold text-[#6f787e] uppercase tracking-widest">Vos émotions</p>
        <div className="flex flex-wrap gap-2">
          {EMOTIONS.map(e => {
            const active = selectedEmotions.includes(e.id)
            return (
              <button
                key={e.id}
                onClick={() => toggle(e.id)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition-all"
                style={{
                  backgroundColor: active ? '#82d8ff' : '#f1f5f9',
                  color: active ? '#fff' : '#3f484d',
                  border: active ? 'none' : '1px solid #bec8ce',
                }}
              >
                <Icon name={e.icon} style={{ fontSize: '14px', color: active ? '#fff' : '#6f787e' }} />
                {e.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Note */}
      <div className="rounded-2xl p-6 space-y-3" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
        <p className="text-xs font-bold text-[#6f787e] uppercase tracking-widest">Note (optionnel)</p>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Quelque chose à noter sur votre journée..."
          rows={3}
          maxLength={300}
          className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] placeholder-[#6f787e] focus:outline-none focus:border-[#82d8ff] transition-all resize-none text-sm"
        />
        <p className="text-xs text-[#6f787e] text-right">{note.length}/300</p>
      </div>

      {/* Warning si score bas */}
      {score < 3 && (
        <div className="rounded-2xl p-4 flex items-start gap-3" style={{ backgroundColor: '#ffdad6', border: '1px solid #ba1a1a30' }}>
          <Icon name="info" style={{ color: '#ba1a1a', fontSize: '20px' }} />
          <div>
            <p className="text-sm font-bold text-[#930009]">Votre humeur semble basse</p>
            <p className="text-xs text-[#ba1a1a] mt-0.5">Après l&apos;enregistrement, nous vous proposerons de consulter un praticien.</p>
          </div>
        </div>
      )}

      {/* Save */}
      <button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending || saved}
        className="w-full py-4 rounded-2xl font-bold text-white text-base transition-all flex items-center justify-center gap-2"
        style={{
          backgroundColor: saved ? '#1d7a3a' : '#82d8ff',
          opacity: saveMutation.isPending ? 0.7 : 1,
          boxShadow: '0 4px 16px rgba(0,102,133,0.20)',
        }}
      >
        {saved ? (
          <><Icon name="check" style={{ color: '#fff', fontSize: '20px' }} />Enregistré !</>
        ) : saveMutation.isPending ? (
          'Enregistrement...'
        ) : (
          'Enregistrer mon humeur'
        )}
      </button>

      <p className="text-xs text-center text-[#6f787e]">Cet outil ne remplace pas un professionnel de santé</p>
    </div>
  )
}
