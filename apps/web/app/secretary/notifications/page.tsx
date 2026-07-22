'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import NotificationCenter from '@/components/NotificationCenter'

export default function SecretaryNotificationsPage() {
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push('/auth/login')
    })
  }, [router])

  return (
    <div className="min-h-screen bg-[#f8f9ff]">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <button onClick={() => router.push('/secretary')} className="flex items-center gap-1.5 text-sm font-semibold text-[#6f787e] hover:text-[#0b1c30] transition-colors mb-6">
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
          Retour
        </button>
        <NotificationCenter basePath="/secretary" />
      </div>
    </div>
  )
}
