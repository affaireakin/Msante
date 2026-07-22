'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import React from 'react'
import { supabase } from '@/lib/supabase'
import NotificationBell from '@/components/NotificationBell'

type SubRole = 'admin' | 'moderator' | 'accountant' | 'readonly' | null

// routes accessible par rôle (null = super-admin, accès complet)
const ROLE_ACCESS: Record<string, string[]> = {
  moderator:  ['/admin/dashboard', '/admin/overview', '/admin/users', '/admin/practitioners', '/admin/organizations', '/admin/messages', '/admin/disputes', '/admin/appeals', '/admin/analytics', '/admin/tickets'],
  accountant: ['/admin/dashboard', '/admin/overview', '/admin/payments', '/admin/finance', '/admin/analytics', '/admin/tickets'],
  readonly:   ['/admin/dashboard', '/admin/overview', '/admin/analytics', '/admin/tickets'],
}

// Rôles admin granulaires (section 9) : un utilisateur rattaché à un
// admin_role_id personnalisé bascule sur ce système au lieu du sub_role
// legacy ci-dessus — les routes accessibles dépendent des permissions
// réellement accordées à son rôle, pas d'une liste figée par sub_role.
const PERMISSION_ROUTES: Record<string, string[]> = {
  'tickets.manage':          ['/admin/tickets'],
  'disputes.manage':         ['/admin/tickets'],
  'appeals.manage':          ['/admin/appeals'],
  'practitioners.validate':  ['/admin/practitioners'],
  'organizations.validate':  ['/admin/organizations'],
  'collaborators.validate':  ['/admin/collaborators'],
  'technical.manage':        ['/admin/tickets', '/admin/audit'],
  'users.manage':            ['/admin/users'],
  'payments.view':           ['/admin/payments', '/admin/finance'],
  'analytics.view':          ['/admin/analytics'],
  'audit.view':              ['/admin/audit'],
  'content.manage':          ['/admin/content'],
}

// Section 21.1 : le Dashboard (actions urgentes) est la page d'accueil de
// l'admin — distincte d'Overview (statistiques/analytique), qui n'est plus
// la landing page.
const dashboardItem = {
  href: '/admin/dashboard',
  label: 'Dashboard',
  roles: null as string[] | null,
  icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  ),
}

const usersGroupIcon = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
  </svg>
)

// Section 14: "Utilisateurs" regroupe tous les acteurs de la plateforme
// (patients, praticiens, collaborateurs, organisations) sous une seule
// rubrique au lieu d'entrées séparées éparpillées dans le menu.
const usersGroup = {
  label: 'Utilisateurs',
  roles: ['admin', 'moderator'],
  icon: usersGroupIcon,
  children: [
    { href: '/admin/users', label: "Vue d'ensemble", roles: ['admin', 'moderator'] },
    { href: '/admin/users?role=patient', label: 'Patients', roles: ['admin', 'moderator'] },
    { href: '/admin/practitioners', label: 'Praticiens', roles: ['admin', 'moderator'] },
    { href: '/admin/collaborators', label: 'Collaborateurs', roles: ['admin'] },
    { href: '/admin/organizations', label: 'Organisations', roles: ['admin', 'moderator'] },
  ],
}

const navItems = [
  {
    href: '/admin/payments',
    label: 'Paiements',
    roles: ['admin', 'accountant'],
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
      </svg>
    ),
  },
  {
    href: '/admin/finance',
    label: 'Live Ledger',
    roles: ['admin', 'accountant'],
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
      </svg>
    ),
  },
  {
    href: '/admin/messages',
    label: 'Messages',
    roles: ['admin', 'moderator'],
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
      </svg>
    ),
  },
  {
    href: '/admin/tickets',
    label: 'Gestion des incidents',
    roles: null,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 3h6m-7.5 6h9a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0016.5 4.5h-9a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 007.5 21z" />
      </svg>
    ),
  },
  {
    href: '/admin/analytics',
    label: 'Analytiques',
    roles: null,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
      </svg>
    ),
  },
  {
    href: '/admin/workflows',
    label: 'Workflows',
    roles: ['admin'],
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
  },
  {
    href: '/admin/appeals',
    label: 'Appels',
    roles: ['admin', 'moderator'],
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    href: '/admin/roles',
    label: 'Rôles & Droits',
    roles: ['admin'],
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    href: '/admin/content',
    label: 'Contenu du site',
    roles: ['admin'],
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
      </svg>
    ),
  },
  {
    href: '/admin/staff-roles',
    label: 'Rôles équipe',
    roles: ['admin'],
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    href: '/admin/prefixes',
    label: 'Préfixes',
    roles: ['admin'],
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L9.568 3z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
      </svg>
    ),
  },
  {
    href: '/admin/audit',
    label: 'Journal d\'audit',
    roles: ['admin'],
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
      </svg>
    ),
  },
  {
    href: '/admin/overview',
    label: 'Overview',
    roles: null, // tous
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
]

function canAccess(subRole: SubRole, href: string, permissionRoutes: Set<string> | null): boolean {
  if (permissionRoutes) {
    return href.startsWith('/admin/dashboard') || href.startsWith('/admin/overview') || Array.from(permissionRoutes).some(r => href.startsWith(r))
  }
  if (!subRole || subRole === 'admin') return true
  const allowed = ROLE_ACCESS[subRole]
  return allowed ? allowed.some(r => href.startsWith(r)) : false
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const [usersGroupOpen, setUsersGroupOpen] = React.useState(true)
  const [suspended, setSuspended] = React.useState(false)
  const [authChecked, setAuthChecked] = React.useState(false)
  const [subRole, setSubRole] = React.useState<SubRole>(null)
  const [userId, setUserId] = React.useState<string | null>(null)
  const [isSuperAdmin, setIsSuperAdmin] = React.useState(false)
  const [permissionRoutes, setPermissionRoutes] = React.useState<Set<string> | null>(null)

  React.useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace('/auth/login'); return }
      const { data } = await supabase.from('users').select('status, role, sub_role').eq('id', user.id).single()
      if (!data || data.role !== 'admin') { router.replace('/auth/login'); return }
      if (data.status === 'suspended') { setSuspended(true); return }
      const sr = (data.sub_role as SubRole) ?? null
      setSubRole(sr)
      setUserId(user.id)

      // A collaborator can hold several granular roles at once — union the
      // permissions/routes across all of them rather than a single role.
      const { data: userRoles } = await supabase.from('user_admin_roles').select('role_id').eq('user_id', user.id)
      const roleIds = (userRoles ?? []).map(r => r.role_id)
      setIsSuperAdmin(!sr && roleIds.length === 0)

      if (roleIds.length > 0) {
        const { data: perms } = await supabase
          .from('admin_role_permissions')
          .select('admin_permissions(key)')
          .in('role_id', roleIds)
        const routes = new Set<string>()
        for (const p of (perms ?? []) as unknown as { admin_permissions: { key: string } | null }[]) {
          const key = p.admin_permissions?.key
          if (key && PERMISSION_ROUTES[key]) PERMISSION_ROUTES[key].forEach(r => routes.add(r))
        }
        setPermissionRoutes(routes)
      } else {
        setPermissionRoutes(null)
      }
      setAuthChecked(true)
    })
  }, [router])

  // Redirect if current page is forbidden for this sub_role / rôle personnalisé
  React.useEffect(() => {
    if (!authChecked) return
    if (!canAccess(subRole, pathname, permissionRoutes)) {
      const fallback = permissionRoutes ? (Array.from(permissionRoutes)[0] ?? '/admin/dashboard') : (ROLE_ACCESS[subRole ?? '']?.[0] ?? '/admin/dashboard')
      router.replace(fallback)
    }
  }, [authChecked, subRole, permissionRoutes, pathname, router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  if (!authChecked) return (
    <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#82d8ff] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (suspended) return (
    <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl p-10 max-w-md w-full text-center space-y-5 shadow-xl">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
          <span className="material-symbols-outlined text-red-600 text-3xl">block</span>
        </div>
        <h2 className="text-xl font-black text-[#0b1c30]">Compte suspendu</h2>
        <p className="text-sm text-[#6f787e]">Votre accès à la console d&apos;administration a été suspendu. Contactez un super-administrateur pour plus d&apos;informations.</p>
        <button onClick={handleLogout}
          className="w-full bg-[#82d8ff] text-[#0b1c30] rounded-xl py-3 text-sm font-semibold hover:shadow-lg transition">
          Se déconnecter
        </button>
      </div>
    </div>
  )

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
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100/60">
          <div className="w-10 h-10 rounded-xl bg-[#82d8ff] flex items-center justify-center shadow-sm">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-black tracking-tighter text-[#0b1c30]">M-Santé</h1>
            <p className="text-xs text-[#82d8ff] font-semibold tracking-wide uppercase">Admin Console</p>
          </div>
          <button className="md:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-100" onClick={() => setSidebarOpen(false)}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {/* Dashboard — page d'accueil, toujours en premier */}
          <Link
            href={dashboardItem.href}
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
              pathname.startsWith(dashboardItem.href)
                ? 'bg-sky-50 text-[#82d8ff] font-semibold border-r-4 border-[#82d8ff] -mr-3 pr-4'
                : 'text-[#3f484d] hover:translate-x-1 hover:bg-slate-50/50'
            }`}
          >
            <span className={pathname.startsWith(dashboardItem.href) ? 'text-[#82d8ff]' : 'text-[#6f787e]'}>
              {dashboardItem.icon}
            </span>
            {dashboardItem.label}
          </Link>

          {/* Groupe "Utilisateurs" — patients, praticiens, collaborateurs, organisations */}
          {(() => {
            const visibleChildren = usersGroup.children.filter(c => canAccess(subRole, c.href, permissionRoutes))
            if (visibleChildren.length === 0) return null
            const groupActive = visibleChildren.some(c => pathname.startsWith(c.href.split('?')[0]))
            return (
              <div>
                <button
                  onClick={() => setUsersGroupOpen(v => !v)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 text-[#3f484d] hover:bg-slate-50/50"
                >
                  <span className={groupActive ? 'text-[#82d8ff]' : 'text-[#6f787e]'}>{usersGroup.icon}</span>
                  <span className="flex-1 text-left">{usersGroup.label}</span>
                  <svg className={`w-4 h-4 text-[#6f787e] transition-transform ${usersGroupOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {usersGroupOpen && (
                  <div className="ml-4 pl-4 border-l border-slate-200/60 space-y-1 mt-1">
                    {visibleChildren.map(child => {
                      const childActive = pathname.startsWith(child.href.split('?')[0])
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={() => setSidebarOpen(false)}
                          className={`block px-4 py-2 rounded-xl text-sm transition-all duration-200 ${
                            childActive
                              ? 'bg-sky-50 text-[#82d8ff] font-semibold'
                              : 'text-[#3f484d] hover:bg-slate-50/50'
                          }`}
                        >
                          {child.label}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })()}
          {navItems.filter(item => item.href === '/admin/staff-roles' ? isSuperAdmin : (item.roles === null || canAccess(subRole, item.href, permissionRoutes))).map((item) => {
            const isActive = pathname.startsWith(item.href)
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
                  {item.icon}
                </span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-slate-100/60 space-y-2">
          <p className="text-xs text-[#6f787e] px-2">M-Santé v1.0 · Admin</p>
          <button
            onClick={() => void handleLogout()}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 ml-0 md:ml-64 flex flex-col min-h-screen">
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
            <button className="md:hidden p-2 rounded-lg text-[#82d8ff] hover:bg-white/50 transition-colors" onClick={() => setSidebarOpen(true)}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <span className="md:hidden text-base font-black tracking-tighter text-[#0b1c30]">M-Santé</span>
            <div className="hidden md:flex items-center gap-3 bg-white/60 rounded-full px-4 py-2 border border-slate-200/50">
              <svg className="w-4 h-4 text-[#6f787e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                type="text"
                placeholder="Rechercher..."
                className="bg-transparent text-sm text-[#0b1c30] placeholder-[#6f787e] outline-none w-48"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            {userId && <NotificationBell userId={userId} />}
            <div className="w-9 h-9 rounded-full bg-[#82d8ff] flex items-center justify-center text-[#0b1c30] text-sm font-bold shadow-sm">
              A
            </div>
          </div>
        </header>

        {/* Page content */}
        {/* QA finding (section 22, responsive) : sans min-w-0, ce flex-1
            n'accepte jamais de rétrécir sous la largeur de son contenu —
            un contenu large (ex. le kanban des incidents) pousse tout le
            layout au lieu de faire apparaître un scroll horizontal borné à
            son propre conteneur. Racine du "colonnes qui sortent de l'écran". */}
        <main className="flex-1 min-w-0 mt-16 p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
