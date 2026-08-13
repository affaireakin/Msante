'use client'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useSiteSettings } from '@/lib/useSiteSettings'
import { supabase } from '@/lib/supabase'

const ROLE_HOME: Record<string, string> = {
  admin: '/admin/dashboard',
  practitioner: '/practitioner',
  patient: '/patient',
  organization_admin: '/organization',
  organization_member: '/organization-member',
  secretary: '/secretary',
}

// Clic sur le logo = "aller à l'accueil" — mais l'accueil d'un utilisateur
// déjà connecté est son tableau de bord, pas la landing page marketing.
function useLogoHref() {
  return useQuery({
    queryKey: ['site-logo-home-target'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return '/'
      const { data } = await supabase.from('users').select('role').eq('id', user.id).single()
      return (data?.role && ROLE_HOME[data.role]) || '/'
    },
    staleTime: 5 * 60_000,
  })
}

export default function SiteLogo({ size = 40 }: { size?: number }) {
  const { data } = useSiteSettings()
  const { data: href } = useLogoHref()
  const src = data?.logo_url || '/logo.png'

  return (
    <Link href={href ?? '/'} aria-label="Accueil">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="M-Santé" style={{ width: size, height: size, borderRadius: size * 0.28 }} className="object-cover shadow-md" />
    </Link>
  )
}
