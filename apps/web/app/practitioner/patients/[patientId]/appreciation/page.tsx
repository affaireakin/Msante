'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

function Icon({ name, size = 18, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-symbols-outlined" style={{ fontSize: `${size}px`, color, lineHeight: 1, userSelect: 'none' }}>{name}</span>
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

interface PatientInfo { id: string; full_name: string; created_at: string }
interface ReviewRow { id: string; rating: number; comment: string | null; is_anonymous: boolean; created_at: string }
interface AppreciationData { patient: PatientInfo; reviews: ReviewRow[]; avgRating: number | null }

function useAppreciationData(patientId: string) {
  return useQuery<AppreciationData>({
    queryKey: ['practitioner-appreciation', patientId],
    enabled: !!patientId,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')
      const { data: pract, error: pErr } = await supabase.from('practitioners').select('id').eq('user_id', user.id).single()
      if (pErr || !pract) throw new Error('Profil praticien introuvable')

      const [{ data: patientData, error: ptErr }, { data: reviewsData, error: rErr }] = await Promise.all([
        supabase.from('users').select('id, full_name, created_at').eq('id', patientId).single(),
        supabase.from('appointment_reviews').select('id, rating, comment, is_anonymous, created_at')
          .eq('patient_id', patientId).eq('practitioner_id', pract.id)
          .order('created_at', { ascending: false }),
      ])
      if (ptErr) throw ptErr
      if (rErr) throw rErr

      const reviews = (reviewsData ?? []) as ReviewRow[]
      const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null

      return { patient: patientData as PatientInfo, reviews, avgRating }
    },
    staleTime: 3 * 60 * 1000,
  })
}

function TabNav({ patientId }: { patientId: string }) {
  const tabs = [
    { key: 'apercu',        label: 'Aperçu',       href: `/practitioner/patients/${patientId}` },
    { key: 'notes',         label: 'Notes',        href: `/practitioner/patients/${patientId}/notes` },
    { key: 'ordonnances',   label: 'Ordonnances',  href: `/practitioner/patients/${patientId}/prescriptions` },
    { key: 'appréciations', label: 'Appréciations', href: `/practitioner/patients/${patientId}/appreciation` },
    { key: 'parcours',      label: 'Parcours',     href: `/practitioner/patients/${patientId}/journey` },
  ]
  return (
    <div className="flex gap-0 border-b border-slate-200 mt-6 overflow-x-auto">
      {tabs.map(tab => (
        <Link key={tab.key} href={tab.href}
          className={`px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
            tab.key === 'appréciations' ? 'border-b-2 border-[#82d8ff] text-[#82d8ff]' : 'text-slate-500 hover:text-slate-700'
          }`}>{tab.label}</Link>
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
      <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 font-bold text-base select-none" style={{ background: '#e5eeff', color: '#82d8ff' }}>
        {initials(patient.full_name)}
      </div>
      <div>
        <h1 className="text-xl font-bold text-[#0b1c30]">{patient.full_name}</h1>
        <p className="text-sm text-slate-500">Patient depuis {fmt(patient.created_at)}</p>
      </div>
    </div>
  )
}

function StarRating({ rating, size = 18 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} className="material-symbols-outlined" style={{ fontSize: `${size}px`, color: n <= rating ? '#ffde5c' : '#e2e8f0', lineHeight: 1 }}>
          star
        </span>
      ))}
    </div>
  )
}

function ReviewCard({ review }: { review: ReviewRow }) {
  return (
    <div className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl shadow-sm p-5 space-y-2">
      <div className="flex items-center justify-between">
        <StarRating rating={review.rating} />
        <span className="text-xs text-slate-400">{fmt(review.created_at)}</span>
      </div>
      {review.comment && <p className="text-sm text-slate-600 italic">&laquo; {review.comment} &raquo;</p>}
      {review.is_anonymous && (
        <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
          <Icon name="visibility_off" size={11} color="#94a3b8" />
          Avis anonyme
        </span>
      )}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-12 bg-slate-100 rounded-xl" />
      <div className="h-24 bg-slate-100 rounded-xl" />
      {[1, 2, 3].map(i => <div key={i} className="h-20 bg-slate-100 rounded-xl" />)}
    </div>
  )
}

export default function PatientAppreciationPage() {
  const params = useParams()
  const patientId = params.patientId as string
  const { data, isLoading, error } = useAppreciationData(patientId)

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

  const { patient, reviews, avgRating } = data

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <PatientHeader patient={patient} patientId={patientId} />
      <TabNav patientId={patientId} />

      <div className="mt-6 space-y-4">
        {/* Average rating card */}
        {avgRating !== null && (
          <div className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl shadow-sm p-5 flex items-center gap-6">
            <div className="text-center">
              <p className="text-4xl font-black text-[#0b1c30]">{avgRating.toFixed(1)}</p>
              <StarRating rating={Math.round(avgRating)} size={20} />
              <p className="text-xs text-slate-400 mt-1">{reviews.length} avis</p>
            </div>
            <div className="flex-1 space-y-1">
              {[5, 4, 3, 2, 1].map(star => {
                const count = reviews.filter(r => r.rating === star).length
                const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0
                return (
                  <div key={star} className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 w-3">{star}</span>
                    <span className="material-symbols-outlined text-[#ffde5c]" style={{ fontSize: '12px', lineHeight: 1 }}>star</span>
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: '#ffde5c' }} />
                    </div>
                    <span className="text-xs text-slate-400 w-4 text-right">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {reviews.length === 0 ? (
          <div className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl shadow-sm p-10 text-center">
            <Icon name="star_border" size={40} color="#cbd5e1" />
            <p className="mt-3 text-slate-400 text-sm font-semibold">Aucune appréciation de ce patient</p>
            <p className="text-xs text-slate-400 mt-1">Les appréciations sont laissées par le patient après ses consultations</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">{reviews.length} appréciation{reviews.length !== 1 ? 's' : ''}</p>
            {reviews.map(review => <ReviewCard key={review.id} review={review} />)}
          </div>
        )}
      </div>
    </div>
  )
}
