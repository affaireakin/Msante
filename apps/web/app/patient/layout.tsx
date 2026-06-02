'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

function Icon({ name }: { name: string }) {
  return <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{name}</span>
}

const navItems = [
  { href: '/patient', label: 'Accueil', icon: 'home', exact: true },
  { href: '/patient/practitioners', label: 'Praticiens', icon: 'medical_services', exact: false },
  { href: '/patient/appointments', label: 'Rendez-vous', icon: 'calendar_today', exact: false },
  { href: '/patient/messages', label: 'Messages', icon: 'chat_bubble_outline', exact: false },
  { href: '/patient/assistant', label: 'Mounima', icon: 'favorite', exact: false },
  { href: '/patient/wellness', label: 'Bien-être', icon: 'self_improvement', exact: false },
  { href: '/patient/profile', label: 'Mon profil', icon: 'manage_accounts', exact: false },
]

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [name, setName] = useState('')
  const [initials, setInitials] = useState('P')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/auth/login'); return }
      supabase.from('users').select('full_name, role').eq('id', user.id).single().then(({ data }) => {
        if (!data || data.role !== 'patient') { router.push('/auth/login'); return }
        setName(data.full_name ?? '')
        setInitials((data.full_name ?? 'P').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2))
      })
    })
  }, [router])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <div className="flex h-screen bg-[#f8f9ff] overflow-hidden">
      {/* Sidebar */}
      <aside
        className="fixed left-0 top-0 h-screen w-64 z-30 flex flex-col"
        style={{
          backgroundColor: 'rgba(255,255,255,0.70)',
          backdropFilter: 'blur(20px)',
          borderRight: '1px solid rgba(226,232,240,0.50)',
          boxShadow: '20px 0 40px rgba(130,216,255,0.05)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100/60">
          <div className="w-10 h-10 rounded-xl bg-[#006685] flex items-center justify-center shadow-sm">
            <Icon name="favorite" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tighter text-[#0b1c30]">M-Santé</h1>
            <p className="text-xs text-[#006685] font-semibold tracking-wide uppercase">Espace Patient</p>
          </div>
        </div>

        {/* Profil */}
        <div className="px-4 py-4 border-b border-slate-100/60">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#e5eeff]">
            <div className="w-9 h-9 rounded-full bg-[#006685] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#0b1c30] truncate">{name || 'Patient'}</p>
              <p className="text-xs text-[#6f787e]">Compte patient</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-sky-50 text-[#006685] font-semibold border-r-4 border-[#006685] -mr-3 pr-4'
                    : 'text-[#3f484d] hover:translate-x-1 hover:bg-slate-50/50'
                }`}
              >
                <span className={isActive ? 'text-[#006685]' : 'text-[#6f787e]'}>
                  <Icon name={item.icon} />
                </span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Sign out */}
        <div className="px-4 py-4 border-t border-slate-100/60 space-y-2">
          <Link href="/patient/practitioners" className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-[#006685] hover:shadow-lg hover:shadow-[#006685]/20 transition-all">
            <Icon name="add_circle" />
            Nouveau rendez-vous
          </Link>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-[#ba1a1a] hover:bg-red-50 transition-colors"
          >
            <Icon name="logout" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        {/* Topbar */}
        <header
          className="fixed top-0 right-0 left-64 h-16 z-20 flex items-center justify-between px-8"
          style={{
            backgroundColor: 'rgba(255,255,255,0.40)',
            backdropFilter: 'blur(16px)',
            borderBottom: '1px solid rgba(255,255,255,0.10)',
          }}
        >
          <div className="flex items-center gap-3 bg-white/60 rounded-full px-4 py-2 border border-slate-200/50">
            <Icon name="search" />
            <input
              type="text"
              placeholder="Rechercher un praticien..."
              className="bg-transparent text-sm text-[#0b1c30] placeholder-[#6f787e] outline-none w-48"
            />
          </div>
          <div className="flex items-center gap-3">
            <button className="w-9 h-9 flex items-center justify-center rounded-full bg-white/60 border border-slate-200/50 text-[#6f787e] hover:bg-white transition-colors">
              <Icon name="notifications" />
            </button>
            <div className="w-9 h-9 rounded-full bg-[#006685] flex items-center justify-center text-white text-sm font-bold shadow-sm">
              {initials}
            </div>
          </div>
        </header>

        <main className="flex-1 mt-16 p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
