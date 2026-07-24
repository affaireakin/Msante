'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { logPatientAccess } from '@/lib/patientAccessLog'

// ─── helpers ────────────────────────────────────────────────────────────────

function Icon({ name, size = 18, color }: { name: string; size?: number; color?: string }) {
  return (
    <span
      className="material-symbols-outlined"
      style={{ fontSize: `${size}px`, color, lineHeight: 1, userSelect: 'none' }}
    >
      {name}
    </span>
  )
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')
}

const NOTE_TYPES = [
  { value: 'observation',        label: 'Observation' },
  { value: 'compte_rendu',       label: 'Compte-rendu' },
  { value: 'note_suivi',         label: 'Note de suivi' },
  { value: 'bilan',              label: 'Bilan' },
  { value: 'alerte',             label: 'Alerte' },
  { value: 'prescription_note',  label: 'Note de prescription' },
] as const

type NoteType = typeof NOTE_TYPES[number]['value']

function noteTypeColors(type: NoteType): { bg: string; text: string } {
  switch (type) {
    case 'observation':       return { bg: '#e5eeff', text: '#82d8ff' }
    case 'compte_rendu':      return { bg: '#dcfce7', text: '#1d7a3a' }
    case 'note_suivi':        return { bg: '#fef9c3', text: '#705d00' }
    case 'bilan':             return { bg: '#f1f5f9', text: '#475569' }
    case 'alerte':            return { bg: '#ffdad6', text: '#ba1a1a' }
    case 'prescription_note': return { bg: '#ccfbf1', text: '#0f766e' }
    default:                  return { bg: '#f1f5f9', text: '#475569' }
  }
}

function noteTypeLabel(type: string): string {
  return NOTE_TYPES.find(t => t.value === type)?.label ?? type
}

// ─── types ───────────────────────────────────────────────────────────────────

interface PatientInfo {
  id: string
  full_name: string
  created_at: string
}

interface NoteRow {
  id: string
  note_type: NoteType
  title: string | null
  content: string
  is_shared_with_patient: boolean
  tags: string[]
  created_at: string
}

interface NotesData {
  patient: PatientInfo
  notes: NoteRow[]
  practitionerId: string
}

// ─── data hook ───────────────────────────────────────────────────────────────

function useNotesData(patientId: string) {
  return useQuery<NotesData>({
    queryKey: ['practitioner-notes', patientId],
    enabled: !!patientId,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')

      const { data: pract, error: pErr } = await supabase
        .from('practitioners')
        .select('id')
        .eq('user_id', user.id)
        .single()
      if (pErr || !pract) throw new Error('Profil praticien introuvable')

      const [
        { data: patientData, error: ptErr },
        { data: notesData, error: nErr },
      ] = await Promise.all([
        supabase.from('users').select('id, full_name, created_at').eq('id', patientId).single(),
        supabase
          .from('practitioner_notes')
          .select('id, note_type, title, content, is_shared_with_patient, tags, created_at')
          .eq('patient_id', patientId)
          .eq('practitioner_id', pract.id)
          .order('created_at', { ascending: false }),
      ])

      if (ptErr) throw ptErr
      if (nErr) throw nErr

      logPatientAccess(patientId, pract.id, 'notes')

      return {
        patient: patientData as PatientInfo,
        notes: (notesData ?? []) as NoteRow[],
        practitionerId: pract.id as string,
      }
    },
    staleTime: 3 * 60 * 1000,
  })
}

// ─── tab nav ─────────────────────────────────────────────────────────────────

function TabNav({ patientId }: { patientId: string }) {
  const tabs = [
    { key: 'apercu',        label: 'Aperçu',        href: `/practitioner/patients/${patientId}` },
    { key: 'notes',         label: 'Notes',         href: `/practitioner/patients/${patientId}/notes` },
    { key: 'ordonnances',   label: 'Ordonnances',   href: `/practitioner/patients/${patientId}/prescriptions` },
    { key: 'appréciations', label: 'Appréciations', href: `/practitioner/patients/${patientId}/appreciation` },
    { key: 'parcours',      label: 'Parcours',      href: `/practitioner/patients/${patientId}/journey` },
  ]
  return (
    <div className="flex gap-0 border-b border-slate-200 mt-6 overflow-x-auto">
      {tabs.map(tab => (
        <Link
          key={tab.key}
          href={tab.href}
          className={`px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
            tab.key === 'notes'
              ? 'border-b-2 border-[#82d8ff] text-[#82d8ff]'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  )
}

// ─── patient header ──────────────────────────────────────────────────────────

function PatientHeader({ patient, patientId }: { patient: PatientInfo; patientId: string }) {
  return (
    <div className="flex items-center gap-4 mb-0">
      <Link
        href={`/practitioner/patients/${patientId}`}
        className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-500"
      >
        <Icon name="arrow_back" size={20} />
      </Link>
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 font-bold text-base select-none"
        style={{ background: '#e5eeff', color: '#82d8ff' }}
      >
        {initials(patient.full_name)}
      </div>
      <div>
        <h1 className="text-xl font-bold text-[#0b1c30]">{patient.full_name}</h1>
        <p className="text-sm text-slate-500">Patient depuis {fmt(patient.created_at)}</p>
      </div>
    </div>
  )
}

// ─── new note modal ───────────────────────────────────────────────────────────

interface NewNoteModalProps {
  patientId: string
  practitionerId: string
  onClose: () => void
}

function NewNoteModal({ patientId, practitionerId, onClose }: NewNoteModalProps) {
  const queryClient = useQueryClient()
  const [noteType, setNoteType] = useState<NoteType>('observation')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [isShared, setIsShared] = useState(false)
  const [tagsInput, setTagsInput] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async () => {
      if (!content.trim()) throw new Error('Le contenu est requis')
      const tags = tagsInput
        .split(',')
        .map(t => t.trim())
        .filter(Boolean)

      const { error } = await supabase.from('practitioner_notes').insert({
        patient_id: patientId,
        practitioner_id: practitionerId,
        note_type: noteType,
        title: title.trim() || null,
        content: content.trim(),
        is_shared_with_patient: isShared,
        tags,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['practitioner-notes', patientId] })
      onClose()
    },
    onError: (err: Error) => {
      setFormError(err.message)
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#0b1c30] flex items-center gap-2">
            <Icon name="note_add" size={18} color="#82d8ff" />
            Nouvelle note
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {formError && (
          <div className="text-sm text-[#ba1a1a] bg-[#ffdad6] rounded-lg px-3 py-2">{formError}</div>
        )}

        <div className="space-y-3">
          {/* Note type */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Type de note</label>
            <select
              value={noteType}
              onChange={e => setNoteType(e.target.value as NoteType)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#0b1c30] bg-white focus:outline-none focus:border-[#82d8ff]"
            >
              {NOTE_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Titre <span className="font-normal text-slate-400">(optionnel)</span></label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Titre de la note…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#0b1c30] bg-white focus:outline-none focus:border-[#82d8ff]"
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Contenu <span className="text-[#ba1a1a]">*</span></label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={5}
              placeholder="Rédigez votre note ici…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#0b1c30] bg-white focus:outline-none focus:border-[#82d8ff] resize-none"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tags <span className="font-normal text-slate-400">(séparés par des virgules)</span></label>
            <input
              type="text"
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
              placeholder="anxiété, sommeil, suivi…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#0b1c30] bg-white focus:outline-none focus:border-[#82d8ff]"
            />
          </div>

          {/* Shared */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isShared}
              onChange={e => setIsShared(e.target.checked)}
              className="w-4 h-4 accent-[#82d8ff]"
            />
            <span className="text-sm text-slate-700">Partager avec le patient</span>
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-60"
            style={{ background: '#82d8ff' }}
          >
            {mutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── note card ───────────────────────────────────────────────────────────────

function NoteCard({ note }: { note: NoteRow }) {
  const { bg, text } = noteTypeColors(note.note_type)
  return (
    <div className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl shadow-sm p-5 space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: bg, color: text }}
          >
            {noteTypeLabel(note.note_type)}
          </span>
          {note.is_shared_with_patient && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#e5eeff] text-[#82d8ff] flex items-center gap-1">
              <Icon name="share" size={12} color="#82d8ff" />
              Partagé
            </span>
          )}
        </div>
        <span className="text-xs text-slate-400 shrink-0">{fmt(note.created_at)}</span>
      </div>

      {note.title && (
        <p className="text-sm font-semibold text-[#0b1c30]">{note.title}</p>
      )}

      <p className="text-sm text-slate-600 line-clamp-3">{note.content}</p>

      {note.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {note.tags.map(tag => (
            <span
              key={tag}
              className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── skeleton ────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-12 bg-slate-100 rounded-xl" />
      {[1, 2, 3].map(i => <div key={i} className="h-32 bg-slate-100 rounded-xl" />)}
    </div>
  )
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function PatientNotesPage() {
  const params = useParams()
  const patientId = params.patientId as string
  const [showModal, setShowModal] = useState(false)

  const { data, isLoading, error } = useNotesData(patientId)

  if (isLoading) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <Skeleton />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl shadow-sm p-6 text-center">
          <Icon name="error" size={32} color="#ba1a1a" />
          <p className="mt-2 text-slate-600">{error?.message ?? 'Erreur de chargement'}</p>
        </div>
      </div>
    )
  }

  const { patient, notes, practitionerId } = data

  return (
    <>
      {showModal && (
        <NewNoteModal
          patientId={patientId}
          practitionerId={practitionerId}
          onClose={() => setShowModal(false)}
        />
      )}

      <div className="p-8 max-w-4xl mx-auto">
        <PatientHeader patient={patient} patientId={patientId} />
        <TabNav patientId={patientId} />

        <div className="mt-6 space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {notes.length} note{notes.length !== 1 ? 's' : ''}
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
              style={{ background: '#82d8ff' }}
            >
              <Icon name="note_add" size={16} color="#ffffff" />
              Nouvelle note
            </button>
          </div>

          {/* Notes list */}
          {notes.length === 0 ? (
            <div className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl shadow-sm p-10 text-center">
              <Icon name="description" size={36} color="#cbd5e1" />
              <p className="mt-3 text-slate-400 text-sm">Aucune note pour ce patient</p>
              <button
                onClick={() => setShowModal(true)}
                className="mt-4 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
                style={{ background: '#82d8ff' }}
              >
                Créer une note
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {notes.map(note => (
                <NoteCard key={note.id} note={note} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
