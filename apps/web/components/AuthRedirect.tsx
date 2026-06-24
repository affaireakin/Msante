'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthRedirect() {
  const router = useRouter()
  useEffect(() => {
    // Supabase redirects here with error params when a link is invalid/expired.
    // PKCE flow puts errors in the hash fragment (#error=...), implicit flow in query (?error=...).
    const search = new URLSearchParams(window.location.search)
    const hash   = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const error    = search.get('error')    || hash.get('error')
    const errorDesc = search.get('error_description') || hash.get('error_description')
    if (error) {
      const msg = errorDesc ?? 'Lien invalide ou expiré.'
      router.replace(`/auth/login?error=${encodeURIComponent(msg)}`)
      return
    }

    // If a PKCE code landed on the homepage, Supabase redirected here instead
    // of /auth/reset-password (URL not matched). Forward it to the reset form.
    const code = search.get('code')
    if (code) {
      router.replace(`/auth/reset-password?code=${code}`)
      return
    }

    // If user navigated away from the reset form mid-flow, send them back.
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('recovery_in_progress')) {
      router.replace('/auth/reset-password')
      return
    }

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('users').select('role').eq('id', user.id).single().then(({ data }) => {
        if (!data) return
        if (data.role === 'admin') router.replace('/admin/overview')
        else if (data.role === 'practitioner') router.replace('/practitioner')
        else if (data.role === 'patient') router.replace('/patient')
      })
    })
  }, [router])
  return null
}
