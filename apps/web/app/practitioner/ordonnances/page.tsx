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

function statusColors(status: string) {
  switch (status) {
    case 'draft':     return { bg: '#f1f5f9', text: '#475569' }
    case 'signed':    return { bg: '#e5eeff', text: '#006685' }
    case 'dispensed': return { bg: '#dcfce7', text: '#1d7a3a' }
    case 'cancelled': return { bg: '#ffdad6', text: '#ba1a1a' }
    default:          return { bg: '#f1f5f9', text: '#475569' }
  }
}

function statusLabel(status: string) {
  return ({ draft: 'Brouillon', signed: 'Signée', dispensed: 'Délivrée', cancelled: 'Annulée' })[status] ?? status
}

interface Medication { name: string; dosage?: string; frequency?: string; duration?: string }
interface RxRow {
  id: string
  diagnosis: string | null
  medications: Medication[] | null
  status: string
  created_at: string
  patient_id: string
  patient_name: string
}

function usePractitionerType() {
  return useQuery<'healthcare' | 'wellness'>({
    queryKey: ['practitioner-type-self'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return 'healthcare'
      const { data } = await supabase.from('practitioners').select('practitioner_type').eq('user_id', user.id).single()
      return ((data?.practitioner_type ?? 'healthcare') as 'healthcare' | 'wellness')
    },
    staleTime: 10 * 60 * 1000,
  })
}

function useAllPrescriptions() {
  return useQuery<RxRow[]>({
    queryKey: ['all-prescriptions'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')
      const { data: pract, error: pErr } = await supabase.from('practitioners').select('id').eq('user_id', user.id).single()
      if (pErr || !pract) throw new Error('Profil praticien introuvable')

      const { data, error } = await supabase
        .from('prescriptions')
        .select('id, diagnosis, medications, status, created_at, patient_id, patient:patient_id(full_name)')
        .eq('practitioner_id', pract.id)
        .order('created_at', { ascending: false })
      if (error) throw error

      return (data ?? []).map(r => ({
        id: r.id,
        diagnosis: r.diagnosis,
        medications: r.medications as Medication[],
        status: r.status,
        created_at: r.created_at,
        patient_id: r.patient_id,
        patient_name: (r.patient as unknown as { full_name: string })?.full_name ?? 'Inconnu',
      }))
    },
    staleTime: 2 * 60 * 1000,
  })
}

const ALL_STATUSES = ['all', 'draft', 'signed', 'dispensed', 'cancelled'] as const
type StatusFilter = typeof ALL_STATUSES[number]

function Skeleton() {
  return <div className="space-y-3 animate-pulse">{[1,2,3,4,5].map(i => <div key={i} className="h-20 bg-slate-100 rounded-xl" />)}</div>
}

export default function AllPrescriptionsPage() {
  const { data: prescriptions = [], isLoading, error } = useAllPrescriptions()
  const { data: practitionerType = 'healthcare' } = usePractitionerType()
  const isWellness = practitionerType === 'wellness'
  const docLabel = isWellness ? 'Recommandations' : 'Ordonnances'
  const docLabelSingle = isWellness ? 'recommandation' : 'ordonnance'
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')

  const filtered = prescriptions.filter(rx => {
    if (statusFilter !== 'all' && rx.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return rx.patient_name.toLowerCase().includes(q) || (rx.diagnosis ?? '').toLowerCase().includes(q)
    }
    return true
  })

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#0b1c30] tracking-tight">{docLabel}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{`Toutes vos ${docLabel.toLowerCase()} patients`}</p>
        </div>
        <Link href="/practitioner/patients"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors">
          <Icon name="person_search" size={16} color="#006685" />
          Par patient
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder={`Rechercher un patient ou ${isWellness ? 'objectif' : 'diagnostic'}…`}
          className="flex-1 px-4 py-2.5 rounded-xl text-sm border border-slate-200 text-[#0b1c30] bg-white/80 focus:outline-none focus:border-[#006685]" />
        <div className="flex gap-1.5 flex-wrap">
          {ALL_STATUSES.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className="px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
              style={{
                backgroundColor: statusFilter === s ? '#006685' : 'rgba(255,255,255,0.70)',
                color: statusFilter === s ? '#fff' : '#475569',
                border: '1px solid',
                borderColor: statusFilter === s ? '#006685' : 'rgba(190,200,206,0.40)',
              }}>
              {s === 'all' ? 'Tous' : statusLabel(s)}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: prescriptions.length, color: '#006685', bg: '#e5eeff' },
          { label: 'Signées', value: prescriptions.filter(r => r.status === 'signed').length, color: '#006685', bg: '#e5eeff' },
          { label: 'Délivrées', value: prescriptions.filter(r => r.status === 'dispensed').length, color: '#1d7a3a', bg: '#dcfce7' },
          { label: 'Brouillons', value: prescriptions.filter(r => r.status === 'draft').length, color: '#475569', bg: '#f1f5f9' },
        ].map(stat => (
          <div key={stat.label} className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl p-4 text-center">
            <p className="text-xl font-black" style={{ color: stat.color }}>{stat.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* List */}
      {isLoading ? <Skeleton /> : error ? (
        <div className="bg-white/60 border border-white/80 rounded-xl p-6 text-center">
          <Icon name="error" size={32} color="#ba1a1a" />
          <p className="mt-2 text-slate-600">{(error as Error).message}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white/60 border border-white/80 rounded-xl p-10 text-center">
          <Icon name={isWellness ? 'tips_and_updates' : 'receipt_long'} size={40} color="#cbd5e1" />
          <p className="mt-3 text-slate-400 text-sm">{`Aucune ${docLabelSingle} trouvée`}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(rx => {
            const { bg, text } = statusColors(rx.status)
            const meds = Array.isArray(rx.medications) ? rx.medications : []
            return (
              <Link key={rx.id} href={`/practitioner/patients/${rx.patient_id}/prescriptions`}
                className="block bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#e5eeff] flex items-center justify-center text-[#006685] text-sm font-bold flex-shrink-0">
                    {initials(rx.patient_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-[#0b1c30]">{rx.patient_name}</p>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: bg, color: text }}>
                        {statusLabel(rx.status)}
                      </span>
                    </div>
                    {rx.diagnosis && <p className="text-xs text-slate-500 mt-0.5 truncate">{rx.diagnosis}</p>}
                    {meds.length > 0 && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        {meds.slice(0, 3).map(m => m.name).filter(Boolean).join(', ')}
                        {meds.length > 3 && ` +${meds.length - 3}`}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0">{fmt(rx.created_at)}</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
