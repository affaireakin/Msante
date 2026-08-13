'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import NotificationBell from '@/components/NotificationBell'
import SiteLogo from '@/components/SiteLogo'

const navItems = [
  {
    href: '/practitioner',
    label: 'Tableau de bord',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    exact: true,
  },
  {
    href: '/practitioner/appointments',
    label: 'Rendez-vous',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
  },
  {
    href: '/practitioner/patients',
    label: 'Patients',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
  {
    href: '/practitioner/availability',
    label: 'Disponibilités',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    href: '/practitioner/secretary',
    label: 'Secrétaires',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
  },
  {
    href: '/practitioner/services',
    label: 'Prestations',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
      </svg>
    ),
  },
  {
    href: '/practitioner/notes-cliniques',
    label: 'Notes cliniques',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  {
    href: '/practitioner/ordonnances',
    label: 'Ordonnances',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
      </svg>
    ),
  },
  {
    href: '/practitioner/messages',
    label: 'Messages',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
      </svg>
    ),
  },
  {
    href: '/practitioner/analytics',
    label: 'Analytics',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
  {
    href: '/practitioner/disputes',
    label: 'Litiges',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z" />
      </svg>
    ),
  },
  {
    href: '/practitioner/profile',
    label: 'Mon profil',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
]

export default function PractitionerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [name, setName] = useState('')
  const [initials, setInitials] = useState('P')
  const [speciality, setSpeciality] = useState('')
  const [accountStatus, setAccountStatus] = useState<string | null>(null)
  const [statusReason, setStatusReasonText] = useState<string | null>(null)
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null)
  const [practitionerLoaded, setPractitionerLoaded] = useState(false)
  const [practitionerId, setPractitionerId] = useState<string | null>(null)
  const [practitionerType, setPractitionerType] = useState<'healthcare' | 'wellness'>('healthcare')
  const [showAppealForm, setShowAppealForm] = useState(false)
  const [appealText, setAppealText] = useState('')
  const [appealSent, setAppealSent] = useState(false)
  const [latestAppeal, setLatestAppeal] = useState<{ status: string; admin_response: string | null } | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [unreadMessages, setUnreadMessages] = useState(0)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/auth/login'); return }
      setUserId(user.id)
      supabase
        .from('users')
        .select('full_name, role')
        .eq('id', user.id)
        .single()
        .then(({ data: userData }) => {
          if (!userData || userData.role !== 'practitioner') {
            router.push('/auth/login')
            return
          }
          const fullName = userData.full_name ?? ''
          setName(fullName)
          setInitials(fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'P')
          supabase
            .from('practitioners')
            .select('id, speciality, account_status, status_reason, practitioner_type, verification_status')
            .eq('user_id', user.id)
            .maybeSingle()
            .then(({ data: pract }) => {
              setPractitionerLoaded(true)
              if (pract) {
                setSpeciality(pract.speciality ?? '')
                setAccountStatus(pract.account_status ?? null)
                setStatusReasonText(pract.status_reason ?? null)
                setPractitionerId(pract.id)
                setPractitionerType((pract.practitioner_type as 'healthcare' | 'wellness') ?? 'healthcare')
                setVerificationStatus(pract.verification_status ?? null)
              }
            })
        })
    })
  }, [router])

  // The banner previously only ever showed the ORIGINAL suspension reason
  // (status_reason) and a purely local "appealSent" flag that reset on every
  // reload — so once an admin rejected an appeal with a different
  // explanation than the initial one, the practitioner had no way to see it.
  useEffect(() => {
    if (!practitionerId) return
    supabase
      .from('practitioner_appeals')
      .select('status, admin_response')
      .eq('practitioner_id', practitionerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setLatestAppeal(data ?? null))
  }, [practitionerId, appealSent])

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
      .channel(`unread-msgs-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `receiver_id=eq.${userId}` }, () => { void fetchUnread() })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [userId])

  const handleAppealSubmit = async () => {
    if (!practitionerId || !appealText.trim()) return
    await supabase.from('practitioner_appeals').insert({
      practitioner_id: practitionerId,
      message: appealText,
    })
    setAppealSent(true)
    setShowAppealForm(false)
    setAppealText('')
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <div className="flex h-screen bg-[#f8f9ff] overflow-hidden">

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
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
            <p className="text-xs text-[#82d8ff] font-semibold tracking-wide uppercase">Clinical Portal</p>
          </div>
          <button className="md:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-100" onClick={() => setSidebarOpen(false)}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Profil praticien */}
        <div className="px-4 py-4 border-b border-slate-100/60">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#e5eeff]">
            <div className="w-9 h-9 rounded-full bg-[#82d8ff] flex items-center justify-center text-[#0b1c30] text-sm font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#0b1c30] truncate">Dr. {name || 'Praticien'}</p>
              <p className="text-xs text-[#6f787e] truncate">{speciality || 'Professionnel de santé'}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href)
            const label = item.href === '/practitioner/ordonnances' && practitionerType === 'wellness'
              ? 'Recommandations'
              : item.label
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
                <span className="flex-1">{label}</span>
                {item.href === '/practitioner/messages' && unreadMessages > 0 && (
                  <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: '#ba1a1a' }}>
                    {unreadMessages > 99 ? '99+' : unreadMessages}
                  </span>
                )}
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
              Bonjour, <span className="font-semibold text-[#0b1c30]">Dr. {name || 'Praticien'}</span>
            </p>
            <span className="md:hidden text-base font-black tracking-tighter text-[#0b1c30]">M-Santé</span>
          </div>
          <div className="flex items-center gap-3">
            {userId && <NotificationBell userId={userId} basePath="/practitioner" historyHref="/practitioner/notifications" />}
            <div className="w-9 h-9 rounded-full bg-[#82d8ff] flex items-center justify-center text-[#0b1c30] text-sm font-bold shadow-sm">
              {initials}
            </div>
          </div>
        </header>
        <main className="flex-1 mt-16 p-4 md:p-8 overflow-y-auto">
          {/* Blocking screen: account pending validation */}
          {practitionerLoaded && verificationStatus !== null && verificationStatus !== 'approved' && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 ${
                verificationStatus === 'rejected' ? 'bg-red-100' : 'bg-amber-100'
              }`}>
                <span className={`material-symbols-outlined text-4xl ${
                  verificationStatus === 'rejected' ? 'text-red-500' : 'text-amber-500'
                }`}>
                  {verificationStatus === 'rejected' ? 'cancel' : 'pending_actions'}
                </span>
              </div>
              <h2 className="text-xl font-bold text-[#0b1c30] mb-2">
                {verificationStatus === 'rejected' ? 'Demande refusée' : 'Compte en attente de validation'}
              </h2>
              <p className="text-sm text-[#6f787e] max-w-md mb-4">
                {verificationStatus === 'rejected'
                  ? `Votre demande d'accès a été refusée.${statusReason ? ` Motif : ${statusReason}` : ''} Contactez notre équipe pour plus d'informations.`
                  : verificationStatus === 'under_review'
                    ? 'Votre dossier est en cours d\'examen par notre équipe. Vous serez notifié par email et WhatsApp dès validation.'
                    : 'Votre profil est en attente de vérification par notre équipe. Vous recevrez une notification dès que votre compte sera validé.'
                }
              </p>
              <div className="flex items-center gap-2 text-xs text-[#6f787e] bg-white/60 border border-white/80 rounded-xl px-4 py-3">
                <span className="material-symbols-outlined text-[16px] text-[#82d8ff]">notifications</span>
                Notification push, email et WhatsApp envoyés à la validation
              </div>
              <button onClick={handleLogout} className="mt-6 text-sm text-[#6f787e] underline hover:text-[#0b1c30] transition-colors">
                Se déconnecter
              </button>
            </div>
          )}
          {/* Normal content — only shown when account is approved */}
          {(!practitionerLoaded || verificationStatus === null || verificationStatus === 'approved') && (accountStatus === 'suspended' || accountStatus === 'blocked') && (
            <div className={`mb-6 rounded-xl p-4 border flex items-start gap-3 ${
              accountStatus === 'blocked'
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}>
              <span className="material-symbols-outlined text-xl flex-shrink-0">
                {accountStatus === 'blocked' ? 'block' : 'warning'}
              </span>
              <div className="flex-1">
                <p className="font-bold text-sm">
                  {accountStatus === 'blocked' ? 'Votre compte est bloqué' : 'Votre compte est suspendu'}
                </p>
                {statusReason && <p className="text-sm mt-0.5">Motif : {statusReason}</p>}
                {latestAppeal?.status === 'rejected' && (
                  <p className="text-sm mt-2 font-semibold">
                    Votre appel a été rejeté.{latestAppeal.admin_response ? ` Motif : ${latestAppeal.admin_response}` : ''}
                  </p>
                )}
                {latestAppeal?.status === 'pending' || appealSent ? (
                  <p className="mt-2 text-sm font-semibold">Appel soumis — en attente de révision.</p>
                ) : (
                  <button
                    onClick={() => setShowAppealForm(!showAppealForm)}
                    className="mt-2 text-sm font-semibold underline"
                  >
                    {latestAppeal?.status === 'rejected' ? 'Contester à nouveau' : 'Contester cette décision'}
                  </button>
                )}
                {showAppealForm && (
                  <div className="mt-3 space-y-2">
                    <textarea
                      value={appealText}
                      onChange={e => setAppealText(e.target.value)}
                      rows={3}
                      placeholder="Expliquez votre situation..."
                      className="w-full rounded-lg border border-current/30 bg-white/50 px-3 py-2 text-sm resize-none focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowAppealForm(false)}
                        className="px-3 py-1.5 text-xs font-semibold border border-current/30 rounded-lg"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={handleAppealSubmit}
                        disabled={!appealText.trim()}
                        className="px-3 py-1.5 text-xs font-semibold bg-current/20 rounded-lg disabled:opacity-50"
                      >
                        Envoyer l'appel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {/* The banner above was purely cosmetic — a suspended/blocked account kept
              full access to every tool below it. Actually gate the content: only the
              appeal banner is reachable while suspended/blocked. */}
          {(!practitionerLoaded || verificationStatus === null || verificationStatus === 'approved')
            && accountStatus !== 'suspended' && accountStatus !== 'blocked'
            && children}
        </main>
      </div>
    </div>
  )
}
