'use client'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span className="material-symbols-outlined" style={style}>{name}</span>
}

interface FeaturedOrg {
  id: string
  name: string
  city: string | null
  logo_url: string | null
}

export default function FeaturedOrganizations() {
  const { data = [] } = useQuery<FeaturedOrg[]>({
    queryKey: ['homepage-featured-organizations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, city, logo_url')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(4)
      if (error) throw error
      return data ?? []
    },
    staleTime: 5 * 60_000,
  })

  if (data.length === 0) return null

  return (
    <section className="py-24 max-w-7xl mx-auto px-6">
      <div className="text-center mb-16">
        <h2 className="text-4xl font-black text-[#0b1c30] mb-4">Nos organisations partenaires</h2>
        <p className="text-[#6f787e]">Cabinets, cliniques et centres de santé sur M-Santé</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {data.map(org => (
          <Link key={org.id} href={`/patient/organizations/${org.id}`}
            className="rounded-2xl p-6 text-center hover:shadow-xl hover:-translate-y-1 transition-all"
            style={{ background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.3)' }}>
            <div className="w-16 h-16 rounded-2xl bg-[#e5eeff] flex items-center justify-center overflow-hidden mx-auto mb-3 border border-[#d3e4fe]">
              {org.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={org.logo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <Icon name="storefront" style={{ fontSize: '28px', color: '#005e7a' }} />
              )}
            </div>
            <p className="font-bold text-[#0b1c30]">{org.name}</p>
            {org.city && <p className="text-sm text-[#6f787e] mt-0.5">{org.city}</p>}
          </Link>
        ))}
      </div>
    </section>
  )
}
