'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
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

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')
}

function statusColors(status: string): { bg: string; text: string } {
  switch (status) {
    case 'draft':      return { bg: '#f1f5f9', text: '#475569' }
    case 'signed':     return { bg: '#e5eeff', text: '#006685' }
    case 'dispensed':  return { bg: '#dcfce7', text: '#1d7a3a' }
    case 'cancelled':  return { bg: '#ffdad6', text: '#ba1a1a' }
    default:           return { bg: '#f1f5f9', text: '#475569' }
  }
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: 'Brouillon',
    signed: 'Signée',
    dispensed: 'Délivrée',
    cancelled: 'Annulée',
  }
  return map[status] ?? status
}

function consultationTypeLabel(type: string | null): string {
  if (!type) return '—'
  const map: Record<string, string> = {
    video: 'Vidéo',
    audio: 'Audio',
    chat: 'Chat',
    in_person: 'En présentiel',
  }
  return map[type] ?? type
}

// ─── types ───────────────────────────────────────────────────────────────────

interface PatientInfo {
  id: string
  full_name: string
  created_at: string
}

interface Medication {
  name?: string
  [key: string]: unknown
}

interface PrescriptionRow {
  id: string
  diagnosis: string | null
  medications: Medication[] | null
  status: string
  created_at: string
  consultation_type: string | null
}

interface PrescriptionsData {
  patient: PatientInfo
  prescriptions: PrescriptionRow[]
}

// ─── data hook ───────────────────────────────────────────────────────────────

function usePrescriptionsData(patientId: string) {
  return useQuery<PrescriptionsData>({
    queryKey: ['practitioner-prescriptions', patientId],
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
        { data: rxData, error: rxErr },
      ] = await Promise.all([
        supabase.from('users').select('id, full_name, created_at').eq('id', patientId).single(),
        supabase
          .from('prescriptions')
          .select('id, diagnosis, medications, status, created_at, consultation_type')
          .eq('patient_id', patientId)
          .eq('practitioner_id', pract.id)
          .order('created_at', { ascending: false }),
      ])

      if (ptErr) throw ptErr
      if (rxErr) throw rxErr

      return {
        patient: patientData as PatientInfo,
        prescriptions: (rxData ?? []) as PrescriptionRow[],
      }
    },
    staleTime: 3 * 60 * 1000,
  })
}

// ─── tab nav ─────────────────────────────────────────────────────────────────

function TabNav({ patientId }: { patientId: string }) {
  const tabs = [
    { key: 'apercu',      label: 'Aperçu',      href: `/practitioner/patients/${patientId}` },
    { key: 'notes',       label: 'Notes',       href: `/practitioner/patients/${patientId}/notes` },
    { key: 'ordonnances', label: 'Ordonnances', href: `/practitioner/patients/${patientId}/prescriptions` },
    { key: 'parcours',    label: 'Parcours',    href: `/practitioner/patients/${patientId}/journey` },
  ]
  return (
    <div className="flex gap-0 border-b border-slate-200 mt-6">
      {tabs.map(tab => (
        <Link
          key={tab.key}
          href={tab.href}
          className={`px-5 py-3 text-sm font-medium transition-colors ${
            tab.key === 'ordonnances'
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

// ─── prescription card ────────────────────────────────────────────────────────

function PrescriptionCard({ rx }: { rx: PrescriptionRow }) {
  const { bg, text } = statusColors(rx.status)
  const medCount = Array.isArray(rx.medications) ? rx.medications.length : 0

  return (
    <div className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl shadow-sm p-5 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: bg, color: text }}
          >
            {statusLabel(rx.status)}
          </span>
          {rx.consultation_type && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
              {consultationTypeLabel(rx.consultation_type)}
            </span>
          )}
        </div>
        <span className="text-xs text-slate-400 shrink-0">{fmt(rx.created_at)}</span>
      </div>

      {rx.diagnosis && (
        <div className="flex items-start gap-2">
          <Icon name="medical_information" size={15} color="#006685" />
          <p className="text-sm text-[#0b1c30] font-medium">{rx.diagnosis}</p>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Icon name="medication" size={15} color="#6f787e" />
        <span className="text-sm text-slate-500">
          {medCount > 0
            ? `${medCount} médicament${medCount > 1 ? 's' : ''}`
            : 'Aucun médicament renseigné'}
        </span>
      </div>
    </div>
  )
}

// ─── skeleton ────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-12 bg-slate-100 rounded-xl" />
      {[1, 2, 3].map(i => <div key={i} className="h-28 bg-slate-100 rounded-xl" />)}
    </div>
  )
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function PatientPrescriptionsPage() {
  const params = useParams()
  const patientId = params.patientId as string

  const { data, isLoading, error } = usePrescriptionsData(patientId)

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

  const { patient, prescriptions } = data

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <PatientHeader patient={patient} patientId={patientId} />
      <TabNav patientId={patientId} />

      <div className="mt-6 space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            {prescriptions.length} ordonnance{prescriptions.length !== 1 ? 's' : ''}
          </p>
          <button
            onClick={() => alert("Créez une ordonnance depuis l'app mobile")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Icon name="add_circle" size={16} color="#006685" />
            Nouvelle ordonnance
          </button>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-3 bg-[#e5eeff] rounded-xl px-4 py-3">
          <Icon name="info" size={16} color="#006685" />
          <p className="text-xs text-[#006685]">
            La création d'ordonnances est disponible depuis l'application mobile M-Santé.
          </p>
        </div>

        {/* Prescriptions list */}
        {prescriptions.length === 0 ? (
          <div className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl shadow-sm p-10 text-center">
            <Icon name="receipt_long" size={36} color="#cbd5e1" />
            <p className="mt-3 text-slate-400 text-sm">Aucune ordonnance pour ce patient</p>
          </div>
        ) : (
          <div className="space-y-4">
            {prescriptions.map(rx => (
              <PrescriptionCard key={rx.id} rx={rx} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
