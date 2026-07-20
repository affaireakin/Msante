'use client'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span className="material-symbols-outlined" style={style}>{name}</span>
}

interface FeaturedPractitioner {
  id: string
  speciality: string
  rating: number | null
  total_reviews: number | null
  users: { full_name: string } | { full_name: string }[] | null
}

const AVATAR_COLORS = ['#82d8ff', '#705d00', '#1d7a3a']

function practitionerName(p: FeaturedPractitioner): string {
  const u = Array.isArray(p.users) ? p.users[0] : p.users
  return u?.full_name ?? 'Praticien'
}

function initials(name: string): string {
  return name.split(' ').map(n => n[0]).filter(Boolean).join('').toUpperCase().slice(0, 2) || 'PR'
}

export default function FeaturedPractitioners() {
  const { data = [] } = useQuery<FeaturedPractitioner[]>({
    queryKey: ['homepage-featured-practitioners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('practitioners')
        .select('id, speciality, rating, total_reviews, users!user_id(full_name)')
        .eq('verification_status', 'approved')
        .not('rating', 'is', null)
        .order('rating', { ascending: false })
        .limit(3)
      if (error) throw error
      return (data ?? []) as unknown as FeaturedPractitioner[]
    },
    staleTime: 5 * 60_000,
  })

  // QA finding: this section used to show 3 hardcoded fake practitioners with
  // invented ratings/session counts. Real data only, and the section simply
  // doesn't render until there are enough reviewed practitioners to feature.
  if (data.length === 0) return null

  return (
    <section id="praticiens" className="py-24 max-w-7xl mx-auto px-6">
      <div className="text-center mb-16">
        <h2 className="text-4xl font-black text-[#0b1c30] mb-4">Nos praticiens certifiés</h2>
        <p className="text-[#6f787e]">Sélectionnés pour leur expertise et leur bienveillance</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {data.map((p, i) => {
          const name = practitionerName(p)
          return (
            <div key={p.id} className="rounded-2xl p-6 hover:shadow-xl hover:-translate-y-1 transition-all" style={{ background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.3)' }}>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-white font-black text-lg flex-shrink-0" style={{ backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>
                  {initials(name)}
                </div>
                <div>
                  <p className="font-bold text-[#0b1c30]">{name}</p>
                  <p className="text-sm text-[#6f787e]">{p.speciality}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 mb-3">
                {[1, 2, 3, 4, 5].map(star => (
                  <Icon key={star} name="star" style={{ fontSize: '14px', color: '#ffde5c' }} />
                ))}
                <span className="text-xs text-[#6f787e] ml-1">{p.rating?.toFixed(1)} · {p.total_reviews ?? 0} avis</span>
              </div>
              <div className="flex items-center justify-end mt-4">
                <Link href="/auth/signup" className="px-4 py-2 bg-[#82d8ff] text-[#0b1c30] text-sm font-bold rounded-xl hover:shadow-lg hover:shadow-[#82d8ff]/20 transition-all">
                  Réserver
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
