'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import InternalMessaging from '@/app/admin/messages/InternalMessaging'
import NotificationBell from '@/components/NotificationBell'

function Icon({ name, size = 20, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-symbols-outlined" style={{ fontSize: `${size}px`, color }}>{name}</span>
}

export default function OrganizationMemberPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [name, setName] = useState('')
  const [orgName, setOrgName] = useState('')
  const [roleName, setRoleName] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/auth/login'); return }
      setUserId(user.id)
      const { data: profile } = await supabase.from('users').select('full_name, role, organization_id').eq('id', user.id).single()
      if (!profile || profile.role !== 'organization_member' || !profile.organization_id) {
        router.push('/auth/login')
        return
      }
      setName(profile.full_name ?? '')

      const [{ data: org }, { data: assignment }] = await Promise.all([
        supabase.from('organizations').select('name').eq('id', profile.organization_id).single(),
        supabase.from('user_roles').select('org_roles(name)').eq('user_id', user.id).eq('organization_id', profile.organization_id).maybeSingle(),
      ])
      setOrgName(org?.name ?? '')
      const role = assignment?.org_roles as unknown as { name: string } | null
      setRoleName(role?.name ?? null)
      setChecking(false)
    })
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  if (checking) return (
    <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#82d8ff] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f8f9ff] p-6 space-y-6 max-w-3xl mx-auto">
      {userId && (
        <div className="flex justify-end">
          <NotificationBell userId={userId} basePath="/organization-member" historyHref="/organization-member/notifications" />
        </div>
      )}
      <div className="bg-white rounded-2xl p-8 text-center space-y-3 shadow-xl">
        <div className="w-16 h-16 rounded-full bg-[#e5eeff] flex items-center justify-center mx-auto">
          <Icon name="badge" size={32} color="#005e7a" />
        </div>
        <div>
          <h2 className="text-xl font-black text-[#0b1c30]">Bienvenue, {name} !</h2>
          <p className="text-sm text-[#6f787e] mt-2">
            Votre compte collaborateur pour <strong>{orgName}</strong> est actif
            {roleName ? <> avec le rôle <strong>{roleName}</strong></> : ''}.
          </p>
        </div>
        <button onClick={handleLogout} className="text-sm text-[#6f787e] font-semibold hover:text-[#0b1c30]">
          Se déconnecter
        </button>
      </div>

      <div>
        <h3 className="text-sm font-bold text-[#0b1c30] mb-3">Messages</h3>
        <InternalMessaging />
      </div>
    </div>
  )
}
