'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
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
  patient_id: string
  diagnosis: string | null
  medications: Medication[] | null
  instructions?: string | null
  valid_until?: string | null
  status: string
  consultation_type?: string | null
  created_at: string
}
interface PrescriptionsData { patient: PatientInfo; prescriptions: PrescriptionRow[]; practitionerId: string; practitionerType: 'healthcare' | 'wellness' }

function usePrescriptionsData(patientId: string) {
  return useQuery<PrescriptionsData>({
    queryKey: ['practitioner-prescriptions', patientId],
    enabled: !!patientId,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')
      const { data: pract, error: pErr } = await supabase.from('practitioners').select('id, practitioner_type').eq('user_id', user.id).single()
      if (pErr || !pract) throw new Error('Profil praticien introuvable')
      const [{ data: patientData, error: ptErr }, { data: rxData, error: rxErr }] = await Promise.all([
        supabase.from('users').select('id, full_name, created_at').eq('id', patientId).single(),
        supabase.from('prescriptions')
          .select('id, patient_id, diagnosis, medications, instructions, valid_until, status, consultation_type, created_at')
          .eq('patient_id', patientId).eq('practitioner_id', pract.id)
          .order('created_at', { ascending: false }),
      ])
      if (ptErr) throw ptErr
      if (rxErr) throw rxErr
      return { patient: patientData as PatientInfo, prescriptions: (rxData ?? []) as PrescriptionRow[], practitionerId: pract.id as string, practitionerType: (pract.practitioner_type ?? 'healthcare') as 'healthcare' | 'wellness' }
    },
    staleTime: 3 * 60 * 1000,
  })
}

// ─── Tab nav ─────────────────────────────────────────────────────────────────

function TabNav({ patientId, practitionerType }: { patientId: string; practitionerType?: 'healthcare' | 'wellness' }) {
  const docsLabel = practitionerType === 'wellness' ? 'Recommandations' : 'Ordonnances'
  const tabs = [
    { key: 'apercu',        label: 'Aperçu',       href: `/practitioner/patients/${patientId}` },
    { key: 'notes',         label: 'Notes',         href: `/practitioner/patients/${patientId}/notes` },
    { key: 'ordonnances',   label: docsLabel,        href: `/practitioner/patients/${patientId}/prescriptions` },
    { key: 'appréciations', label: 'Appréciations', href: `/practitioner/patients/${patientId}/appreciation` },
    { key: 'parcours',      label: 'Parcours',      href: `/practitioner/patients/${patientId}/journey` },
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

function PrescriptionCard({ rx, patientId, practitionerType }: { rx: PrescriptionRow; patientId: string; practitionerType: 'healthcare' | 'wellness' }) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const { bg, text } = statusColors(rx.status)
  const meds = Array.isArray(rx.medications) ? rx.medications : []
  const typeLabel: Record<string, string> = { video: 'Vidéo', audio: 'Audio', chat: 'Chat', presentiel: 'Présentiel', standalone: 'Hors consultation' }

  const signMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('prescriptions').update({ status: 'signed' }).eq('id', rx.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['practitioner-prescriptions', patientId] }),
  })

  const sendMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')
      await supabase.from('notifications').insert({
        user_id: rx.patient_id,
        type: 'prescription_sent',
        title: practitionerType === 'wellness' ? 'Nouvelle recommandation disponible 📋' : 'Nouvelle ordonnance disponible 📋',
        body: practitionerType === 'wellness' ? 'Votre praticien a émis une recommandation. Consultez-la dans votre espace santé.' : 'Votre médecin a émis une ordonnance. Consultez-la dans votre espace santé.',
        data: { prescription_id: rx.id, route: '/patient/prescriptions' },
        channel: 'push',
        status: 'pending',
      })
    },
    onSuccess: () => alert(practitionerType === 'wellness' ? 'Recommandation envoyée au patient.' : 'Ordonnance envoyée au patient.'),
  })

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
          <p className="text-xs text-slate-400 flex items-center gap-1 mb-3">
            <Icon name="event" size={12} color="#6f787e" />
            Valide jusqu&apos;au {fmt(rx.valid_until)}
          </p>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
          <button
            onClick={() => router.push(`/practitioner/patients/${patientId}/prescriptions/${rx.id}/print`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#006685] bg-[#e5eeff] hover:bg-[#d3e4fe] transition-colors"
          >
            <Icon name="print" size={14} color="#006685" />Imprimer / PDF
          </button>

          {rx.status === 'draft' && (
            <button
              onClick={() => signMutation.mutate()}
              disabled={signMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#1d7a3a] bg-[#dcfce7] hover:bg-[#bbf7d0] transition-colors disabled:opacity-50"
            >
              <Icon name="draw" size={14} color="#1d7a3a" />
              {signMutation.isPending ? 'Signature…' : 'Signer'}
            </button>
          )}

          {rx.status === 'signed' && (
            <button
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors disabled:opacity-50"
              style={{ background: '#006685' }}
            >
              <Icon name="send" size={14} color="#fff" />
              {sendMutation.isPending ? 'Envoi…' : 'Envoyer au patient'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Base médicaments (DCI + spécialités courantes) ──────────────────────────

const DRUGS: { name: string; dosages: string[] }[] = [
  // Psychotropes — antidépresseurs
  { name: 'Sertraline', dosages: ['50 mg', '100 mg'] },
  { name: 'Fluoxétine', dosages: ['20 mg'] },
  { name: 'Escitalopram', dosages: ['10 mg', '20 mg'] },
  { name: 'Citalopram', dosages: ['20 mg', '40 mg'] },
  { name: 'Paroxétine', dosages: ['20 mg', '40 mg'] },
  { name: 'Venlafaxine', dosages: ['75 mg', '150 mg'] },
  { name: 'Duloxétine', dosages: ['30 mg', '60 mg'] },
  { name: 'Mirtazapine', dosages: ['15 mg', '30 mg'] },
  { name: 'Amitriptyline', dosages: ['25 mg', '50 mg'] },
  { name: 'Clomipramine', dosages: ['25 mg', '75 mg'] },
  { name: 'Imipramine', dosages: ['25 mg', '50 mg'] },
  { name: 'Trazodone', dosages: ['50 mg', '100 mg'] },
  { name: 'Bupropion', dosages: ['150 mg', '300 mg'] },
  // Anxiolytiques / Hypnotiques
  { name: 'Alprazolam', dosages: ['0,25 mg', '0,5 mg', '1 mg'] },
  { name: 'Bromazépam', dosages: ['6 mg'] },
  { name: 'Diazépam', dosages: ['5 mg', '10 mg'] },
  { name: 'Lorazépam', dosages: ['1 mg', '2,5 mg'] },
  { name: 'Oxazépam', dosages: ['10 mg', '50 mg'] },
  { name: 'Clonazépam', dosages: ['0,5 mg', '2 mg'] },
  { name: 'Hydroxyzine', dosages: ['25 mg', '100 mg'] },
  { name: 'Buspirone', dosages: ['10 mg', '15 mg'] },
  { name: 'Zolpidem', dosages: ['10 mg'] },
  { name: 'Zopiclone', dosages: ['7,5 mg'] },
  { name: 'Prégabaline', dosages: ['75 mg', '150 mg', '300 mg'] },
  // Antipsychotiques
  { name: 'Halopéridol', dosages: ['1 mg', '5 mg'] },
  { name: 'Rispéridone', dosages: ['1 mg', '2 mg', '4 mg'] },
  { name: 'Olanzapine', dosages: ['5 mg', '10 mg'] },
  { name: 'Quétiapine', dosages: ['25 mg', '100 mg', '200 mg'] },
  { name: 'Aripiprazole', dosages: ['5 mg', '10 mg', '15 mg'] },
  { name: 'Clozapine', dosages: ['25 mg', '100 mg'] },
  { name: 'Chlorpromazine', dosages: ['25 mg', '100 mg'] },
  { name: 'Lévomépromazine', dosages: ['25 mg', '100 mg'] },
  { name: 'Amisulpride', dosages: ['50 mg', '200 mg', '400 mg'] },
  { name: 'Ziprasidone', dosages: ['40 mg', '80 mg'] },
  // Stabilisateurs d'humeur
  { name: 'Lithium (carbonate)', dosages: ['250 mg', '400 mg'] },
  { name: 'Valproate de sodium', dosages: ['200 mg', '500 mg'] },
  { name: 'Carbamazépine', dosages: ['200 mg', '400 mg'] },
  { name: 'Lamotrigine', dosages: ['25 mg', '50 mg', '100 mg'] },
  // TDAH
  { name: 'Méthylphénidate', dosages: ['10 mg', '20 mg'] },
  { name: 'Atomoxétine', dosages: ['18 mg', '40 mg', '80 mg'] },
  // Analgésiques / Anti-inflammatoires
  { name: 'Paracétamol', dosages: ['500 mg', '1000 mg'] },
  { name: 'Ibuprofène', dosages: ['200 mg', '400 mg', '600 mg'] },
  { name: 'Aspirine', dosages: ['100 mg', '500 mg'] },
  { name: 'Tramadol', dosages: ['50 mg', '100 mg'] },
  { name: 'Codéine', dosages: ['20 mg', '30 mg'] },
  { name: 'Diclofénac', dosages: ['50 mg', '75 mg'] },
  { name: 'Kétoprofène', dosages: ['100 mg'] },
  { name: 'Néfopam', dosages: ['20 mg'] },
  // Antibiotiques
  { name: 'Amoxicilline', dosages: ['500 mg', '1 g'] },
  { name: 'Amoxicilline + Acide clavulanique', dosages: ['875/125 mg'] },
  { name: 'Azithromycine', dosages: ['250 mg', '500 mg'] },
  { name: 'Doxycycline', dosages: ['100 mg'] },
  { name: 'Ciprofloxacine', dosages: ['250 mg', '500 mg'] },
  { name: 'Métronidazole', dosages: ['250 mg', '500 mg'] },
  { name: 'Cotrimoxazole', dosages: ['480 mg', '960 mg'] },
  { name: 'Céfixime', dosages: ['200 mg', '400 mg'] },
  { name: 'Doxycycline', dosages: ['100 mg'] },
  // Antipaludéens
  { name: 'Artéméther + Luméfantrine (Coartem)', dosages: ['20/120 mg'] },
  { name: 'Artésunate', dosages: ['50 mg', '100 mg'] },
  { name: 'Quinine', dosages: ['300 mg', '500 mg'] },
  { name: 'Chloroquine', dosages: ['150 mg'] },
  { name: 'Méfloquine', dosages: ['250 mg'] },
  // Antihypertenseurs
  { name: 'Amlodipine', dosages: ['5 mg', '10 mg'] },
  { name: 'Lisinopril', dosages: ['5 mg', '10 mg', '20 mg'] },
  { name: 'Losartan', dosages: ['50 mg', '100 mg'] },
  { name: 'Aténolol', dosages: ['25 mg', '50 mg'] },
  { name: 'Bisoprolol', dosages: ['2,5 mg', '5 mg', '10 mg'] },
  { name: 'Hydrochlorothiazide', dosages: ['12,5 mg', '25 mg'] },
  { name: 'Furosémide', dosages: ['20 mg', '40 mg'] },
  // Antidiabétiques
  { name: 'Metformine', dosages: ['500 mg', '850 mg', '1000 mg'] },
  { name: 'Glibenclamide', dosages: ['5 mg'] },
  { name: 'Sitagliptine', dosages: ['100 mg'] },
  // Digestif / Gastro
  { name: 'Oméprazole', dosages: ['20 mg', '40 mg'] },
  { name: 'Pantoprazole', dosages: ['20 mg', '40 mg'] },
  { name: 'Ranitidine', dosages: ['150 mg'] },
  { name: 'Métoclopramide', dosages: ['10 mg'] },
  { name: 'Dompéridone', dosages: ['10 mg'] },
  { name: 'Lopéramide', dosages: ['2 mg'] },
  { name: 'Trimébutine', dosages: ['100 mg'] },
  // Vitamines / Suppléments
  { name: 'Vitamine D3', dosages: ['800 UI', '1000 UI', '2000 UI'] },
  { name: 'Vitamine B12', dosages: ['1000 µg'] },
  { name: 'Magnésium', dosages: ['100 mg', '300 mg'] },
  { name: 'Fer (sulfate ferreux)', dosages: ['80 mg', '200 mg'] },
  { name: 'Acide folique', dosages: ['0,4 mg', '5 mg'] },
  { name: 'Zinc', dosages: ['15 mg', '60 mg'] },
  // Respiratoire
  { name: 'Salbutamol', dosages: ['2 mg', '4 mg', '100 µg/dose'] },
  { name: 'Béclométasone', dosages: ['100 µg', '200 µg'] },
  { name: 'Ipratropium', dosages: ['20 µg/dose'] },
  { name: 'Prednisolone', dosages: ['5 mg', '20 mg', '40 mg'] },
  // Antihistaminiques
  { name: 'Cétirizine', dosages: ['5 mg', '10 mg'] },
  { name: 'Loratadine', dosages: ['10 mg'] },
  { name: 'Desloratadine', dosages: ['5 mg'] },
  { name: 'Bilastine', dosages: ['20 mg'] },
]

// ─── Drug autocomplete ────────────────────────────────────────────────────────

function DrugSearch({ value, onChange }: { value: string; onChange: (name: string, dosage?: string) => void }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState(value)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { setQ(value) }, [value])

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const matches = q.trim().length >= 2
    ? DRUGS.filter(d => d.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8)
    : []

  const vidalUrl = value.trim()
    ? `https://www.vidal.fr/medicaments/recherche/?q=${encodeURIComponent(value.trim())}`
    : null

  return (
    <div ref={ref} className="relative">
      <div className="flex gap-1">
        <div className="relative flex-1">
          <input
            type="text"
            value={q}
            placeholder="Médicament (DCI ou nom) *"
            onChange={e => { setQ(e.target.value); onChange(e.target.value); setOpen(true) }}
            onFocus={() => { if (matches.length > 0) setOpen(true) }}
            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-[#0b1c30] bg-white focus:outline-none focus:border-[#006685]"
          />
          {q.trim().length >= 2 && matches.length === 0 && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">Aucun résultat</span>
          )}
        </div>
        {vidalUrl && (
          <a href={vidalUrl} target="_blank" rel="noopener noreferrer"
            title="Consulter la fiche Vidal"
            className="flex items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors whitespace-nowrap"
            style={{ borderColor: '#006685', color: '#006685', background: '#e5eeff' }}>
            <Icon name="open_in_new" size={11} color="#006685" />
            Vidal
          </a>
        )}
      </div>

      {open && matches.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden text-xs max-h-52 overflow-y-auto">
          {matches.map(drug => (
            <li key={drug.name}>
              <button
                type="button"
                onMouseDown={e => {
                  e.preventDefault()
                  onChange(drug.name, drug.dosages[0])
                  setQ(drug.name)
                  setOpen(false)
                }}
                className="w-full text-left px-3 py-2 hover:bg-[#e5eeff] transition-colors flex items-center justify-between gap-2"
              >
                <span className="font-medium text-[#0b1c30]">{drug.name}</span>
                <span className="text-slate-400 text-[10px] shrink-0">{drug.dosages.join(' · ')}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Medication form row ──────────────────────────────────────────────────────

function MedRow({ med, onChange, onRemove }: { med: Medication; onChange: (m: Medication) => void; onRemove: () => void }) {
  const field = (key: Exclude<keyof Medication, 'name'>) => (
    <input
      type="text"
      value={med[key] ?? ''}
      onChange={e => onChange({ ...med, [key]: e.target.value })}
      placeholder={{ dosage: 'Dosage', frequency: 'Fréquence', duration: 'Durée', instructions: 'Remarques' }[key]}
      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-[#0b1c30] bg-white focus:outline-none focus:border-[#006685]"
    />
  )
  return (
    <div className="border border-slate-200 rounded-xl p-3 space-y-2 bg-[#f8f9ff] relative">
      <button onClick={onRemove} className="absolute top-2 right-2 p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
        <Icon name="close" size={14} />
      </button>
      <div className="pr-6">
        <DrugSearch
          value={med.name}
          onChange={(name, dosage) => onChange({ ...med, name, ...(dosage && !med.dosage ? { dosage } : {}) })}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {field('dosage')}
        {field('frequency')}
        {field('duration')}
        {field('instructions')}
      </div>
    </div>
  )
}

// ─── New prescription modal ───────────────────────────────────────────────────

function NewPrescriptionModal({ patientId, practitionerId, practitionerType, onClose }: { patientId: string; practitionerId: string; practitionerType: 'healthcare' | 'wellness'; onClose: () => void }) {
  const queryClient = useQueryClient()
  const isWellness = practitionerType === 'wellness'
  const [diagnosis, setDiagnosis] = useState('')
  const [medications, setMedications] = useState<Medication[]>([{ name: '', dosage: '', frequency: '', duration: '', instructions: '' }])
  const [instructions, setInstructions] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [status, setStatus] = useState<'draft' | 'signed'>('signed')
  const [consultationType, setConsultationType] = useState<string>('presentiel')
  const [formError, setFormError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async () => {
      if (isWellness) {
        if (!instructions.trim()) throw new Error('Ajoutez au moins un conseil ou une recommandation')
        const { error } = await supabase.from('prescriptions').insert({
          patient_id: patientId,
          practitioner_id: practitionerId,
          diagnosis: diagnosis.trim() || null,
          medications: [],
          instructions: instructions.trim(),
          valid_until: validUntil || null,
          status,
          consultation_type: consultationType,
          document_type: 'recommandation',
        })
        if (error) throw error
      } else {
        const filledMeds = medications.filter(m => m.name.trim())
        if (filledMeds.length === 0) throw new Error('Ajoutez au moins un médicament')
        const { error } = await supabase.from('prescriptions').insert({
          patient_id: patientId,
          practitioner_id: practitionerId,
          diagnosis: diagnosis.trim() || null,
          medications: filledMeds,
          instructions: instructions.trim() || null,
          valid_until: validUntil || null,
          status,
          consultation_type: consultationType,
          document_type: 'ordonnance',
        })
        if (error) throw error
      }
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
            <Icon name={isWellness ? 'tips_and_updates' : 'receipt_long'} size={18} color="#006685" />
            {isWellness ? 'Nouvelle recommandation' : 'Nouvelle ordonnance'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {formError && <div className="text-sm text-[#ba1a1a] bg-[#ffdad6] rounded-lg px-3 py-2">{formError}</div>}

          {/* Diagnosis / Objectif */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              {isWellness ? 'Objectif / Contexte' : 'Diagnostic / Motif'}
            </label>
            <input type="text" value={diagnosis} onChange={e => setDiagnosis(e.target.value)}
              placeholder={isWellness ? 'Ex: Perte de poids, Gestion du stress, Amélioration du sommeil…' : 'Ex: Anxiété généralisée, Trouble du sommeil…'}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#0b1c30] bg-white focus:outline-none focus:border-[#006685]" />
          </div>

          {/* Type + Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Type de consultation</label>
              <select value={consultationType} onChange={e => setConsultationType(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#0b1c30] bg-white focus:outline-none focus:border-[#006685]">
                <option value="presentiel">Présentiel</option>
                <option value="video">Vidéo</option>
                <option value="audio">Audio</option>
                <option value="chat">Chat</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Statut</label>
              <select value={status} onChange={e => setStatus(e.target.value as 'draft' | 'signed')}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#0b1c30] bg-white focus:outline-none focus:border-[#006685]">
                <option value="signed">Signé(e)</option>
                <option value="draft">Brouillon</option>
              </select>
            </div>
          </div>

          {/* Wellness: Conseils textarea / Healthcare: Medications */}
          {isWellness ? (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Conseils &amp; Recommandations <span className="text-[#ba1a1a]">*</span>
              </label>
              <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={6}
                placeholder={'Ex:\n• Adopter une alimentation équilibrée riche en légumes\n• 30 min de marche par jour\n• Limiter les écrans après 21h\n• Techniques de respiration 4-7-8 au coucher'}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#0b1c30] bg-white focus:outline-none focus:border-[#006685] resize-none" />
              <p className="text-xs text-slate-400 mt-1">Rédigez vos conseils sous forme de liste ou de paragraphes.</p>
            </div>
          ) : (
            <>
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
            </>
          )}

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
            {mutation.isPending ? 'Enregistrement…' : (
              <><Icon name={isWellness ? 'tips_and_updates' : 'receipt_long'} size={15} color="#fff" />{isWellness ? 'Créer la recommandation' : 'Créer l\'ordonnance'}</>
            )}
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

  const { patient, prescriptions, practitionerId, practitionerType } = data
  const isWellness = practitionerType === 'wellness'
  const docLabel = isWellness ? 'recommandation' : 'ordonnance'
  const docLabelPlural = isWellness ? 'recommandations' : 'ordonnances'

  return (
    <>
      {showModal && (
        <NewPrescriptionModal patientId={patientId} practitionerId={practitionerId} practitionerType={practitionerType} onClose={() => setShowModal(false)} />
      )}

      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <PatientHeader patient={patient} patientId={patientId} />
        <TabNav patientId={patientId} practitionerType={practitionerType} />

        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{prescriptions.length} {prescriptions.length !== 1 ? docLabelPlural : docLabel}</p>
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
              style={{ background: '#006685' }}>
              <Icon name="add_circle" size={16} color="#ffffff" />
              {`Nouvelle ${docLabel}`}
            </button>
          </div>

          {prescriptions.length === 0 ? (
            <div className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl shadow-sm p-10 text-center">
              <Icon name="receipt_long" size={36} color="#cbd5e1" />
              <p className="mt-3 text-slate-400 text-sm">{`Aucune ${docLabel} pour ce patient`}</p>
              <button onClick={() => setShowModal(true)} className="mt-4 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: '#006685' }}>
                {`Créer une ${docLabel}`}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {prescriptions.map((rx: PrescriptionRow) => <PrescriptionCard key={rx.id} rx={rx} patientId={patientId} practitionerType={practitionerType} />)}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
