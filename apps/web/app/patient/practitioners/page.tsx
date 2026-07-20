'use client'
import { Suspense, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span className="material-symbols-outlined" style={style}>{name}</span>
}

const SPECIALITIES = ['Tous', 'Psychologue', 'Psychiatre', 'Coach de vie', 'Thérapeute', 'Nutritionniste']

interface Practitioner {
  id: string
  speciality: string
  session_duration_min: number
  rating: number | null
  total_reviews: number
  bio: string | null
  languages: string[] | null
  professional_title: string | null
  accepting_new_patients: boolean
  users: { full_name: string } | null
  practitioner_services: { duration_min: number; is_active: boolean }[] | null
}

function usePractitioners(speciality: string, search: string) {
  return useQuery({
    queryKey: ['patient-practitioners', speciality, search],
    queryFn: async () => {
      let q = supabase
        .from('practitioners')
        .select('id, speciality, session_duration_min, rating, total_reviews, bio, languages, professional_title, accepting_new_patients, users!user_id(full_name), practitioner_services(duration_min, is_active)')
        .eq('verification_status', 'approved')
        .eq('accepting_new_patients', true)
        // Org-affiliated practitioners also need their organization's own
        // validation (double validation); independents are unaffected.
        .or('organization_id.is.null,org_validated_at.not.is.null')
        .order('rating', { ascending: false })

      if (speciality !== 'Tous') q = q.eq('speciality', speciality)
      if (search.trim()) q = q.ilike('users.full_name', `%${search.trim()}%`)

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as unknown as Practitioner[]
    },
  })
}

export default function PractitionersPage() {
  return (
    <Suspense fallback={null}>
      <PractitionersContent />
    </Suspense>
  )
}

function PractitionersContent() {
  const searchParams = useSearchParams()
  const [speciality, setSpeciality] = useState('Tous')
  const [search, setSearch] = useState(searchParams.get('search') ?? '')
  const [profileOf, setProfileOf] = useState<Practitioner | null>(null)
  const { data = [], isLoading } = usePractitioners(speciality, search)

  const initials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-black text-[#0b1c30]">Praticiens certifiés</h1>
        <p className="text-sm text-[#6f787e] mt-1">{data.length} praticiens disponibles</p>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex items-center gap-2 flex-1 bg-white/70 rounded-xl px-4 py-3 border border-slate-200/50">
          <Icon name="search" style={{ color: '#6f787e', fontSize: '20px' }} />
          <input
            type="text"
            placeholder="Rechercher par nom..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm text-[#0b1c30] placeholder-[#6f787e] outline-none"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {SPECIALITIES.map(s => (
            <button
              key={s}
              onClick={() => setSpeciality(s)}
              className="px-4 py-2 rounded-full text-xs font-bold transition-all"
              style={{
                backgroundColor: speciality === s ? '#82d8ff' : 'rgba(255,255,255,0.70)',
                color: speciality === s ? '#fff' : '#6f787e',
                border: speciality === s ? 'none' : '1px solid rgba(190,200,206,0.50)',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-48 rounded-2xl bg-white/40 animate-pulse" />)}
        </div>
      ) : data.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.60)', border: '1px solid rgba(255,255,255,0.80)' }}>
          <Icon name="person_search" style={{ fontSize: '48px', color: '#bec8ce' }} />
          <p className="font-semibold text-[#0b1c30] mt-3">Aucun praticien trouvé</p>
          <p className="text-sm text-[#6f787e] mt-1">Essayez une autre spécialité ou un autre nom</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.map(p => (
            <div key={p.id} className="rounded-2xl p-6 hover:shadow-xl hover:-translate-y-1 transition-all" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-full bg-[#82d8ff] flex items-center justify-center text-[#0b1c30] font-black text-lg flex-shrink-0">
                  {initials(p.users?.full_name ?? 'P')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[#0b1c30]">{p.users?.full_name ?? '—'}</p>
                  <p className="text-sm text-[#6f787e]">{p.speciality}</p>
                  {p.rating ? (
                    <div className="flex items-center gap-1 mt-1">
                      <Icon name="star" style={{ fontSize: '14px', color: '#ffde5c' }} />
                      <span className="text-xs text-[#6f787e]">{Number(p.rating).toFixed(1)} ({p.total_reviews} avis)</span>
                    </div>
                  ) : null}
                </div>
                <div className="text-right flex-shrink-0">
                  {(() => {
                    const active = (p.practitioner_services ?? []).filter(s => s.is_active).map(s => s.duration_min)
                    const min = active.length > 0 ? Math.min(...active) : p.session_duration_min
                    const max = active.length > 0 ? Math.max(...active) : p.session_duration_min
                    return (
                      <p className="text-xs font-semibold text-[#82d8ff] bg-[#e5eeff] px-2 py-1 rounded-full">
                        {min === max ? `${min} min` : `${min}–${max} min`}
                      </p>
                    )
                  })()}
                </div>
              </div>
              {p.bio && (
                <p className="text-sm text-[#6f787e] mt-3 line-clamp-2">{p.bio}</p>
              )}
              <div className="flex items-center gap-3 mt-4">
                <Link href={`/patient/book/${p.id}`} className="flex-1 py-2.5 bg-[#82d8ff] text-[#0b1c30] text-sm font-bold rounded-xl text-center hover:shadow-lg hover:shadow-[#82d8ff]/20 transition-all">
                  Réserver
                </Link>
                <button
                  onClick={() => setProfileOf(p)}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-[#82d8ff] transition-colors hover:bg-[#d3e4fe]"
                  style={{ backgroundColor: '#e5eeff' }}
                >
                  Profil
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Profil détaillé — modal */}
      {profileOf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setProfileOf(null)}>
          <div
            className="w-full max-w-md rounded-2xl p-6 space-y-4 max-h-[85vh] overflow-y-auto"
            style={{ backgroundColor: 'rgba(248,249,255,0.98)', border: '1px solid rgba(255,255,255,0.80)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-[#82d8ff] flex items-center justify-center text-[#0b1c30] font-black text-xl flex-shrink-0">
                  {initials(profileOf.users?.full_name ?? 'P')}
                </div>
                <div>
                  <p className="font-black text-[#0b1c30]">
                    {profileOf.professional_title ? `${profileOf.professional_title} ` : ''}{profileOf.users?.full_name ?? '—'}
                  </p>
                  <p className="text-sm text-[#6f787e]">{profileOf.speciality}</p>
                  {profileOf.rating ? (
                    <div className="flex items-center gap-1 mt-1">
                      <Icon name="star" style={{ fontSize: '14px', color: '#ffde5c' }} />
                      <span className="text-xs text-[#6f787e]">{Number(profileOf.rating).toFixed(1)} ({profileOf.total_reviews} avis)</span>
                    </div>
                  ) : null}
                </div>
              </div>
              <button onClick={() => setProfileOf(null)} className="text-[#6f787e] hover:text-[#0b1c30]">
                <Icon name="close" style={{ fontSize: '20px' }} />
              </button>
            </div>

            {profileOf.bio && (
              <div>
                <p className="text-xs font-bold text-[#6f787e] uppercase tracking-wide mb-1">À propos</p>
                <p className="text-sm text-[#0b1c30] leading-relaxed">{profileOf.bio}</p>
              </div>
            )}

            {profileOf.languages && profileOf.languages.length > 0 && (
              <div>
                <p className="text-xs font-bold text-[#6f787e] uppercase tracking-wide mb-1">Langues parlées</p>
                <div className="flex flex-wrap gap-1.5">
                  {profileOf.languages.map(l => (
                    <span key={l} className="text-xs font-medium px-2.5 py-1 rounded-full bg-[#e5eeff] text-[#82d8ff]">{l}</span>
                  ))}
                </div>
              </div>
            )}

            <Link
              href={`/patient/book/${profileOf.id}`}
              className="block w-full py-3 bg-[#82d8ff] text-[#0b1c30] text-sm font-bold rounded-xl text-center hover:shadow-lg hover:shadow-[#82d8ff]/20 transition-all"
            >
              Réserver une consultation
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
