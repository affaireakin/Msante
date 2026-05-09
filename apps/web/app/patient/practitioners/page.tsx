'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span className="material-symbols-outlined" style={style}>{name}</span>
}

const SPECIALITIES = ['Tous', 'Psychologue', 'Psychiatre', 'Coach de vie', 'Thérapeute', 'Nutritionniste']

interface Practitioner {
  id: string
  speciality: string
  session_price: number | null
  session_currency: string | null
  session_duration_min: number
  rating: number | null
  total_reviews: number
  bio: string | null
  users: { full_name: string } | null
}

function usePractitioners(speciality: string, search: string) {
  return useQuery({
    queryKey: ['patient-practitioners', speciality, search],
    queryFn: async () => {
      let q = supabase
        .from('practitioners')
        .select('id, speciality, session_price, session_currency, session_duration_min, rating, total_reviews, bio, users!inner(full_name)')
        .eq('verification_status', 'approved')
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
  const [speciality, setSpeciality] = useState('Tous')
  const [search, setSearch] = useState('')
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
                backgroundColor: speciality === s ? '#006685' : 'rgba(255,255,255,0.70)',
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
                <div className="w-14 h-14 rounded-full bg-[#006685] flex items-center justify-center text-white font-black text-lg flex-shrink-0">
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
                  <p className="font-black text-[#006685] text-sm">{p.session_price ? `${p.session_price.toLocaleString('fr-FR')} ${p.session_currency ?? 'XOF'}` : '—'}</p>
                  <p className="text-xs text-[#6f787e]">{p.session_duration_min} min</p>
                </div>
              </div>
              {p.bio && (
                <p className="text-sm text-[#6f787e] mt-3 line-clamp-2">{p.bio}</p>
              )}
              <div className="flex items-center gap-3 mt-4">
                <Link href={`/patient/book/${p.id}`} className="flex-1 py-2.5 bg-[#006685] text-white text-sm font-bold rounded-xl text-center hover:shadow-lg hover:shadow-[#006685]/20 transition-all">
                  Réserver
                </Link>
                <button className="px-4 py-2.5 rounded-xl text-sm font-semibold text-[#006685] transition-colors" style={{ backgroundColor: '#e5eeff' }}>
                  Profil
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
