'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

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
  const [practitionerId, setPractitionerId] = useState<string | null>(null)
  const [showAppealForm, setShowAppealForm] = useState(false)
  const [appealText, setAppealText] = useState('')
  const [appealSent, setAppealSent] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/auth/login'); return }
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
            .select('id, speciality, account_status, status_reason')
            .eq('user_id', user.id)
            .single()
            .then(({ data: pract }) => {
              if (pract) {
                setSpeciality(pract.speciality ?? '')
                setAccountStatus(pract.account_status ?? null)
                setStatusReasonText(pract.status_reason ?? null)
                setPractitionerId(pract.id)
              }
            })
        })
    })
  }, [router])

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
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100/60">
          <div className="w-10 h-10 rounded-xl bg-[#006685] flex items-center justify-center shadow-sm">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tighter text-[#0b1c30]">M-Santé</h1>
            <p className="text-xs text-[#006685] font-semibold tracking-wide uppercase">Clinical Portal</p>
          </div>
        </div>

        {/* Profil praticien */}
        <div className="px-4 py-4 border-b border-slate-100/60">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#e5eeff]">
            <div className="w-9 h-9 rounded-full bg-[#006685] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#0b1c30] truncate">Dr. {name || 'Praticien'}</p>
              <p className="text-xs text-[#6f787e] truncate">{speciality || 'Professionnel de santé'}</p>
            </div>
          </div>
        </div>

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
                <span className={isActive ? 'text-[#006685]' : 'text-[#6f787e]'}>{item.icon}</span>
                {item.label}
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

      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        <header
          className="fixed top-0 right-0 left-64 h-16 z-20 flex items-center justify-between px-8"
          style={{
            backgroundColor: 'rgba(255,255,255,0.40)',
            backdropFilter: 'blur(16px)',
            borderBottom: '1px solid rgba(255,255,255,0.10)',
          }}
        >
          <p className="text-sm font-medium text-[#6f787e]">
            Bonjour, <span className="font-semibold text-[#0b1c30]">Dr. {name || 'Praticien'}</span>
          </p>
          <div className="flex items-center gap-3">
            <button className="w-9 h-9 flex items-center justify-center rounded-full bg-white/60 border border-slate-200/50 text-[#6f787e] hover:bg-white transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>notifications</span>
            </button>
            <div className="w-9 h-9 rounded-full bg-[#006685] flex items-center justify-center text-white text-sm font-bold shadow-sm">
              {initials}
            </div>
          </div>
        </header>
        <main className="flex-1 mt-16 p-8 overflow-y-auto">
          {(accountStatus === 'suspended' || accountStatus === 'blocked') && (
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
                {!appealSent ? (
                  <button
                    onClick={() => setShowAppealForm(!showAppealForm)}
                    className="mt-2 text-sm font-semibold underline"
                  >
                    Contester cette décision
                  </button>
                ) : (
                  <p className="mt-2 text-sm font-semibold">Appel soumis — en attente de révision.</p>
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
          {children}
        </main>
      </div>
    </div>
  )
}
