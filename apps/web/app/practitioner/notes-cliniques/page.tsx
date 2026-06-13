'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

function Icon({ name, size = 18, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-symbols-outlined" style={{ fontSize: `${size}px`, color, lineHeight: 1, userSelect: 'none' }}>{name}</span>
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

const NOTE_TYPES = [
  { value: 'observation',       label: 'Observation',         color: '#006685', bg: '#e5eeff' },
  { value: 'compte_rendu',      label: 'Compte-rendu',        color: '#1d7a3a', bg: '#dcfce7' },
  { value: 'note_suivi',        label: 'Note de suivi',       color: '#705d00', bg: '#fef9c3' },
  { value: 'bilan',             label: 'Bilan',               color: '#475569', bg: '#f1f5f9' },
  { value: 'alerte',            label: 'Alerte',              color: '#ba1a1a', bg: '#ffdad6' },
  { value: 'prescription_note', label: 'Note de prescription', color: '#0f766e', bg: '#ccfbf1' },
] as const

type NoteType = typeof NOTE_TYPES[number]['value']

function noteTypeMeta(type: string) {
  return NOTE_TYPES.find(t => t.value === type) ?? { label: type, color: '#475569', bg: '#f1f5f9' }
}

interface NoteRow {
  id: string
  note_type: NoteType
  title: string | null
  content: string
  is_shared_with_patient: boolean
  tags: string[]
  created_at: string
  patient_id: string
  patient_name: string
}

function useAllNotes() {
  return useQuery<NoteRow[]>({
    queryKey: ['all-notes-cliniques'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')
      const { data: pract, error: pErr } = await supabase.from('practitioners').select('id').eq('user_id', user.id).single()
      if (pErr || !pract) throw new Error('Profil praticien introuvable')

      const { data, error } = await supabase
        .from('practitioner_notes')
        .select('id, note_type, title, content, is_shared_with_patient, tags, created_at, patient_id, patient:users!practitioner_notes_patient_id_fkey(full_name)')
        .eq('practitioner_id', pract.id)
        .order('created_at', { ascending: false })
      if (error) throw error

      return (data ?? []).map(r => ({
        id: r.id,
        note_type: r.note_type as NoteType,
        title: r.title,
        content: r.content,
        is_shared_with_patient: r.is_shared_with_patient,
        tags: r.tags ?? [],
        created_at: r.created_at,
        patient_id: r.patient_id,
        patient_name: (r.patient as unknown as { full_name: string })?.full_name ?? 'Inconnu',
      }))
    },
    staleTime: 2 * 60 * 1000,
  })
}

function Skeleton() {
  return <div className="space-y-3 animate-pulse">{[1,2,3,4,5].map(i => <div key={i} className="h-24 bg-slate-100 rounded-xl" />)}</div>
}

export default function AllNotesPage() {
  const { data: notes = [], isLoading, error } = useAllNotes()
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  const filtered = notes.filter(n => {
    if (typeFilter !== 'all' && n.note_type !== typeFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return n.patient_name.toLowerCase().includes(q) || (n.title ?? '').toLowerCase().includes(q) || n.content.toLowerCase().includes(q) || n.tags.some(t => t.toLowerCase().includes(q))
    }
    return true
  })

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#0b1c30] tracking-tight">Notes cliniques</h1>
          <p className="text-sm text-slate-500 mt-0.5">Toutes vos notes patients</p>
        </div>
        <Link href="/practitioner/patients"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors">
          <Icon name="person_search" size={16} color="#006685" />
          Par patient
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher patient, titre, contenu, tag…"
          className="flex-1 px-4 py-2.5 rounded-xl text-sm border border-slate-200 text-[#0b1c30] bg-white/80 focus:outline-none focus:border-[#006685]" />
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setTypeFilter('all')} className="px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
            style={{ backgroundColor: typeFilter === 'all' ? '#006685' : 'rgba(255,255,255,0.70)', color: typeFilter === 'all' ? '#fff' : '#475569', border: '1px solid', borderColor: typeFilter === 'all' ? '#006685' : 'rgba(190,200,206,0.40)' }}>
            Tous
          </button>
          {NOTE_TYPES.map(t => (
            <button key={t.value} onClick={() => setTypeFilter(t.value)} className="px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
              style={{ backgroundColor: typeFilter === t.value ? t.color : 'rgba(255,255,255,0.70)', color: typeFilter === t.value ? '#fff' : t.color, border: `1px solid ${t.color}30` }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl p-4 text-center">
          <p className="text-xl font-black text-[#006685]">{notes.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Total notes</p>
        </div>
        <div className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl p-4 text-center">
          <p className="text-xl font-black text-[#1d7a3a]">{notes.filter(n => n.is_shared_with_patient).length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Partagées</p>
        </div>
        <div className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl p-4 text-center">
          <p className="text-xl font-black text-[#ba1a1a]">{notes.filter(n => n.note_type === 'alerte').length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Alertes</p>
        </div>
      </div>

      {isLoading ? <Skeleton /> : error ? (
        <div className="bg-white/60 border border-white/80 rounded-xl p-6 text-center">
          <Icon name="error" size={32} color="#ba1a1a" />
          <p className="mt-2 text-slate-600">{(error as Error).message}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white/60 border border-white/80 rounded-xl p-10 text-center">
          <Icon name="description" size={40} color="#cbd5e1" />
          <p className="mt-3 text-slate-400 text-sm">Aucune note trouvée</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(note => {
            const meta = noteTypeMeta(note.note_type)
            return (
              <Link key={note.id} href={`/practitioner/patients/${note.patient_id}/notes`}
                className="block bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#e5eeff] flex items-center justify-center text-[#006685] text-xs font-bold flex-shrink-0">
                    {initials(note.patient_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-semibold text-[#0b1c30]">{note.patient_name}</p>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: meta.bg, color: meta.color }}>
                        {meta.label}
                      </span>
                      {note.is_shared_with_patient && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[#e5eeff] text-[#006685] flex items-center gap-0.5">
                          <Icon name="share" size={10} color="#006685" />Partagé
                        </span>
                      )}
                    </div>
                    {note.title && <p className="text-xs font-semibold text-[#0b1c30] truncate">{note.title}</p>}
                    <p className="text-xs text-slate-500 truncate mt-0.5">{note.content}</p>
                    {note.tags.length > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {note.tags.slice(0, 4).map(tag => (
                          <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400">#{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0">{fmt(note.created_at)}</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
