'use client'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span className="material-symbols-outlined" style={style}>{name}</span>
}

interface OrgPractitioner {
  id: string
  speciality: string
  professional_title: string | null
  rating: number | null
  total_reviews: number
  accepting_new_patients: boolean
  users: { full_name: string } | null
}

interface OrgService {
  name: string
  duration_min: number
  price: number | null
}

interface OrgProfile {
  id: string
  name: string
  city: string | null
  address: string | null
  phone: string | null
  email: string | null
  logo_url: string | null
  description: string | null
  opening_hours: string | null
}

function useOrganizationProfile(orgId: string) {
  return useQuery({
    queryKey: ['patient-organization-profile', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const [{ data: org, error: orgError }, { data: practitioners, error: practError }] = await Promise.all([
        supabase
          .from('organizations')
          .select('id, name, city, address, phone, email, logo_url, description, opening_hours')
          .eq('id', orgId)
          .eq('status', 'active')
          .single(),
        supabase
          .from('practitioners')
          .select('id, speciality, professional_title, rating, total_reviews, accepting_new_patients, users!user_id(full_name), practitioner_services(name, duration_min, price, is_active)')
          .eq('organization_id', orgId)
          .eq('verification_status', 'approved')
          .not('org_validated_at', 'is', null)
          .order('rating', { ascending: false }),
      ])
      if (orgError) throw orgError
      if (practError) throw practError

      const services: OrgService[] = []
      const seen = new Set<string>()
      for (const p of (practitioners ?? []) as unknown as (OrgPractitioner & { practitioner_services: { name: string; duration_min: number; price: number | null; is_active: boolean }[] | null })[]) {
        for (const s of (p.practitioner_services ?? [])) {
          if (!s.is_active || seen.has(s.name)) continue
          seen.add(s.name)
          services.push({ name: s.name, duration_min: s.duration_min, price: s.price })
        }
      }

      return {
        org: org as unknown as OrgProfile,
        practitioners: (practitioners ?? []) as unknown as OrgPractitioner[],
        services,
      }
    },
  })
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function OrganizationProfilePage() {
  const params = useParams<{ id: string }>()
  const { data, isLoading, error } = useOrganizationProfile(params.id)

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-4xl">
        <div className="h-32 rounded-2xl bg-white/40 animate-pulse" />
        <div className="h-48 rounded-2xl bg-white/40 animate-pulse" />
      </div>
    )
  }

  if (error || !data?.org) {
    return (
      <div className="rounded-2xl p-12 text-center max-w-4xl" style={{ backgroundColor: 'rgba(255,255,255,0.60)', border: '1px solid rgba(255,255,255,0.80)' }}>
        <Icon name="error_outline" style={{ fontSize: '48px', color: '#bec8ce' }} />
        <p className="font-semibold text-[#0b1c30] mt-3">Organisation introuvable</p>
        <Link href="/patient/organizations" className="text-sm text-[#82d8ff] font-semibold mt-2 inline-block">Retour aux organisations</Link>
      </div>
    )
  }

  const { org, practitioners, services } = data

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="rounded-2xl p-6" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
        <div className="flex items-start gap-5 flex-wrap">
          <div className="w-20 h-20 rounded-2xl bg-[#e5eeff] flex items-center justify-center overflow-hidden flex-shrink-0 border border-[#d3e4fe]">
            {org.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="font-black text-2xl text-[#005e7a]">{initials(org.name)}</span>
            )}
          </div>
          <div className="flex-1 min-w-[200px]">
            <h1 className="text-2xl font-black text-[#0b1c30]">{org.name}</h1>
            {org.city && <p className="text-sm text-[#6f787e] mt-0.5">{org.address ? `${org.address}, ` : ''}{org.city}</p>}
            <p className="text-xs text-[#82d8ff] font-semibold mt-1">
              {practitioners.length} praticien{practitioners.length > 1 ? 's' : ''} disponible{practitioners.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        {org.description && (
          <p className="text-sm text-[#0b1c30] leading-relaxed mt-4">{org.description}</p>
        )}
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-slate-100">
          {org.phone && (
            <div className="flex items-center gap-1.5 text-sm text-[#6f787e]">
              <Icon name="call" style={{ fontSize: '16px', color: '#82d8ff' }} />
              {org.phone}
            </div>
          )}
          {org.email && (
            <div className="flex items-center gap-1.5 text-sm text-[#6f787e]">
              <Icon name="mail" style={{ fontSize: '16px', color: '#82d8ff' }} />
              {org.email}
            </div>
          )}
          {org.opening_hours && (
            <div className="flex items-center gap-1.5 text-sm text-[#6f787e]">
              <Icon name="schedule" style={{ fontSize: '16px', color: '#82d8ff' }} />
              {org.opening_hours}
            </div>
          )}
        </div>
      </div>

      {/* Services */}
      {services.length > 0 && (
        <div className="rounded-2xl p-6" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
          <h2 className="text-lg font-bold text-[#0b1c30] mb-4">Services proposés</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {services.map(s => (
              <div key={s.name} className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#f8f9ff] border border-slate-100">
                <div>
                  <p className="text-sm font-semibold text-[#0b1c30]">{s.name}</p>
                  <p className="text-xs text-[#6f787e]">{s.duration_min} min</p>
                </div>
                {s.price != null && (
                  <p className="text-sm font-bold text-[#82d8ff]">{s.price.toLocaleString('fr-FR')} XOF</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Practitioners */}
      <div className="rounded-2xl p-6" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
        <h2 className="text-lg font-bold text-[#0b1c30] mb-4">Nos praticiens</h2>
        {practitioners.length === 0 ? (
          <p className="text-sm text-[#6f787e]">Aucun praticien disponible pour le moment.</p>
        ) : (
          <div className="space-y-3">
            {practitioners.map(p => (
              <div key={p.id} className="flex items-center gap-4 px-4 py-3 rounded-xl bg-[#f8f9ff] border border-slate-100">
                <div className="w-12 h-12 rounded-full bg-[#82d8ff] flex items-center justify-center text-[#0b1c30] font-black flex-shrink-0">
                  {initials(p.users?.full_name ?? 'P')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[#0b1c30] truncate">
                    {p.professional_title ? `${p.professional_title} ` : ''}{p.users?.full_name ?? '—'}
                  </p>
                  <p className="text-sm text-[#6f787e]">{p.speciality}</p>
                  {p.rating ? (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Icon name="star" style={{ fontSize: '13px', color: '#ffde5c' }} />
                      <span className="text-xs text-[#6f787e]">{Number(p.rating).toFixed(1)} ({p.total_reviews} avis)</span>
                    </div>
                  ) : null}
                </div>
                {p.accepting_new_patients ? (
                  <Link href={`/patient/book/${p.id}`}
                    className="px-4 py-2 bg-[#82d8ff] text-[#0b1c30] text-sm font-bold rounded-xl hover:shadow-lg transition-all flex-shrink-0">
                    Réserver
                  </Link>
                ) : (
                  <span className="px-3 py-1.5 rounded-full text-xs font-semibold text-[#6f787e] bg-slate-100 flex-shrink-0">Complet</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
