'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

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

function fmtShort(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: 'En attente',
    confirmed: 'Confirmé',
    completed: 'Terminé',
    cancelled: 'Annulé',
    no_show: 'Absent',
  }
  return map[status] ?? status
}

function statusColors(status: string): { bg: string; text: string } {
  switch (status) {
    case 'completed': return { bg: '#dcfce7', text: '#1d7a3a' }
    case 'confirmed': return { bg: '#e5eeff', text: '#006685' }
    case 'pending':   return { bg: '#fff8e1', text: '#705d00' }
    case 'cancelled': return { bg: '#ffdad6', text: '#ba1a1a' }
    case 'no_show':   return { bg: '#f3e8ff', text: '#7e22ce' }
    default:          return { bg: '#f1f5f9', text: '#475569' }
  }
}

function typeLabel(type: string): string {
  const map: Record<string, string> = { video: 'Vidéo', audio: 'Audio', chat: 'Chat' }
  return map[type] ?? type
}

// ─── types ───────────────────────────────────────────────────────────────────

interface PatientInfo {
  id: string
  full_name: string
  created_at: string
}

interface ApptRow {
  id: string
  status: string
  scheduled_at: string
  type: string
}

interface DossierData {
  patient: PatientInfo
  appointments: ApptRow[]
  practitionerId: string
}

// ─── data hook ───────────────────────────────────────────────────────────────

function useDossier(patientId: string) {
  return useQuery<DossierData>({
    queryKey: ['practitioner-dossier', patientId],
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
        { data: aptsData, error: aErr },
      ] = await Promise.all([
        supabase.from('users').select('id, full_name, created_at').eq('id', patientId).single(),
        supabase
          .from('appointments')
          .select('id, status, scheduled_at, type')
          .eq('patient_id', patientId)
          .eq('practitioner_id', pract.id)
          .order('scheduled_at', { ascending: false }),
      ])

      if (ptErr) throw ptErr
      if (aErr) throw aErr

      return {
        patient: patientData as PatientInfo,
        appointments: (aptsData ?? []) as ApptRow[],
        practitionerId: pract.id as string,
      }
    },
    staleTime: 5 * 60 * 1000,
  })
}

// ─── tab nav ─────────────────────────────────────────────────────────────────

interface TabNavProps {
  patientId: string
  active: 'apercu' | 'notes' | 'ordonnances' | 'appréciations' | 'parcours'
}

function TabNav({ patientId, active }: TabNavProps) {
  const tabs: { key: TabNavProps['active']; label: string; href: string }[] = [
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
            active === tab.key
              ? 'border-b-2 border-[#006685] text-[#006685]'
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

function PatientHeader({ patient, backHref }: { patient: PatientInfo; backHref: string }) {
  return (
    <div className="flex items-center gap-4 mb-0">
      <Link
        href={backHref}
        className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-500"
      >
        <Icon name="arrow_back" size={20} />
      </Link>
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 font-bold text-base select-none"
        style={{ background: '#e5eeff', color: '#006685' }}
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

// ─── stat card ───────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string; color?: string }) {
  return (
    <div className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl shadow-sm p-5 flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#e5eeff' }}>
        <Icon name={icon} size={18} color="#006685" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 font-medium mb-1">{label}</p>
        <p className="text-base font-semibold text-[#0b1c30] truncate" style={color ? { color } : {}}>{value}</p>
      </div>
    </div>
  )
}

// ─── Quick create modals ────────────────────────────────────────────────────

interface Medication { name: string; dosage: string; frequency: string; duration: string }

function QuickNoteModal({ patientId, practitionerId, onClose }: { patientId: string; practitionerId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [content, setContent] = useState('')
  const [noteType, setNoteType] = useState('observation')
  const save = useMutation({
    mutationFn: async () => {
      if (!content.trim()) throw new Error('Contenu requis')
      const { error } = await supabase.from('practitioner_notes').insert({
        patient_id: patientId, practitioner_id: practitionerId,
        note_type: noteType, content: content.trim(), is_shared_with_patient: false, tags: [],
      })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['practitioner-notes', patientId] }); onClose() },
  })
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-[#0b1c30] flex items-center gap-2">
            <Icon name="note_add" size={18} color="#006685" />Nouvelle note
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><Icon name="close" size={18} /></button>
        </div>
        <select value={noteType} onChange={e => setNoteType(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#0b1c30] focus:outline-none focus:border-[#006685]">
          {[['observation','Observation'],['compte_rendu','Compte-rendu'],['note_suivi','Note de suivi'],['bilan','Bilan'],['alerte','Alerte']].map(([v,l]) =>
            <option key={v} value={v}>{l}</option>
          )}
        </select>
        <textarea value={content} onChange={e => setContent(e.target.value)} rows={5}
          placeholder="Rédigez votre note ici…"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#0b1c30] focus:outline-none focus:border-[#006685] resize-none" />
        {save.error && <p className="text-xs text-red-600">{(save.error as Error).message}</p>}
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-slate-200 text-slate-600 hover:bg-slate-50">Annuler</button>
          <button onClick={() => save.mutate()} disabled={save.isPending}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60" style={{ background: '#006685' }}>
            {save.isPending ? '...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

function QuickPrescriptionModal({ patientId, practitionerId, onClose }: { patientId: string; practitionerId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [diagnosis, setDiagnosis] = useState('')
  const [meds, setMeds] = useState<Medication[]>([{ name: '', dosage: '', frequency: '', duration: '' }])
  const save = useMutation({
    mutationFn: async () => {
      const filled = meds.filter(m => m.name.trim())
      if (!filled.length) throw new Error('Au moins un médicament requis')
      const { error } = await supabase.from('prescriptions').insert({
        patient_id: patientId, practitioner_id: practitionerId,
        diagnosis: diagnosis.trim() || null, medications: filled, status: 'signed',
      })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['practitioner-prescriptions', patientId] }); onClose() },
  })
  const updateMed = (i: number, key: keyof Medication, val: string) =>
    setMeds(prev => prev.map((m, idx) => idx === i ? { ...m, [key]: val } : m))
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-[#0b1c30] flex items-center gap-2">
            <Icon name="receipt_long" size={18} color="#006685" />Nouvelle ordonnance
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><Icon name="close" size={18} /></button>
        </div>
        <input value={diagnosis} onChange={e => setDiagnosis(e.target.value)} placeholder="Diagnostic / Motif (optionnel)"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#0b1c30] focus:outline-none focus:border-[#006685]" />
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-600">Médicaments <span className="text-red-500">*</span></p>
          {meds.map((med, i) => (
            <div key={i} className="bg-[#f8f9ff] rounded-xl p-3 space-y-2 border border-slate-100">
              <div className="grid grid-cols-2 gap-2">
                {(['name','dosage','frequency','duration'] as (keyof Medication)[]).map(k => (
                  <input key={k} value={med[k]} onChange={e => updateMed(i, k, e.target.value)}
                    placeholder={{ name:'Médicament *', dosage:'Dosage', frequency:'Fréquence', duration:'Durée' }[k]}
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-[#0b1c30] bg-white focus:outline-none focus:border-[#006685]" />
                ))}
              </div>
              {i > 0 && <button onClick={() => setMeds(prev => prev.filter((_,idx) => idx !== i))} className="text-xs text-red-500 hover:underline">Supprimer</button>}
            </div>
          ))}
          <button onClick={() => setMeds(prev => [...prev, { name:'', dosage:'', frequency:'', duration:'' }])}
            className="text-xs text-[#006685] font-semibold hover:underline flex items-center gap-1">
            <Icon name="add" size={14} color="#006685" />Ajouter un médicament
          </button>
        </div>
        {save.error && <p className="text-xs text-red-600">{(save.error as Error).message}</p>}
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-slate-200 text-slate-600 hover:bg-slate-50">Annuler</button>
          <button onClick={() => save.mutate()} disabled={save.isPending}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60" style={{ background: '#006685' }}>
            {save.isPending ? '...' : 'Créer l\'ordonnance'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── skeleton ────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-12 bg-slate-100 rounded-xl" />
      <div className="grid grid-cols-2 gap-4">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-slate-100 rounded-xl" />)}
      </div>
      <div className="h-64 bg-slate-100 rounded-xl" />
    </div>
  )
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function PatientDossierPage() {
  const params = useParams()
  const patientId = params.patientId as string
  const [showNote, setShowNote] = useState(false)
  const [showPrescription, setShowPrescription] = useState(false)

  const { data, isLoading, error } = useDossier(patientId)

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <Skeleton />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <div className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl shadow-sm p-6 text-center">
          <Icon name="error" size={32} color="#ba1a1a" />
          <p className="mt-2 text-slate-600">{error?.message ?? 'Erreur de chargement'}</p>
        </div>
      </div>
    )
  }

  const { patient, appointments } = data
  const now = new Date()

  const total = appointments.length
  const completed = appointments.filter(a => a.status === 'completed').length
  const upcoming = appointments
    .filter(a => ['confirmed', 'pending'].includes(a.status) && new Date(a.scheduled_at) >= now)
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0]
  const lastCompleted = appointments
    .filter(a => a.status === 'completed')
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())[0]

  const recent = appointments.slice(0, 5)

  const { practitionerId } = data

  return (
    <div>
      {showNote && <QuickNoteModal patientId={patientId} practitionerId={practitionerId} onClose={() => setShowNote(false)} />}
      {showPrescription && <QuickPrescriptionModal patientId={patientId} practitionerId={practitionerId} onClose={() => setShowPrescription(false)} />}
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <PatientHeader patient={patient} backHref="/practitioner/patients" />
      <TabNav patientId={patientId} active="apercu" />

      <div className="mt-6 space-y-6">
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-4">
          <StatCard icon="calendar_month" label="Consultations totales" value={`${total}`} />
          <StatCard
            icon="check_circle"
            label="Consultations complétées"
            value={`${completed}`}
            color="#1d7a3a"
          />
          <StatCard
            icon="event_upcoming"
            label="Prochaine consultation"
            value={upcoming ? fmtShort(upcoming.scheduled_at) : '—'}
            color="#006685"
          />
          <StatCard
            icon="history"
            label="Dernière consultation"
            value={lastCompleted ? fmtShort(lastCompleted.scheduled_at) : '—'}
          />
        </div>

        {/* Recent appointments */}
        <div className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-[#0b1c30] mb-4 flex items-center gap-2">
            <Icon name="schedule" size={16} color="#006685" />
            Dernières consultations
          </h2>
          {recent.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">Aucune consultation enregistrée</p>
          ) : (
            <ol className="relative border-l-2 border-slate-200 space-y-4 ml-2">
              {recent.map(appt => {
                const st = statusColors(appt.status)
                return (
                  <li key={appt.id} className="ml-5 relative">
                    <span
                      className="absolute -left-[1.65rem] top-1 w-3 h-3 rounded-full border-2 border-white"
                      style={{ background: st.text }}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-slate-500">{fmt(appt.scheduled_at)}</span>
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ background: st.bg, color: st.text }}
                      >
                        {statusLabel(appt.status)}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                        {typeLabel(appt.type)}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </div>

        {/* Quick actions */}
        <div className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-[#0b1c30] mb-4 flex items-center gap-2">
            <Icon name="bolt" size={16} color="#006685" />
            Actions rapides
          </h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowNote(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ background: '#006685', color: '#ffffff' }}
            >
              <Icon name="note_add" size={16} color="#ffffff" />
              Nouvelle note
            </button>
            <button
              onClick={() => setShowPrescription(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Icon name="description" size={16} color="#006685" />
              Nouvelle ordonnance
            </button>
            <Link
              href={`/practitioner/patients/${patientId}/notes`}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
            >
              <Icon name="list_alt" size={16} color="#6f787e" />
              Voir toutes les notes
            </Link>
            <Link
              href={`/practitioner/patients/${patientId}/prescriptions`}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
            >
              <Icon name="receipt_long" size={16} color="#6f787e" />
              Voir toutes les ordonnances
            </Link>
          </div>
        </div>
      </div>
    </div>
    </div>
  )
}
