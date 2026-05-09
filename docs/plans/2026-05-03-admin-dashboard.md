# Admin Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the M-Santé basic admin dashboard — KPIs temps réel, gestion utilisateurs, validation/permissions praticiens, réconciliation paiements.

**Architecture:** Next.js 15 App Router sous `apps/web/app/admin/`, protégé par middleware Supabase SSR. TanStack Query pour le cache + Supabase Realtime pour l'invalidation temps réel. Composants UI en Tailwind pur (pas de Shadcn — incompatibilités Tailwind v4). Design glassmorphique CLAUDE.md.

**Tech Stack:** Next.js 15, Supabase SSR + Realtime, TanStack Query v5, Recharts, papaparse, Tailwind v4, Manrope.

---

### Task 1: DB migration — practitioner_type + permissions

**Files:**
- Create: `supabase/migrations/20260503000002_practitioner_permissions.sql`

**Step 1: Create the migration**

```sql
-- supabase/migrations/20260503000002_practitioner_permissions.sql

ALTER TABLE public.practitioners
  ADD COLUMN IF NOT EXISTS practitioner_type TEXT DEFAULT 'doctor'
    CHECK (practitioner_type IN ('doctor', 'psychologist', 'coach', 'nutritionist', 'other')),
  ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{"can_prescribe": true, "can_order_exams": true}';

-- Index pour requêtes admin par type
CREATE INDEX IF NOT EXISTS idx_practitioners_type ON practitioners(practitioner_type);
```

**Step 2: Commit**

```bash
git add supabase/migrations/20260503000002_practitioner_permissions.sql
git commit -m "feat(admin): add practitioner_type and permissions columns"
```

---

### Task 2: Install packages

**Files:**
- Modify: `apps/web/package.json` (via pnpm)

**Step 1: Install runtime deps**

```bash
cd "c:/Users/Khodiaou/Desktop/m-santé app"
pnpm --filter web add recharts @tanstack/react-query @tanstack/react-query-devtools papaparse
pnpm --filter web add -D @types/papaparse
```

**Step 2: Verify**

```bash
cd "c:/Users/Khodiaou/Desktop/m-santé app/apps/web"
cat package.json | grep -E "recharts|react-query|papaparse"
```

Expected: toutes les 3 dépendances présentes.

**Step 3: Commit**

```bash
git add apps/web/package.json
git commit -m "feat(admin): install recharts, tanstack-query, papaparse"
```

---

### Task 3: Supabase server client + TanStack Query provider

**Files:**
- Create: `apps/web/lib/supabase-server.ts`
- Create: `apps/web/lib/query-client.ts`
- Modify: `apps/web/app/layout.tsx`

**Step 1: Create server Supabase client**

```typescript
// apps/web/lib/supabase-server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}

export async function createSupabaseServiceClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}
```

**Step 2: Create query client singleton**

```typescript
// apps/web/lib/query-client.ts
'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState, type ReactNode } from 'react'

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
```

**Step 3: Update root layout to add QueryProvider + Manrope font**

Replace `apps/web/app/layout.tsx` with:

```typescript
// apps/web/app/layout.tsx
import type { Metadata } from 'next'
import { Manrope } from 'next/font/google'
import './globals.css'
import { QueryProvider } from '@/lib/query-client'

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'M-Santé Admin',
  description: 'M-Santé — Admin Console',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={`${manrope.variable} font-[family-name:var(--font-manrope)] antialiased bg-[#f8f9ff]`}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  )
}
```

**Step 4: Commit**

```bash
git add apps/web/lib/supabase-server.ts apps/web/lib/query-client.ts apps/web/app/layout.tsx
git commit -m "feat(admin): add supabase server client, tanstack query provider, manrope font"
```

---

### Task 4: Middleware auth admin

**Files:**
- Create: `apps/web/middleware.ts`

**Step 1: Write middleware**

```typescript
// apps/web/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Vérifie role='admin' dans la table users
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*'],
}
```

**Step 2: Commit**

```bash
git add apps/web/middleware.ts
git commit -m "feat(admin): add Next.js middleware for admin auth guard"
```

---

### Task 5: Admin layout — sidebar + topbar

**Files:**
- Create: `apps/web/app/admin/layout.tsx`
- Create: `apps/web/app/admin/page.tsx`

**Step 1: Create admin redirect page**

```typescript
// apps/web/app/admin/page.tsx
import { redirect } from 'next/navigation'

export default function AdminPage() {
  redirect('/admin/overview')
}
```

**Step 2: Create admin layout**

```typescript
// apps/web/app/admin/layout.tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type ReactNode } from 'react'

const navItems = [
  { href: '/admin/overview', label: 'Overview', icon: '📊' },
  { href: '/admin/users', label: 'Utilisateurs', icon: '👥' },
  { href: '/admin/practitioners', label: 'Praticiens', icon: '👨‍⚕️' },
  { href: '/admin/payments', label: 'Paiements', icon: '💳' },
]

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()

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
          <span className="text-3xl">🏥</span>
          <div>
            <h1 className="text-xl font-black tracking-tighter text-[#0b1c30]">M-Santé</h1>
            <p className="text-xs text-[#6f787e] font-medium">Admin Console</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-sky-50 text-[#006685] font-semibold border-r-4 border-[#006685]'
                    : 'text-[#3f484d] hover:translate-x-1 hover:bg-slate-50/50'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100/60">
          <p className="text-xs text-[#6f787e]">M-Santé v1.0 · Admin</p>
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
            <span className="text-[#6f787e] text-sm">🔍</span>
            <input
              type="text"
              placeholder="Rechercher..."
              className="bg-transparent text-sm text-[#0b1c30] placeholder-[#6f787e] outline-none w-48"
            />
          </div>
          <div className="flex items-center gap-4">
            <button className="w-9 h-9 flex items-center justify-center rounded-full bg-white/60 border border-slate-200/50 text-[#6f787e] hover:bg-white transition-colors">
              🔔
            </button>
            <div className="w-9 h-9 rounded-full bg-[#006685] flex items-center justify-center text-white text-sm font-bold">
              A
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 mt-16 p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add apps/web/app/admin/layout.tsx apps/web/app/admin/page.tsx
git commit -m "feat(admin): add admin layout with glassmorphic sidebar and topbar"
```

---

### Task 6: Edge Function `notify-practitioner-approved`

**Files:**
- Create: `supabase/functions/notify-practitioner-approved/index.ts`

**Context:** Appelée après approbation d'un praticien depuis le dashboard admin. Envoie la notification `practitioner_approved`.

**Step 1: Write the Edge Function**

```typescript
// supabase/functions/notify-practitioner-approved/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createNotificationService } from '../../packages/notifications/index.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Vérifie que l'appelant est admin
    const { data: callerProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (callerProfile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { practitionerUserId } = await req.json() as { practitionerUserId?: string }
    if (!practitionerUserId) {
      return new Response(JSON.stringify({ error: 'practitionerUserId required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: practUser } = await supabase
      .from('users')
      .select('id, full_name, email, push_token')
      .eq('id', practitionerUserId)
      .single()

    if (!practUser) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? ''
    const notifService = createNotificationService(supabase, resendApiKey)

    await notifService.send({
      type: 'practitioner_approved',
      recipient: {
        id: practUser.id,
        full_name: practUser.full_name,
        email: practUser.email,
        push_token: practUser.push_token,
      },
      data: {},
    })

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
```

**Step 2: Commit**

```bash
git add supabase/functions/notify-practitioner-approved/index.ts
git commit -m "feat(admin): add notify-practitioner-approved Edge Function"
```

---

### Task 7: Overview page — KPI cards + Realtime

**Files:**
- Create: `apps/web/app/admin/overview/page.tsx`
- Create: `apps/web/app/admin/overview/KpiCard.tsx`
- Create: `apps/web/app/admin/overview/useAdminKpis.ts`

**Step 1: Create KPI hook with Realtime**

```typescript
// apps/web/app/admin/overview/useAdminKpis.ts
'use client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export interface AdminKpis {
  activeUsers30d: number
  revenueThisMonth: number
  pendingPractitioners: number
  noShowRate: number
}

async function fetchKpis(): Promise<AdminKpis> {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [
    { count: activeUsers },
    { data: revenueData },
    { count: pendingPractitioners },
    { count: noShowCount },
    { count: totalCount },
  ] = await Promise.all([
    supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('updated_at', thirtyDaysAgo),
    supabase
      .from('payments')
      .select('amount')
      .eq('status', 'completed')
      .gte('created_at', monthStart),
    supabase
      .from('practitioners')
      .select('*', { count: 'exact', head: true })
      .eq('verification_status', 'pending'),
    supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'no_show'),
    supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .not('status', 'in', '("pending","cancelled")'),
  ])

  const revenue = (revenueData ?? []).reduce((sum, p) => sum + (p.amount ?? 0), 0)
  const noShowRate = totalCount && totalCount > 0
    ? Math.round(((noShowCount ?? 0) / totalCount) * 100)
    : 0

  return {
    activeUsers30d: activeUsers ?? 0,
    revenueThisMonth: revenue,
    pendingPractitioners: pendingPractitioners ?? 0,
    noShowRate,
  }
}

export function useAdminKpis() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel('admin-kpis-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['admin-kpis'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['admin-kpis'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'practitioners' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['admin-kpis'] })
      })
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [queryClient])

  return useQuery({
    queryKey: ['admin-kpis'],
    queryFn: fetchKpis,
  })
}
```

**Step 2: Create KpiCard component**

```typescript
// apps/web/app/admin/overview/KpiCard.tsx
interface KpiCardProps {
  title: string
  value: string | number
  icon: string
  subtitle?: string
  trend?: string
  trendUp?: boolean
}

export function KpiCard({ title, value, icon, subtitle, trend, trendUp }: KpiCardProps) {
  return (
    <div
      className="rounded-2xl p-6 flex flex-col gap-4"
      style={{
        backgroundColor: 'rgba(255,255,255,0.60)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.80)',
        boxShadow: '0 10px 30px -10px rgba(0,102,133,0.05)',
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-[#006685] uppercase tracking-widest">{title}</span>
        <span className="text-2xl">{icon}</span>
      </div>
      <div>
        <p className="text-3xl font-bold text-[#0b1c30]">{value}</p>
        {subtitle && <p className="text-sm text-[#6f787e] mt-1">{subtitle}</p>}
      </div>
      {trend && (
        <span
          className={`text-xs font-semibold px-2 py-1 rounded-full w-fit ${
            trendUp ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
          }`}
        >
          {trend}
        </span>
      )}
    </div>
  )
}
```

**Step 3: Create overview page (KPIs only — charts in Task 8)**

```typescript
// apps/web/app/admin/overview/page.tsx
'use client'
import { useAdminKpis } from './useAdminKpis'
import { KpiCard } from './KpiCard'
import { AdminCharts } from './AdminCharts'

export default function OverviewPage() {
  const { data: kpis, isLoading } = useAdminKpis()

  const formatXOF = (amount: number) =>
    new Intl.NumberFormat('fr-SN', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(amount)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#0b1c30]">Vue d'ensemble</h1>
        <p className="text-sm text-[#6f787e] mt-1">Données en temps réel</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <KpiCard
          title="Utilisateurs actifs (30j)"
          value={isLoading ? '...' : kpis?.activeUsers30d ?? 0}
          icon="👥"
          subtitle="Derniers 30 jours"
        />
        <KpiCard
          title="Revenus du mois"
          value={isLoading ? '...' : formatXOF(kpis?.revenueThisMonth ?? 0)}
          icon="💰"
          subtitle="Paiements complétés"
        />
        <KpiCard
          title="Praticiens en attente"
          value={isLoading ? '...' : kpis?.pendingPractitioners ?? 0}
          icon="⏳"
          subtitle="Validation requise"
          trend={kpis && kpis.pendingPractitioners > 0 ? `${kpis.pendingPractitioners} en attente` : undefined}
          trendUp={false}
        />
        <KpiCard
          title="Taux de no-show"
          value={isLoading ? '...' : `${kpis?.noShowRate ?? 0}%`}
          icon="📅"
          subtitle="Rendez-vous manqués"
        />
      </div>

      {/* Charts */}
      <AdminCharts />
    </div>
  )
}
```

**Step 4: Commit**

```bash
git add apps/web/app/admin/overview/
git commit -m "feat(admin): add overview page with realtime KPI cards"
```

---

### Task 8: Overview — Charts Recharts

**Files:**
- Create: `apps/web/app/admin/overview/AdminCharts.tsx`
- Create: `apps/web/app/admin/overview/useAdminCharts.ts`

**Step 1: Create charts data hook**

```typescript
// apps/web/app/admin/overview/useAdminCharts.ts
'use client'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface RevenueDay { date: string; revenue: number }
export interface UsersDay { date: string; count: number }
export interface AppointmentStatus { status: string; count: number }
export interface PaymentProvider { provider: string; count: number }

export interface AdminChartsData {
  revenue7d: RevenueDay[]
  users7d: UsersDay[]
  appointmentsByStatus: AppointmentStatus[]
  paymentsByProvider: PaymentProvider[]
}

async function fetchChartsData(): Promise<AdminChartsData> {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().split('T')[0]
  })

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  const sevenDaysAgoISO = sevenDaysAgo.toISOString()

  const [
    { data: payments },
    { data: users },
    { data: appointments },
    { data: allPayments },
  ] = await Promise.all([
    supabase
      .from('payments')
      .select('amount, created_at')
      .eq('status', 'completed')
      .gte('created_at', sevenDaysAgoISO),
    supabase
      .from('users')
      .select('created_at')
      .gte('created_at', sevenDaysAgoISO),
    supabase
      .from('appointments')
      .select('status'),
    supabase
      .from('payments')
      .select('provider'),
  ])

  // Revenue by day
  const revenueByDay: Record<string, number> = {}
  days.forEach((d) => { revenueByDay[d] = 0 })
  ;(payments ?? []).forEach((p) => {
    const day = p.created_at.split('T')[0]
    if (day in revenueByDay) revenueByDay[day] += p.amount ?? 0
  })
  const revenue7d = days.map((date) => ({ date, revenue: Math.round(revenueByDay[date]) }))

  // Users by day
  const usersByDay: Record<string, number> = {}
  days.forEach((d) => { usersByDay[d] = 0 })
  ;(users ?? []).forEach((u) => {
    const day = u.created_at.split('T')[0]
    if (day in usersByDay) usersByDay[day]++
  })
  const users7d = days.map((date) => ({ date, count: usersByDay[date] }))

  // Appointments by status
  const statusMap: Record<string, number> = {}
  ;(appointments ?? []).forEach((a) => {
    statusMap[a.status] = (statusMap[a.status] ?? 0) + 1
  })
  const appointmentsByStatus = Object.entries(statusMap).map(([status, count]) => ({ status, count }))

  // Payments by provider
  const providerMap: Record<string, number> = {}
  ;(allPayments ?? []).forEach((p) => {
    providerMap[p.provider] = (providerMap[p.provider] ?? 0) + 1
  })
  const paymentsByProvider = Object.entries(providerMap).map(([provider, count]) => ({ provider, count }))

  return { revenue7d, users7d, appointmentsByStatus, paymentsByProvider }
}

export function useAdminCharts() {
  return useQuery({
    queryKey: ['admin-charts'],
    queryFn: fetchChartsData,
    staleTime: 60_000,
  })
}
```

**Step 2: Create AdminCharts component**

```typescript
// apps/web/app/admin/overview/AdminCharts.tsx
'use client'
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { useAdminCharts } from './useAdminCharts'

const COLORS = ['#006685', '#ffde5c', '#82d8ff', '#ba1a1a', '#1d7a3a']
const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente', confirmed: 'Confirmé', completed: 'Terminé',
  cancelled: 'Annulé', no_show: 'No-show',
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-6"
      style={{
        backgroundColor: 'rgba(255,255,255,0.60)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.80)',
        boxShadow: '0 10px 30px -10px rgba(0,102,133,0.05)',
      }}
    >
      <h3 className="text-xs font-bold text-[#006685] uppercase tracking-widest mb-6">{title}</h3>
      {children}
    </div>
  )
}

export function AdminCharts() {
  const { data, isLoading } = useAdminCharts()

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl h-64 animate-pulse bg-white/40" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* Revenus 7j */}
      <ChartCard title="Revenus 7 derniers jours (XOF)">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data?.revenue7d ?? []}>
            <defs>
              <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#006685" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#006685" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(190,200,206,0.3)" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6f787e' }} tickFormatter={(v: string) => v.slice(5)} />
            <YAxis tick={{ fontSize: 11, fill: '#6f787e' }} />
            <Tooltip formatter={(v: number) => [`${v.toLocaleString()} XOF`, 'Revenus']} />
            <Area type="monotone" dataKey="revenue" stroke="#006685" strokeWidth={2} fill="url(#revenueGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Nouveaux utilisateurs 7j */}
      <ChartCard title="Nouveaux utilisateurs 7j">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data?.users7d ?? []}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(190,200,206,0.3)" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6f787e' }} tickFormatter={(v: string) => v.slice(5)} />
            <YAxis tick={{ fontSize: 11, fill: '#6f787e' }} allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="count" name="Nouveaux" stroke="#ffde5c" strokeWidth={2} dot={{ fill: '#ffde5c' }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* RDV par statut */}
      <ChartCard title="Rendez-vous par statut">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={(data?.appointmentsByStatus ?? []).map((d) => ({ ...d, label: STATUS_LABELS[d.status] ?? d.status }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(190,200,206,0.3)" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6f787e' }} />
            <YAxis tick={{ fontSize: 11, fill: '#6f787e' }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" name="RDV" fill="#006685" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Providers paiement */}
      <ChartCard title="Paiements par provider">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data?.paymentsByProvider ?? []}
              dataKey="count"
              nameKey="provider"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={({ provider, percent }: { provider: string; percent: number }) =>
                `${provider} ${(percent * 100).toFixed(0)}%`
              }
            >
              {(data?.paymentsByProvider ?? []).map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add apps/web/app/admin/overview/AdminCharts.tsx apps/web/app/admin/overview/useAdminCharts.ts
git commit -m "feat(admin): add overview charts (revenue, users, appointments, providers)"
```

---

### Task 9: Users page — tableau + search + sheet

**Files:**
- Create: `apps/web/app/admin/users/page.tsx`

**Step 1: Write the page**

```typescript
// apps/web/app/admin/users/page.tsx
'use client'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type Role = 'all' | 'patient' | 'practitioner' | 'admin'

interface UserRow {
  id: string
  full_name: string
  email?: string | null
  role: string
  country: string | null
  onboarding_completed: boolean
  created_at: string
}

const PAGE_SIZE = 10

function useUsers(role: Role, search: string, page: number) {
  return useQuery({
    queryKey: ['admin-users', role, search, page],
    queryFn: async () => {
      let query = supabase
        .from('users')
        .select('id, full_name, role, country, onboarding_completed, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (role !== 'all') query = query.eq('role', role)
      if (search.trim()) query = query.ilike('full_name', `%${search.trim()}%`)

      const { data, count, error } = await query
      if (error) throw error
      return { users: (data ?? []) as UserRow[], total: count ?? 0 }
    },
    staleTime: 30_000,
  })
}

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    admin: 'bg-purple-100 text-purple-700',
    practitioner: 'bg-sky-100 text-sky-700',
    patient: 'bg-emerald-100 text-emerald-700',
  }
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors[role] ?? 'bg-gray-100 text-gray-600'}`}>
      {role}
    </span>
  )
}

export default function UsersPage() {
  const [role, setRole] = useState<Role>('all')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(0)
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null)

  // Debounce search
  const handleSearch = (value: string) => {
    setSearch(value)
    clearTimeout((handleSearch as unknown as { timer?: ReturnType<typeof setTimeout> }).timer)
    const timer = setTimeout(() => { setDebouncedSearch(value); setPage(0) }, 300)
    ;(handleSearch as unknown as { timer?: ReturnType<typeof setTimeout> }).timer = timer
  }

  const { data, isLoading } = useUsers(role, debouncedSearch, page)
  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE)

  const filters: { label: string; value: Role }[] = [
    { label: 'Tous', value: 'all' },
    { label: 'Patients', value: 'patient' },
    { label: 'Praticiens', value: 'practitioner' },
    { label: 'Admins', value: 'admin' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0b1c30]">Utilisateurs</h1>
        <p className="text-sm text-[#6f787e] mt-1">{data?.total ?? 0} utilisateurs au total</p>
      </div>

      {/* Filters + Search */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex gap-2">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => { setRole(f.value); setPage(0) }}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                role === f.value
                  ? 'bg-[#006685] text-white'
                  : 'bg-white/60 text-[#3f484d] border border-slate-200/50 hover:bg-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Rechercher par nom..."
          className="px-4 py-2 rounded-full text-sm bg-white/60 border border-slate-200/50 outline-none text-[#0b1c30] placeholder-[#6f787e] focus:border-[#006685] transition-colors"
        />
      </div>

      {/* Table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          backgroundColor: 'rgba(255,255,255,0.60)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.80)',
          boxShadow: '0 10px 30px -10px rgba(0,102,133,0.05)',
        }}
      >
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100/60">
              <th className="text-left px-6 py-4 text-xs font-bold text-[#006685] uppercase tracking-widest">Utilisateur</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-[#006685] uppercase tracking-widest">Rôle</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-[#006685] uppercase tracking-widest">Pays</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-[#006685] uppercase tracking-widest">Onboarding</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-[#006685] uppercase tracking-widest">Inscrit le</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-50/60">
                  {Array.from({ length: 5 }).map((__, j) => (
                    <td key={j} className="px-6 py-4">
                      <div className="h-4 bg-slate-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : (data?.users ?? []).map((user) => (
              <tr
                key={user.id}
                onClick={() => setSelectedUser(user)}
                className="border-b border-slate-50/60 hover:bg-white/40 cursor-pointer transition-colors"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#006685] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {initials(user.full_name)}
                    </div>
                    <span className="text-sm font-medium text-[#0b1c30]">{user.full_name}</span>
                  </div>
                </td>
                <td className="px-6 py-4"><RoleBadge role={user.role} /></td>
                <td className="px-6 py-4 text-sm text-[#6f787e]">{user.country ?? '—'}</td>
                <td className="px-6 py-4">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${user.onboarding_completed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {user.onboarding_completed ? 'Complété' : 'En cours'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-[#6f787e]">
                  {new Date(user.created_at).toLocaleDateString('fr-FR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100/60">
          <p className="text-sm text-[#6f787e]">
            Affichage {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, data?.total ?? 0)} sur {data?.total ?? 0}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 rounded-lg text-sm border border-slate-200/50 disabled:opacity-40 hover:bg-white transition-colors"
            >
              ←
            </button>
            <span className="px-3 py-1.5 text-sm text-[#0b1c30]">{page + 1} / {totalPages || 1}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 rounded-lg text-sm border border-slate-200/50 disabled:opacity-40 hover:bg-white transition-colors"
            >
              →
            </button>
          </div>
        </div>
      </div>

      {/* Sheet slide-out profil */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setSelectedUser(null)} />
          <div
            className="relative w-96 h-full p-8 flex flex-col gap-6 overflow-y-auto"
            style={{ backgroundColor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)' }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#0b1c30]">Profil utilisateur</h2>
              <button onClick={() => setSelectedUser(null)} className="text-[#6f787e] hover:text-[#0b1c30] text-xl">✕</button>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-[#006685] flex items-center justify-center text-white text-2xl font-bold">
                {initials(selectedUser.full_name)}
              </div>
              <div>
                <p className="text-lg font-semibold text-[#0b1c30]">{selectedUser.full_name}</p>
                <RoleBadge role={selectedUser.role} />
              </div>
            </div>
            <div className="space-y-4">
              {[
                { label: 'ID', value: selectedUser.id.slice(0, 8) + '…' },
                { label: 'Pays', value: selectedUser.country ?? '—' },
                { label: 'Onboarding', value: selectedUser.onboarding_completed ? 'Complété' : 'En cours' },
                { label: 'Inscrit le', value: new Date(selectedUser.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between py-3 border-b border-slate-100">
                  <span className="text-sm text-[#6f787e]">{label}</span>
                  <span className="text-sm font-medium text-[#0b1c30]">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add apps/web/app/admin/users/page.tsx
git commit -m "feat(admin): add users page with search, filters, pagination and profile sheet"
```

---

### Task 10: Practitioners page — validation + permissions

**Files:**
- Create: `apps/web/app/admin/practitioners/page.tsx`

**Step 1: Write the page**

```typescript
// apps/web/app/admin/practitioners/page.tsx
'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type VerifStatus = 'pending' | 'under_review' | 'approved' | 'rejected'
type PractType = 'doctor' | 'psychologist' | 'coach' | 'nutritionist' | 'other'

interface Practitioner {
  id: string
  user_id: string
  speciality: string
  verification_status: VerifStatus
  practitioner_type: PractType | null
  permissions: { can_prescribe: boolean; can_order_exams: boolean } | null
  created_at: string
  users: { full_name: string; email: string | null } | null
}

const STATUS_ORDER: VerifStatus[] = ['pending', 'under_review', 'approved', 'rejected']
const STATUS_LABELS: Record<VerifStatus, string> = {
  pending: 'En attente',
  under_review: 'En revue',
  approved: 'Approuvé',
  rejected: 'Rejeté',
}
const STATUS_COLORS: Record<VerifStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  under_review: 'bg-blue-100 text-blue-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
}
const TYPE_LABELS: Record<PractType, string> = {
  doctor: 'Médecin',
  psychologist: 'Psychologue',
  coach: 'Coach',
  nutritionist: 'Nutritionniste',
  other: 'Autre',
}
const DEFAULT_PERMISSIONS: Record<PractType, { can_prescribe: boolean; can_order_exams: boolean }> = {
  doctor: { can_prescribe: true, can_order_exams: true },
  psychologist: { can_prescribe: false, can_order_exams: false },
  coach: { can_prescribe: false, can_order_exams: false },
  nutritionist: { can_prescribe: false, can_order_exams: false },
  other: { can_prescribe: false, can_order_exams: false },
}

function usePractitioners() {
  return useQuery({
    queryKey: ['admin-practitioners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('practitioners')
        .select('id, user_id, speciality, verification_status, practitioner_type, permissions, created_at, users!inner(full_name, email)')
        .order('created_at', { ascending: false })
      if (error) throw error
      const sorted = (data ?? []) as Practitioner[]
      sorted.sort((a, b) =>
        STATUS_ORDER.indexOf(a.verification_status) - STATUS_ORDER.indexOf(b.verification_status)
      )
      return sorted
    },
    staleTime: 30_000,
  })
}

export default function PractitionersPage() {
  const queryClient = useQueryClient()
  const { data: practitioners, isLoading } = usePractitioners()
  const [rejectDialog, setRejectDialog] = useState<{ practId: string; userId: string } | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const updateStatus = useMutation({
    mutationFn: async ({ practId, status, userId }: { practId: string; status: VerifStatus; userId: string }) => {
      const updates: Record<string, unknown> = { verification_status: status }
      if (status === 'approved') updates.is_verified = true
      const { error } = await supabase.from('practitioners').update(updates).eq('id', practId)
      if (error) throw error

      // Notify practitioner on approval
      if (status === 'approved') {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          await supabase.functions.invoke('notify-practitioner-approved', {
            body: { practitionerUserId: userId },
          })
        }
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-practitioners'] }),
  })

  const updatePermissions = useMutation({
    mutationFn: async ({
      practId,
      practType,
      permissions,
    }: {
      practId: string
      practType: PractType
      permissions: { can_prescribe: boolean; can_order_exams: boolean }
    }) => {
      const { error } = await supabase
        .from('practitioners')
        .update({ practitioner_type: practType, permissions })
        .eq('id', practId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-practitioners'] }),
  })

  const handleApprove = (practId: string, userId: string) => {
    updateStatus.mutate({ practId, status: 'approved', userId })
  }

  const handleReview = (practId: string, userId: string) => {
    updateStatus.mutate({ practId, status: 'under_review', userId })
  }

  const handleReject = () => {
    if (!rejectDialog || !rejectReason.trim()) return
    updateStatus.mutate({ practId: rejectDialog.practId, status: 'rejected', userId: rejectDialog.userId })
    setRejectDialog(null)
    setRejectReason('')
  }

  const handleTypeChange = (pract: Practitioner, newType: PractType) => {
    updatePermissions.mutate({
      practId: pract.id,
      practType: newType,
      permissions: DEFAULT_PERMISSIONS[newType],
    })
  }

  const handlePermissionToggle = (
    pract: Practitioner,
    key: 'can_prescribe' | 'can_order_exams'
  ) => {
    const current = pract.permissions ?? DEFAULT_PERMISSIONS[pract.practitioner_type ?? 'doctor']
    updatePermissions.mutate({
      practId: pract.id,
      practType: pract.practitioner_type ?? 'doctor',
      permissions: { ...current, [key]: !current[key] },
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0b1c30]">Praticiens</h1>
        <p className="text-sm text-[#6f787e] mt-1">Validation et gestion des permissions</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl h-40 animate-pulse bg-white/40" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {(practitioners ?? []).map((pract) => (
            <div
              key={pract.id}
              className="rounded-2xl p-6"
              style={{
                backgroundColor: 'rgba(255,255,255,0.60)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.80)',
                boxShadow: '0 10px 30px -10px rgba(0,102,133,0.05)',
              }}
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                {/* Identité */}
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#006685] flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                    {(pract.users?.full_name ?? 'P').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-[#0b1c30]">{pract.users?.full_name ?? '—'}</p>
                    <p className="text-sm text-[#6f787e]">{pract.speciality}</p>
                    <p className="text-xs text-[#6f787e] mt-0.5">
                      Soumis le {new Date(pract.created_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>

                {/* Statut + Actions validation */}
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${STATUS_COLORS[pract.verification_status]}`}>
                    {STATUS_LABELS[pract.verification_status]}
                  </span>
                  {pract.verification_status !== 'approved' && (
                    <button
                      onClick={() => handleApprove(pract.id, pract.user_id)}
                      disabled={updateStatus.isPending}
                      className="px-4 py-2 bg-emerald-500 text-white text-sm font-semibold rounded-full hover:bg-emerald-600 transition-colors disabled:opacity-50"
                    >
                      Approuver
                    </button>
                  )}
                  {pract.verification_status === 'pending' && (
                    <button
                      onClick={() => handleReview(pract.id, pract.user_id)}
                      disabled={updateStatus.isPending}
                      className="px-4 py-2 bg-blue-100 text-blue-700 text-sm font-semibold rounded-full hover:bg-blue-200 transition-colors disabled:opacity-50"
                    >
                      Mettre en revue
                    </button>
                  )}
                  {pract.verification_status !== 'rejected' && (
                    <button
                      onClick={() => setRejectDialog({ practId: pract.id, userId: pract.user_id })}
                      className="px-4 py-2 bg-red-100 text-red-700 text-sm font-semibold rounded-full hover:bg-red-200 transition-colors"
                    >
                      Rejeter
                    </button>
                  )}
                </div>
              </div>

              {/* Permissions */}
              <div className="mt-6 pt-5 border-t border-slate-100/60 flex items-center gap-6 flex-wrap">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-[#6f787e] uppercase tracking-widest">Type</label>
                  <select
                    value={pract.practitioner_type ?? 'doctor'}
                    onChange={(e) => handleTypeChange(pract, e.target.value as PractType)}
                    className="text-sm border border-slate-200/50 rounded-lg px-3 py-1.5 bg-white/60 text-[#0b1c30] outline-none focus:border-[#006685]"
                  >
                    {(Object.entries(TYPE_LABELS) as [PractType, string][]).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>

                {(['can_prescribe', 'can_order_exams'] as const).map((key) => {
                  const perms = pract.permissions ?? DEFAULT_PERMISSIONS[pract.practitioner_type ?? 'doctor']
                  const enabled = perms[key]
                  return (
                    <button
                      key={key}
                      onClick={() => handlePermissionToggle(pract, key)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                        enabled
                          ? 'bg-[#006685] text-white border-[#006685]'
                          : 'bg-white/60 text-[#6f787e] border-slate-200/50'
                      }`}
                    >
                      {enabled ? '✓' : '✗'}{' '}
                      {key === 'can_prescribe' ? 'Ordonnances' : 'Examens'}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject Dialog */}
      {rejectDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setRejectDialog(null)} />
          <div className="relative bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-[#0b1c30] mb-4">Motif de rejet</h3>
            <p className="text-sm text-[#6f787e] mb-4">Ce motif sera conservé en interne.</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ex: Documents insuffisants, diplôme non reconnu..."
              className="w-full h-28 px-4 py-3 border border-slate-200 rounded-xl text-sm text-[#0b1c30] outline-none focus:border-[#006685] resize-none"
            />
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setRejectDialog(null)}
                className="flex-1 py-2.5 border border-slate-200 rounded-full text-sm font-medium text-[#6f787e] hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim()}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-full text-sm font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                Confirmer le rejet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add apps/web/app/admin/practitioners/page.tsx
git commit -m "feat(admin): add practitioners page with validation and permissions management"
```

---

### Task 11: Payments page — tableau + filtres + export CSV

**Files:**
- Create: `apps/web/app/admin/payments/page.tsx`

**Step 1: Write the page**

```typescript
// apps/web/app/admin/payments/page.tsx
'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Papa from 'papaparse'

type PaymentStatus = 'all' | 'pending' | 'processing' | 'completed' | 'failed' | 'refunded'
type Provider = 'all' | 'wave' | 'orange_money' | 'stripe' | 'simulated'

interface PaymentRow {
  id: string
  amount: number
  currency: string
  provider: string
  status: string
  created_at: string
  patient: { full_name: string } | null
  practitioner_user: { full_name: string } | null
}

const PAGE_SIZE = 10

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  processing: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
  refunded: 'bg-gray-100 text-gray-600',
}

function usePayments(status: PaymentStatus, provider: Provider, page: number) {
  return useQuery({
    queryKey: ['admin-payments', status, provider, page],
    queryFn: async () => {
      let query = supabase
        .from('payments')
        .select(`
          id, amount, currency, provider, status, created_at,
          patient:users!payments_patient_id_fkey (full_name),
          practitioner_user:practitioners!inner (users!inner (full_name))
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (status !== 'all') query = query.eq('status', status)
      if (provider !== 'all') query = query.eq('provider', provider)

      const { data, count, error } = await query
      if (error) throw error
      return { payments: (data ?? []) as unknown as PaymentRow[], total: count ?? 0 }
    },
    staleTime: 30_000,
  })
}

function useTotals() {
  return useQuery({
    queryKey: ['admin-payment-totals'],
    queryFn: async () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const [{ data: todayData }, { count: pendingCount }, { count: failedCount }] = await Promise.all([
        supabase.from('payments').select('amount').eq('status', 'completed').gte('created_at', today.toISOString()),
        supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
      ])

      return {
        todayRevenue: (todayData ?? []).reduce((s, p) => s + (p.amount ?? 0), 0),
        pendingCount: pendingCount ?? 0,
        failedCount: failedCount ?? 0,
      }
    },
  })
}

export default function PaymentsPage() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<PaymentStatus>('all')
  const [provider, setProvider] = useState<Provider>('all')
  const [page, setPage] = useState(0)

  const { data, isLoading } = usePayments(status, provider, page)
  const { data: totals } = useTotals()
  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE)

  const refund = useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase
        .from('payments')
        .update({ status: 'refunded', updated_at: new Date().toISOString() })
        .eq('id', paymentId)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-payments'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-payment-totals'] })
    },
  })

  const handleExportCSV = () => {
    const rows = (data?.payments ?? []).map((p) => ({
      Date: new Date(p.created_at).toLocaleDateString('fr-FR'),
      Patient: p.patient?.full_name ?? '—',
      Praticien: p.practitioner_user?.full_name ?? '—',
      Montant: p.amount,
      Devise: p.currency,
      Provider: p.provider,
      Statut: p.status,
      ID: p.id,
    }))
    const csv = Papa.unparse(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `msante-paiements-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const formatXOF = (amount: number) =>
    new Intl.NumberFormat('fr-SN', { maximumFractionDigits: 0 }).format(amount) + ' XOF'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1c30]">Paiements</h1>
          <p className="text-sm text-[#6f787e] mt-1">Réconciliation et suivi des transactions</p>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#006685] text-white text-sm font-semibold rounded-full hover:bg-[#005070] transition-colors"
        >
          📥 Exporter CSV
        </button>
      </div>

      {/* Totaux */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Revenus aujourd'hui", value: formatXOF(totals?.todayRevenue ?? 0), color: 'text-emerald-600' },
          { label: 'En attente', value: `${totals?.pendingCount ?? 0} transactions`, color: 'text-amber-600' },
          { label: 'Échoués', value: `${totals?.failedCount ?? 0} transactions`, color: 'text-red-600' },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="rounded-2xl p-5"
            style={{ backgroundColor: 'rgba(255,255,255,0.60)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.80)' }}
          >
            <p className="text-xs font-bold text-[#006685] uppercase tracking-widest mb-2">{label}</p>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex gap-2">
          {(['all', 'completed', 'pending', 'failed', 'refunded'] as PaymentStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => { setStatus(s); setPage(0) }}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                status === s ? 'bg-[#006685] text-white' : 'bg-white/60 text-[#3f484d] border border-slate-200/50 hover:bg-white'
              }`}
            >
              {s === 'all' ? 'Tous' : s}
            </button>
          ))}
        </div>
        <select
          value={provider}
          onChange={(e) => { setProvider(e.target.value as Provider); setPage(0) }}
          className="px-4 py-2 rounded-full text-sm bg-white/60 border border-slate-200/50 text-[#0b1c30] outline-none focus:border-[#006685]"
        >
          <option value="all">Tous providers</option>
          <option value="wave">Wave</option>
          <option value="orange_money">Orange Money</option>
          <option value="stripe">Stripe</option>
          <option value="simulated">Simulé</option>
        </select>
      </div>

      {/* Table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ backgroundColor: 'rgba(255,255,255,0.60)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.80)', boxShadow: '0 10px 30px -10px rgba(0,102,133,0.05)' }}
      >
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100/60">
              {['Date', 'Patient', 'Praticien', 'Montant', 'Provider', 'Statut', 'Action'].map((h) => (
                <th key={h} className="text-left px-6 py-4 text-xs font-bold text-[#006685] uppercase tracking-widest">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-50/60">
                  {Array.from({ length: 7 }).map((__, j) => (
                    <td key={j} className="px-6 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : (data?.payments ?? []).map((payment) => (
              <tr key={payment.id} className="border-b border-slate-50/60 hover:bg-white/30 transition-colors">
                <td className="px-6 py-4 text-sm text-[#6f787e]">{new Date(payment.created_at).toLocaleDateString('fr-FR')}</td>
                <td className="px-6 py-4 text-sm font-medium text-[#0b1c30]">{payment.patient?.full_name ?? '—'}</td>
                <td className="px-6 py-4 text-sm text-[#6f787e]">{payment.practitioner_user?.full_name ?? '—'}</td>
                <td className="px-6 py-4 text-sm font-semibold text-[#0b1c30]">{formatXOF(payment.amount)}</td>
                <td className="px-6 py-4 text-sm text-[#6f787e] capitalize">{payment.provider}</td>
                <td className="px-6 py-4">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[payment.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {payment.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {payment.status === 'failed' && (
                    <button
                      onClick={() => refund.mutate(payment.id)}
                      disabled={refund.isPending}
                      className="text-xs px-3 py-1.5 bg-amber-100 text-amber-700 rounded-full font-semibold hover:bg-amber-200 transition-colors disabled:opacity-50"
                    >
                      Rembourser
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100/60">
          <p className="text-sm text-[#6f787e]">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, data?.total ?? 0)} sur {data?.total ?? 0}
          </p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1.5 rounded-lg text-sm border border-slate-200/50 disabled:opacity-40 hover:bg-white transition-colors">←</button>
            <span className="px-3 py-1.5 text-sm text-[#0b1c30]">{page + 1} / {totalPages || 1}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-3 py-1.5 rounded-lg text-sm border border-slate-200/50 disabled:opacity-40 hover:bg-white transition-colors">→</button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add apps/web/app/admin/payments/page.tsx
git commit -m "feat(admin): add payments page with filters, totals, refund action and CSV export"
```

---

### Task 12: Gate prescription in consultation summary (permissions.can_prescribe)

**Files:**
- Modify: `apps/mobile/app/(patient)/consultation/summary.tsx`
- Modify: `apps/web/app/practitioner/consultation/[appointmentId]/summary/page.tsx`

**Context:** Le praticien ne doit pas voir le bouton d'upload d'ordonnance si `permissions.can_prescribe = false`. La vérification se fait depuis la table `practitioners` via `consultationId → appointments.practitioner_id → practitioners.permissions`.

**Step 1: Modify web summary page**

In `apps/web/app/practitioner/consultation/[appointmentId]/summary/page.tsx`, add a check for `can_prescribe`. Read the current file first to identify where `prescription` upload UI is rendered.

Add at the top of the component, after loading consultation data, fetch practitioner permissions:
```typescript
// Fetch practitioner permissions
const { data: practData } = await supabase
  .from('practitioners')
  .select('permissions')
  .eq('user_id', userId)  // userId = authenticated practitioner user
  .single()

const canPrescribe = (practData?.permissions as { can_prescribe?: boolean } | null)?.can_prescribe ?? true
```

Then wrap the prescription upload section with `{canPrescribe && (...)}`.

**Step 2: Commit**

```bash
git add apps/web/app/practitioner/consultation/[appointmentId]/summary/page.tsx
git commit -m "feat(admin): gate prescription upload by can_prescribe permission"
```

---

### Task 13: Final typecheck

**Step 1: Typecheck web**

```bash
cd "c:/Users/Khodiaou/Desktop/m-santé app"
npx tsc --project apps/web/tsconfig.json --noEmit 2>&1 | grep -v node_modules | head -50
```

Expected: no errors.

**Step 2: Typecheck mobile**

```bash
npx tsc --project apps/mobile/tsconfig.json --noEmit 2>&1 | grep -v node_modules | head -30
```

Expected: no errors.

**Step 3: Fix any errors in admin files and commit**

```bash
git add -A
git commit -m "fix(admin): typecheck fixes"
```
