'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import NotificationBell from '@/components/NotificationBell'
import SiteLogo from '@/components/SiteLogo'

const navItems = [
  {
    href: '/organization',
    label: 'Vue d\'ensemble',
    exact: true,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
  {
    href: '/organization/practitioners',
    label: 'Praticiens',
    exact: false,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
  {
    href: '/organization/collaborators',
    label: 'Collaborateurs',
    exact: false,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
  },
  {
    href: '/organization/roles',
    label: 'Rôles',
    exact: false,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    href: '/organization/messages',
    label: 'Messages',
    exact: false,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
      </svg>
    ),
  },
]

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente de validation',
  suspended: 'Suspendue',
  rejected: 'Refusée',
  archived: 'Archivée',
}

export default function OrganizationLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [initials, setInitials] = useState('A')
  const [orgLoaded, setOrgLoaded] = useState(false)
  const [orgName, setOrgName] = useState('')
  const [orgStatus, setOrgStatus] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/auth/login'); return }
      setUserId(user.id)
      supabase
        .from('users')
        .select('full_name, role, organization_id')
        .eq('id', user.id)
        .single()
        .then(({ data: userData }) => {
          if (!userData || userData.role !== 'organization_admin' || !userData.organization_id) {
            router.push('/auth/login')
            return
          }
          const fullName = userData.full_name ?? ''
          setName(fullName)
          setInitials(fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'A')

          supabase
            .from('organizations')
            .select('name, status')
            .eq('id', userData.organization_id)
            .single()
            .then(({ data: org }) => {
              setOrgLoaded(true)
              if (org) { setOrgName(org.name); setOrgStatus(org.status) }
            })
        })
    })
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const blocked = orgLoaded && orgStatus !== null && orgStatus !== 'active'

  return (
    <div className="flex h-screen bg-[#f8f9ff] overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed left-0 top-0 h-screen w-64 z-30 flex flex-col transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
        style={{
          backgroundColor: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(20px)',
          borderRight: '1px solid rgba(226,232,240,0.50)',
          boxShadow: '20px 0 40px rgba(130,216,255,0.05)',
        }}
      >
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100/60">
          <SiteLogo size={40} />
          <div className="flex-1">
            <h1 className="text-lg font-black tracking-tighter text-[#0b1c30]">M-Santé</h1>
            <p className="text-xs text-[#82d8ff] font-semibold tracking-wide uppercase">Organisation</p>
          </div>
          <button className="md:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-100" onClick={() => setSidebarOpen(false)}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="px-4 py-4 border-b border-slate-100/60">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#e5eeff]">
            <div className="w-9 h-9 rounded-full bg-[#82d8ff] flex items-center justify-center text-[#0b1c30] text-sm font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#0b1c30] truncate">{orgName || 'Organisation'}</p>
              <p className="text-xs text-[#6f787e] truncate">{name || 'Administrateur'}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-sky-50 text-[#82d8ff] font-semibold border-r-4 border-[#82d8ff] -mr-3 pr-4'
                    : 'text-[#3f484d] hover:translate-x-1 hover:bg-slate-50/50'
                }`}
              >
                <span className={isActive ? 'text-[#82d8ff]' : 'text-[#6f787e]'}>{item.icon}</span>
                <span className="flex-1">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="px-3 py-4 border-t border-slate-100/60">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-[#3f484d] hover:bg-red-50 hover:text-red-600 transition-all w-full"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
            Déconnexion
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 ml-0 md:ml-64 flex flex-col min-h-screen">
        <header
          className="fixed top-0 right-0 left-0 md:left-64 h-16 z-20 flex items-center justify-between px-4 md:px-8"
          style={{
            backgroundColor: 'rgba(255,255,255,0.40)',
            backdropFilter: 'blur(16px)',
            borderBottom: '1px solid rgba(255,255,255,0.10)',
          }}
        >
          <div className="flex items-center gap-3">
            <button className="md:hidden p-2 rounded-lg text-[#82d8ff] hover:bg-white/50 transition-colors" onClick={() => setSidebarOpen(true)}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <p className="text-sm font-medium text-[#6f787e] hidden md:block">
              Bonjour, <span className="font-semibold text-[#0b1c30]">{name || 'Administrateur'}</span>
            </p>
            <span className="md:hidden text-base font-black tracking-tighter text-[#0b1c30]">M-Santé</span>
          </div>
          <div className="flex items-center gap-3">
            {userId && <NotificationBell userId={userId} basePath="/organization" historyHref="/organization/notifications" />}
            <div className="w-9 h-9 rounded-full bg-[#82d8ff] flex items-center justify-center text-[#0b1c30] text-sm font-bold shadow-sm">
              {initials}
            </div>
          </div>
        </header>
        <main className="flex-1 mt-16 p-4 md:p-8 overflow-y-auto">
          {blocked ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${
                orgStatus === 'rejected' ? 'bg-red-100' : 'bg-amber-100'
              }`}>
                <span className={`material-symbols-outlined text-4xl ${
                  orgStatus === 'rejected' ? 'text-red-500' : 'text-amber-500'
                }`}>
                  {orgStatus === 'rejected' ? 'cancel' : orgStatus === 'suspended' ? 'block' : 'pending_actions'}
                </span>
              </div>
              <h2 className="text-xl font-bold text-[#0b1c30] mb-2">
                {orgStatus ? STATUS_LABELS[orgStatus] ?? orgStatus : ''}
              </h2>
              <p className="text-sm text-[#6f787e] max-w-md mb-4">
                {orgStatus === 'pending' && 'Votre organisation est en attente de validation par notre équipe. Vous serez notifié dès son approbation.'}
                {orgStatus === 'suspended' && 'Votre organisation a été suspendue. Contactez notre équipe pour plus d\'informations.'}
                {orgStatus === 'rejected' && 'Votre demande de création d\'organisation a été refusée.'}
                {orgStatus === 'archived' && 'Cette organisation est archivée et n\'est plus active.'}
              </p>
              <button onClick={handleLogout} className="mt-2 text-sm text-[#6f787e] underline hover:text-[#0b1c30] transition-colors">
                Se déconnecter
              </button>
            </div>
          ) : children}
        </main>
      </div>
    </div>
  )
}
