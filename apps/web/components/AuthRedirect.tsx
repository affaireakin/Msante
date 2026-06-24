'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthRedirect() {
  const router = useRouter()
  useEffect(() => {
    // Supabase redirects here with ?error= when a link is invalid/expired
    const params = new URLSearchParams(window.location.search)
    const error = params.get('error')
    const errorDesc = params.get('error_description')
    if (error) {
      const msg = errorDesc ?? 'Lien invalide ou expiré.'
      router.replace(`/auth/login?error=${encodeURIComponent(msg)}`)
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
