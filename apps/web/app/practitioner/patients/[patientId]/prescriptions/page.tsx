'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

function Icon({ name, size = 18, color }: { name: string; size?: number; color?: string }) {
  return (
    <span className="material-symbols-outlined" style={{ fontSize: `${size}px`, color, lineHeight: 1, userSelect: 'none' }}>
      {name}
    </span>
  )
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

function statusColors(status: string): { bg: string; text: string } {
  switch (status) {
    case 'draft':     return { bg: '#f1f5f9', text: '#475569' }
    case 'signed':    return { bg: '#e5eeff', text: '#006685' }
    case 'dispensed': return { bg: '#dcfce7', text: '#1d7a3a' }
    case 'cancelled': return { bg: '#ffdad6', text: '#ba1a1a' }
    default:          return { bg: '#f1f5f9', text: '#475569' }
  }
}

function statusLabel(status: string): string {
  const map: Record<string, string> = { draft: 'Brouillon', signed: 'Signée', dispensed: 'Délivrée', cancelled: 'Annulée' }
  return map[status] ?? status
}

interface PatientInfo { id: string; full_name: string; created_at: string }
interface Medication { name: string; dosage: string; frequency: string; duration: string; instructions?: string }
interface PrescriptionRow {
  id: string
  diagnosis: string | null
  medications: Medication[] | null
  instructions?: string | null
  valid_until?: string | null
  status: string
  consultation_type?: string | null
  created_at: string
}
interface PrescriptionsData { patient: PatientInfo; prescriptions: PrescriptionRow[]; practitionerId: string }

function usePrescriptionsData(patientId: string) {
  return useQuery<PrescriptionsData>({
    queryKey: ['practitioner-prescriptions', patientId],
    enabled: !!patientId,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')
      const { data: pract, error: pErr } = await supabase.from('practitioners').select('id').eq('user_id', user.id).single()
      if (pErr || !pract) throw new Error('Profil praticien introuvable')
      const [{ data: patientData, error: ptErr }, { data: rxData, error: rxErr }] = await Promise.all([
        supabase.from('users').select('id, full_name, created_at').eq('id', patientId).single(),
        supabase.from('prescriptions')
          .select('id, diagnosis, medications, status, created_at')
          .eq('patient_id', patientId).eq('practitioner_id', pract.id)
          .order('created_at', { ascending: false }),
      ])
      if (ptErr) throw ptErr
      if (rxErr) throw rxErr
      return { patient: patientData as PatientInfo, prescriptions: (rxData ?? []) as PrescriptionRow[], practitionerId: pract.id as string }
    },
    staleTime: 3 * 60 * 1000,
  })
}

// ─── Tab nav ─────────────────────────────────────────────────────────────────

function TabNav({ patientId }: { patientId: string }) {
  const tabs = [
    { key: 'apercu',        label: 'Aperçu',         href: `/practitioner/patients/${patientId}` },
    { key: 'notes',         label: 'Notes',           href: `/practitioner/patients/${patientId}/notes` },
    { key: 'ordonnances',   label: 'Ordonnances',     href: `/practitioner/patients/${patientId}/prescriptions` },
    { key: 'appréciations', label: 'Appréciations',   href: `/practitioner/patients/${patientId}/appreciation` },
    { key: 'parcours',      label: 'Parcours',        href: `/practitioner/patients/${patientId}/journey` },
  ]
  return (
    <div className="flex gap-0 border-b border-slate-200 mt-6 overflow-x-auto">
      {tabs.map(tab => (
        <Link key={tab.key} href={tab.href}
          className={`px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
            tab.key === 'ordonnances' ? 'border-b-2 border-[#006685] text-[#006685]' : 'text-slate-500 hover:text-slate-700'
          }`}
        >{tab.label}</Link>
      ))}
    </div>
  )
}

function PatientHeader({ patient, patientId }: { patient: PatientInfo; patientId: string }) {
  return (
    <div className="flex items-center gap-4 mb-0">
      <Link href={`/practitioner/patients/${patientId}`} className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-500">
        <Icon name="arrow_back" size={20} />
      </Link>
      <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 font-bold text-base select-none" style={{ background: '#e5eeff', color: '#006685' }}>
        {initials(patient.full_name)}
      </div>
      <div>
        <h1 className="text-xl font-bold text-[#0b1c30]">{patient.full_name}</h1>
        <p className="text-sm text-slate-500">Patient depuis {fmt(patient.created_at)}</p>
      </div>
    </div>
  )
}

// ─── Prescription card ────────────────────────────────────────────────────────

function PrescriptionCard({ rx }: { rx: PrescriptionRow }) {
  const [expanded, setExpanded] = useState(false)
  const { bg, text } = statusColors(rx.status)
  const meds = Array.isArray(rx.medications) ? rx.medications : []
  const typeLabel: Record<string, string> = { video: 'Vidéo', audio: 'Audio', chat: 'Chat', in_person: 'Présentiel' }

  return (
    <div className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl shadow-sm overflow-hidden">
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: bg, color: text }}>
              {statusLabel(rx.status)}
            </span>
            {rx.consultation_type && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                {typeLabel[rx.consultation_type] ?? rx.consultation_type}
              </span>
            )}
          </div>
          <span className="text-xs text-slate-400 shrink-0">{fmt(rx.created_at)}</span>
        </div>

        {rx.diagnosis && (
          <div className="flex items-start gap-2 mb-3">
            <Icon name="medical_information" size={15} color="#006685" />
            <p className="text-sm text-[#0b1c30] font-semibold">{rx.diagnosis}</p>
          </div>
        )}

        {meds.length > 0 && (
          <div className="space-y-1 mb-3">
            {meds.slice(0, expanded ? meds.length : 2).map((med, i) => (
              <div key={i} className="flex items-start gap-2 bg-[#f8f9ff] rounded-lg px-3 py-2">
                <Icon name="medication" size={14} color="#006685" />
                <div className="text-xs text-[#0b1c30]">
                  <span className="font-semibold">{med.name}</span>
                  {med.dosage && <span className="text-slate-500"> — {med.dosage}</span>}
                  {med.frequency && <span className="text-slate-400"> · {med.frequency}</span>}
                  {med.duration && <span className="text-slate-400"> · {med.duration}</span>}
                </div>
              </div>
            ))}
            {meds.length > 2 && (
              <button onClick={() => setExpanded(v => !v)} className="text-xs text-[#006685] font-semibold pl-2 hover:underline">
                {expanded ? 'Réduire' : `Voir ${meds.length - 2} médicament(s) de plus`}
              </button>
            )}
          </div>
        )}

        {rx.valid_until && (
          <p className="text-xs text-slate-400 flex items-center gap-1">
            <Icon name="event" size={12} color="#6f787e" />
            Valide jusqu&apos;au {fmt(rx.valid_until)}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Medication form row ──────────────────────────────────────────────────────

function MedRow({ med, onChange, onRemove }: { med: Medication; onChange: (m: Medication) => void; onRemove: () => void }) {
  const field = (key: keyof Medication) => (
    <input
      type="text"
      value={med[key]}
      onChange={e => onChange({ ...med, [key]: e.target.value })}
      placeholder={{ name: 'Médicament *', dosage: 'Dosage', frequency: 'Fréquence', duration: 'Durée', instructions: 'Remarques' }[key]}
      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-[#0b1c30] bg-white focus:outline-none focus:border-[#006685]"
    />
  )
  return (
    <div className="border border-slate-200 rounded-xl p-3 space-y-2 bg-[#f8f9ff] relative">
      <button onClick={onRemove} className="absolute top-2 right-2 p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
        <Icon name="close" size={14} />
      </button>
      <div className="grid grid-cols-2 gap-2 pr-6">
        {field('name')}
        {field('dosage')}
        {field('frequency')}
        {field('duration')}
      </div>
      {field('instructions')}
    </div>
  )
}

// ─── New prescription modal ───────────────────────────────────────────────────

function NewPrescriptionModal({ patientId, practitionerId, onClose }: { patientId: string; practitionerId: string; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [diagnosis, setDiagnosis] = useState('')
  const [medications, setMedications] = useState<Medication[]>([{ name: '', dosage: '', frequency: '', duration: '', instructions: '' }])
  const [instructions, setInstructions] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [status, setStatus] = useState<'draft' | 'signed'>('signed')
  const [consultationType, setConsultationType] = useState<string>('in_person')
  const [formError, setFormError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async () => {
      const filledMeds = medications.filter(m => m.name.trim())
      if (filledMeds.length === 0) throw new Error('Ajoutez au moins un médicament')
      const { error } = await supabase.from('prescriptions').insert({
        patient_id: patientId,
        practitioner_id: practitionerId,
        diagnosis: diagnosis.trim() || null,
        medications: filledMeds,
        status,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['practitioner-prescriptions', patientId] })
      onClose()
    },
    onError: (err: Error) => setFormError(err.message),
  })

  const addMed = () => setMedications(prev => [...prev, { name: '', dosage: '', frequency: '', duration: '', instructions: '' }])
  const updateMed = (i: number, m: Medication) => setMedications(prev => prev.map((x, idx) => idx === i ? m : x))
  const removeMed = (i: number) => setMedications(prev => prev.filter((_, idx) => idx !== i))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-[#0b1c30] flex items-center gap-2">
            <Icon name="receipt_long" size={18} color="#006685" />
            Nouvelle ordonnance
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {formError && <div className="text-sm text-[#ba1a1a] bg-[#ffdad6] rounded-lg px-3 py-2">{formError}</div>}

          {/* Diagnosis */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Diagnostic / Motif</label>
            <input type="text" value={diagnosis} onChange={e => setDiagnosis(e.target.value)} placeholder="Ex: Anxiété généralisée, Trouble du sommeil…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#0b1c30] bg-white focus:outline-none focus:border-[#006685]" />
          </div>

          {/* Type + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Type de consultation</label>
              <select value={consultationType} onChange={e => setConsultationType(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#0b1c30] bg-white focus:outline-none focus:border-[#006685]">
                <option value="in_person">Présentiel</option>
                <option value="video">Vidéo</option>
                <option value="audio">Audio</option>
                <option value="chat">Chat</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Statut</label>
              <select value={status} onChange={e => setStatus(e.target.value as 'draft' | 'signed')}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#0b1c30] bg-white focus:outline-none focus:border-[#006685]">
                <option value="signed">Signée</option>
                <option value="draft">Brouillon</option>
              </select>
            </div>
          </div>

          {/* Medications */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-600">Médicaments <span className="text-[#ba1a1a]">*</span></label>
              <button onClick={addMed} className="flex items-center gap-1 text-xs font-semibold text-[#006685] hover:underline">
                <Icon name="add" size={14} color="#006685" />Ajouter
              </button>
            </div>
            <div className="space-y-2">
              {medications.map((med, i) => (
                <MedRow key={i} med={med} onChange={m => updateMed(i, m)} onRemove={() => removeMed(i)} />
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Instructions générales <span className="font-normal text-slate-400">(optionnel)</span></label>
            <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={2}
              placeholder="Ex: À prendre avec les repas, éviter l'alcool…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#0b1c30] bg-white focus:outline-none focus:border-[#006685] resize-none" />
          </div>

          {/* Valid until */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Valide jusqu&apos;au <span className="font-normal text-slate-400">(optionnel)</span></label>
            <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#0b1c30] bg-white focus:outline-none focus:border-[#006685]" />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
            Annuler
          </button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-60 flex items-center gap-2"
            style={{ background: '#006685' }}>
            {mutation.isPending ? 'Enregistrement…' : (<><Icon name="receipt_long" size={15} color="#fff" />Créer l&apos;ordonnance</>)}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-12 bg-slate-100 rounded-xl" />
      {[1, 2, 3].map(i => <div key={i} className="h-28 bg-slate-100 rounded-xl" />)}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PatientPrescriptionsPage() {
  const params = useParams()
  const patientId = params.patientId as string
  const [showModal, setShowModal] = useState(false)

  const { data, isLoading, error } = usePrescriptionsData(patientId)

  if (isLoading) return <div className="p-8 max-w-4xl mx-auto"><Skeleton /></div>

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

  const { patient, prescriptions, practitionerId } = data

  return (
    <>
      {showModal && (
        <NewPrescriptionModal patientId={patientId} practitionerId={practitionerId} onClose={() => setShowModal(false)} />
      )}

      <div className="p-8 max-w-4xl mx-auto">
        <PatientHeader patient={patient} patientId={patientId} />
        <TabNav patientId={patientId} />

        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{prescriptions.length} ordonnance{prescriptions.length !== 1 ? 's' : ''}</p>
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
              style={{ background: '#006685' }}>
              <Icon name="add_circle" size={16} color="#ffffff" />
              Nouvelle ordonnance
            </button>
          </div>

          {prescriptions.length === 0 ? (
            <div className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl shadow-sm p-10 text-center">
              <Icon name="receipt_long" size={36} color="#cbd5e1" />
              <p className="mt-3 text-slate-400 text-sm">Aucune ordonnance pour ce patient</p>
              <button onClick={() => setShowModal(true)} className="mt-4 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: '#006685' }}>
                Créer une ordonnance
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {prescriptions.map(rx => <PrescriptionCard key={rx.id} rx={rx} />)}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
