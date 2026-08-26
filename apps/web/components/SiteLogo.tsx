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

// "full" = logo complet (icône + "-Santé" intégré à l'image) — utilisé sur
// la page d'accueil et les zones principales. "mark" = icône seule, sans
// texte — utilisé sur les pages d'authentification (inspiré de Doctolib,
// qui n'affiche que son "D" sur ces écrans). Le "mark" retombe sur le
// logo complet si aucune icône dédiée n'a été envoyée par l'admin.
export default function SiteLogo({ size = 40, variant = 'mark' }: { size?: number; variant?: 'full' | 'mark' }) {
  const { data } = useSiteSettings()
  const { data: href } = useLogoHref()

  if (variant === 'full') {
    const src = data?.logo_url || '/logo.png'
    return (
      <Link href={href ?? '/'} aria-label="Accueil">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="M-Santé" style={{ height: size, width: 'auto' }} className="object-contain" />
      </Link>
    )
  }

  // Ne PAS retomber sur logo_url ici : c'est une image large (icône +
  // "-Santé"), l'écraser dans une case carrée en object-cover la rogne
  // (ex. un fragment "- Sa" à la place de l'icône). /logo-mark.png est un
  // fallback carré dédié (copie statique de logo_mark_url), utilisé aussi
  // pendant le chargement de la requête pour éviter un flash au rafraîchissement.
  const src = data?.logo_mark_url || '/logo-mark.png'
  return (
    <Link href={href ?? '/'} aria-label="Accueil">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="M-Santé" style={{ width: size, height: size, borderRadius: size * 0.28 }} className="object-cover shadow-md" />
    </Link>
  )
}
