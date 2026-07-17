'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import NotificationBell from '@/components/NotificationBell'

function Icon({ name }: { name: string }) {
  return <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{name}</span>
}

const navItems = [
  { href: '/patient', label: 'Accueil', icon: 'home', exact: true },
  { href: '/patient/practitioners', label: 'Trouver un praticien', icon: 'medical_services', exact: false },
  { href: '/patient/mon-equipe', label: 'Mon équipe', icon: 'groups', exact: false },
  { href: '/patient/appointments', label: 'Rendez-vous', icon: 'calendar_today', exact: false },
  { href: '/patient/prescriptions', label: 'Ordonnances', icon: 'receipt_long', exact: false },
  { href: '/patient/messages', label: 'Messages', icon: 'chat_bubble_outline', exact: false },
  { href: '/patient/assistant', label: 'Mounima', icon: 'favorite', exact: false },
  { href: '/patient/wellness', label: 'Bien-être', icon: 'self_improvement', exact: false },
  { href: '/patient/journal-acces', label: 'Journal d\'accès', icon: 'manage_history', exact: false },
  { href: '/patient/disputes', label: 'Litiges', icon: 'gavel', exact: false },
  { href: '/patient/profile', label: 'Mon profil', icon: 'manage_accounts', exact: false },
]

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [name, setName] = useState('')
  const [initials, setInitials] = useState('P')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [accountStatus, setAccountStatus] = useState<'active' | 'suspended' | 'blocked' | null>(null)
  const [statusReason, setStatusReason] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/auth/login'); return }
      setUserId(user.id)
      supabase.from('users').select('full_name, role, account_status, status_reason').eq('id', user.id).single().then(({ data }) => {
        if (!data || data.role !== 'patient') { router.push('/auth/login'); return }
        setName(data.full_name ?? '')
        setInitials((data.full_name ?? 'P').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2))
        setAccountStatus((data.account_status as 'active' | 'suspended' | 'blocked' | null) ?? 'active')
        setStatusReason((data as { status_reason?: string | null }).status_reason ?? null)
      })
    })
  }, [router])

  useEffect(() => {
    if (!userId) return
    const fetchUnread = async () => {
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('receiver_id', userId)
        .is('read_at', null)
      setUnreadMessages(count ?? 0)
    }
    void fetchUnread()
    const channel = supabase
      .channel(`unread-patient-msgs-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `receiver_id=eq.${userId}` }, () => { void fetchUnread() })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [userId])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <div className="flex h-screen bg-[#f8f9ff] overflow-hidden">

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen w-64 z-30 flex flex-col transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
        style={{
          backgroundColor: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(20px)',
          borderRight: '1px solid rgba(226,232,240,0.50)',
          boxShadow: '20px 0 40px rgba(130,216,255,0.05)',
        }}
      >
        {/* Logo + close mobile */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100/60">
          <img src="/logo.png" alt="M-Santé" className="w-10 h-10 rounded-xl object-cover shadow-sm" />
          <div className="flex-1">
            <h1 className="text-lg font-black tracking-tighter text-[#0b1c30]">M-Santé</h1>
            <p className="text-xs text-[#82d8ff] font-semibold tracking-wide uppercase">Espace Patient</p>
          </div>
          <button
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
            onClick={() => setSidebarOpen(false)}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Profil */}
        <div className="px-4 py-4 border-b border-slate-100/60">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#e5eeff]">
            <div className="w-9 h-9 rounded-full bg-[#82d8ff] flex items-center justify-center text-[#0b1c30] text-sm font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#0b1c30] truncate">{name || 'Patient'}</p>
              <p className="text-xs text-[#6f787e]">Compte patient</p>
            </div>
          </div>
        </div>

        {/* Nav */}
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
                <span className={isActive ? 'text-[#82d8ff]' : 'text-[#6f787e]'}>
                  <Icon name={item.icon} />
                </span>
                <span className="flex-1">{item.label}</span>
                {item.href === '/patient/messages' && unreadMessages > 0 && (
                  <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: '#ba1a1a' }}>
                    {unreadMessages > 99 ? '99+' : unreadMessages}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Sign out */}
        <div className="px-4 py-4 border-t border-slate-100/60 space-y-2">
          <Link
            href="/patient/practitioners"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold text-[#0b1c30] bg-[#82d8ff] hover:shadow-lg hover:shadow-[#82d8ff]/20 transition-all"
          >
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
      <div className="flex-1 min-w-0 ml-0 md:ml-64 flex flex-col min-h-screen">
        {/* Topbar */}
        <header
          className="fixed top-0 right-0 left-0 md:left-64 h-16 z-20 flex items-center justify-between px-4 md:px-8"
          style={{
            backgroundColor: 'rgba(255,255,255,0.40)',
            backdropFilter: 'blur(16px)',
            borderBottom: '1px solid rgba(255,255,255,0.10)',
          }}
        >
          <div className="flex items-center gap-3">
            {/* Hamburger mobile */}
            <button
              className="md:hidden p-2 rounded-lg text-[#82d8ff] hover:bg-white/50 transition-colors"
              onClick={() => setSidebarOpen(true)}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <div className="hidden md:flex items-center gap-3 bg-white/60 rounded-full px-4 py-2 border border-slate-200/50">
              <Icon name="search" />
              <input
                type="text"
                placeholder="Rechercher un praticien..."
                className="bg-transparent text-sm text-[#0b1c30] placeholder-[#6f787e] outline-none w-48"
              />
            </div>
            {/* Logo mobile (visible dans header quand sidebar fermée) */}
            <span className="md:hidden text-base font-black tracking-tighter text-[#0b1c30]">M-Santé</span>
          </div>
          <div className="flex items-center gap-3">
            {userId && <NotificationBell userId={userId} />}
            <div className="w-9 h-9 rounded-full bg-[#82d8ff] flex items-center justify-center text-[#0b1c30] text-sm font-bold shadow-sm">
              {initials}
            </div>
          </div>
        </header>

        <main className="flex-1 mt-16 p-4 md:p-8 overflow-y-auto">
          {accountStatus === 'suspended' || accountStatus === 'blocked' ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${
                accountStatus === 'blocked' ? 'bg-red-100' : 'bg-amber-100'
              }`}>
                <span className={`material-symbols-outlined text-4xl ${
                  accountStatus === 'blocked' ? 'text-red-500' : 'text-amber-500'
                }`}>
                  {accountStatus === 'blocked' ? 'block' : 'lock'}
                </span>
              </div>
              <h2 className="text-xl font-bold text-[#0b1c30] mb-2">
                {accountStatus === 'blocked' ? 'Votre compte est bloqué' : 'Votre compte est suspendu'}
              </h2>
              {statusReason && <p className="text-sm text-[#0b1c30] max-w-md mb-2">Motif : {statusReason}</p>}
              <p className="text-sm text-[#6f787e] max-w-md mb-4">
                Si vous pensez qu&apos;il s&apos;agit d&apos;une erreur, contactez notre équipe à <strong>privacy@m-sante.com</strong> pour contester cette décision.
              </p>
              <button onClick={handleSignOut} className="mt-2 text-sm text-[#6f787e] underline hover:text-[#0b1c30] transition-colors">
                Se déconnecter
              </button>
            </div>
          ) : children}
        </main>
      </div>
    </div>
  )
}
