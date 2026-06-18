'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthRedirect() {
  const router = useRouter()
  useEffect(() => {
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
