'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span className="material-symbols-outlined" style={style}>{name}</span>
}

interface OrgListItem {
  id: string
  name: string
  city: string | null
  logo_url: string | null
  description: string | null
  practitioners: { speciality: string }[]
}

function useOrganizations(search: string) {
  return useQuery<OrgListItem[]>({
    queryKey: ['patient-organizations', search],
    queryFn: async () => {
      let q = supabase
        .from('organizations')
        .select('id, name, city, logo_url, description, practitioners(speciality)')
        .eq('status', 'active')
        .order('name')

      if (search.trim()) q = q.or(`name.ilike.%${search.trim()}%,city.ilike.%${search.trim()}%`)

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as unknown as OrgListItem[]
    },
  })
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function PatientOrganizationsPage() {
  const [search, setSearch] = useState('')
  const { data = [], isLoading } = useOrganizations(search)

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-black text-[#0b1c30]">Organisations partenaires</h1>
        <p className="text-sm text-[#6f787e] mt-1">Cabinets, cliniques et centres de santé — {data.length} organisation{data.length > 1 ? 's' : ''}</p>
      </div>

      <div className="flex items-center gap-2 bg-white/70 rounded-xl px-4 py-3 border border-slate-200/50">
        <Icon name="search" style={{ color: '#6f787e', fontSize: '20px' }} />
        <input
          type="text"
          placeholder="Rechercher par nom ou ville..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-transparent text-sm text-[#0b1c30] placeholder-[#6f787e] outline-none"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-40 rounded-2xl bg-white/40 animate-pulse" />)}
        </div>
      ) : data.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.60)', border: '1px solid rgba(255,255,255,0.80)' }}>
          <Icon name="storefront" style={{ fontSize: '48px', color: '#bec8ce' }} />
          <p className="font-semibold text-[#0b1c30] mt-3">Aucune organisation trouvée</p>
          <p className="text-sm text-[#6f787e] mt-1">Essayez un autre nom ou une autre ville</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.map(org => {
            const specialities = Array.from(new Set(org.practitioners.map(p => p.speciality))).slice(0, 3)
            return (
              <Link key={org.id} href={`/patient/organizations/${org.id}`}
                className="rounded-2xl p-6 hover:shadow-xl hover:-translate-y-1 transition-all block"
                style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-xl bg-[#e5eeff] flex items-center justify-center overflow-hidden flex-shrink-0 border border-[#d3e4fe]">
                    {org.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={org.logo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-black text-[#005e7a]">{initials(org.name)}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[#0b1c30]">{org.name}</p>
                    {org.city && <p className="text-sm text-[#6f787e]">{org.city}</p>}
                    <p className="text-xs text-[#82d8ff] font-semibold mt-1">
                      {org.practitioners.length} praticien{org.practitioners.length > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                {org.description && (
                  <p className="text-sm text-[#6f787e] mt-3 line-clamp-2">{org.description}</p>
                )}
                {specialities.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {specialities.map(s => (
                      <span key={s} className="text-xs font-medium px-2.5 py-1 rounded-full bg-[#e5eeff] text-[#82d8ff]">{s}</span>
                    ))}
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
