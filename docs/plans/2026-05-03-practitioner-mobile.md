# Espace Praticien Mobile V1 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remplacer le placeholder `(practitioner)/home.tsx` par 4 écrans fonctionnels : Dashboard KPIs, Agenda avec approbations, Répertoire patients, Profile stub — fidèles aux designs de référence.

**Architecture:** Expo Router Tabs (4 onglets) dans `app/(practitioner)/`, hooks TanStack Query dans `features/practitioner/hooks/`, mutations Supabase dans `features/practitioner/services/appointmentActions.ts`. Composants NativeWind glassmorphiques cohérents avec le design system M-Santé.

**Tech Stack:** React Native + Expo Router, NativeWind v4, TanStack Query v5, Supabase, Zustand (authStore existant), GlassCard + PrimaryButton existants.

---

### Task 1: Tab navigator `_layout.tsx` + suppression `home.tsx`

**Files:**
- Modify: `apps/mobile/app/(practitioner)/_layout.tsx`
- Delete: `apps/mobile/app/(practitioner)/home.tsx` (remplacé par `index.tsx`)
- Create: `apps/mobile/app/(practitioner)/index.tsx` (placeholder temporaire)
- Create: `apps/mobile/app/(practitioner)/agenda.tsx` (placeholder)
- Create: `apps/mobile/app/(practitioner)/patients.tsx` (placeholder)
- Create: `apps/mobile/app/(practitioner)/profile.tsx` (placeholder)

**Step 1: Remplacer `_layout.tsx` avec Tab navigator**

```typescript
// apps/mobile/app/(practitioner)/_layout.tsx
import { Redirect, Tabs } from 'expo-router'
import { View, Text, Platform } from 'react-native'
import { useAuth } from '@/features/auth/hooks/useAuth'

interface TabIconProps {
  emoji: string
  label: string
  focused: boolean
}

function TabIcon({ emoji, label, focused }: TabIconProps) {
  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: focused ? 'rgba(0,102,133,0.08)' : 'transparent',
        minWidth: 52,
      }}
    >
      <Text style={{ fontSize: focused ? 21 : 19 }}>{emoji}</Text>
      <Text
        style={{
          fontSize: 10,
          fontFamily: 'Manrope',
          color: focused ? '#006685' : '#6f787e',
          fontWeight: focused ? '700' : '400',
          marginTop: 2,
          letterSpacing: 0.3,
        }}
      >
        {label}
      </Text>
    </View>
  )
}

export default function PractitionerLayout() {
  const { isAuthenticated, profile } = useAuth()
  if (!isAuthenticated || profile?.role !== 'practitioner') {
    return <Redirect href="/(auth)/welcome" />
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          height: Platform.OS === 'ios' ? 86 : 66,
          backgroundColor: 'rgba(255,255,255,0.80)',
          borderTopColor: 'rgba(255,255,255,0.30)',
          borderTopWidth: 1,
          elevation: 0,
          shadowColor: '#82d8ff',
          shadowOpacity: 0.12,
          shadowOffset: { width: 0, height: -8 },
          shadowRadius: 24,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="📊" label="Dashboard" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="agenda"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="📅" label="Agenda" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="patients"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="👥" label="Patients" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" label="Profil" focused={focused} />,
        }}
      />
    </Tabs>
  )
}
```

**Step 2: Créer les 4 placeholders**

```typescript
// apps/mobile/app/(practitioner)/index.tsx
import { View, Text } from 'react-native'
export default function DashboardScreen() {
  return <View className="flex-1 bg-[#f8f9ff] items-center justify-center"><Text>Dashboard</Text></View>
}
```

```typescript
// apps/mobile/app/(practitioner)/agenda.tsx
import { View, Text } from 'react-native'
export default function AgendaScreen() {
  return <View className="flex-1 bg-[#f8f9ff] items-center justify-center"><Text>Agenda</Text></View>
}
```

```typescript
// apps/mobile/app/(practitioner)/patients.tsx
import { View, Text } from 'react-native'
export default function PatientsScreen() {
  return <View className="flex-1 bg-[#f8f9ff] items-center justify-center"><Text>Patients</Text></View>
}
```

```typescript
// apps/mobile/app/(practitioner)/profile.tsx
import { View, Text } from 'react-native'
export default function ProfileScreen() {
  return <View className="flex-1 bg-[#f8f9ff] items-center justify-center"><Text>Profil</Text></View>
}
```

**Step 3: Supprimer `home.tsx`**

```bash
rm "apps/mobile/app/(practitioner)/home.tsx"
```

**Step 4: Commit**

```bash
git add apps/mobile/app/(practitioner)/
git commit -m "feat(practitioner): add tab navigator with 4 screens (placeholders)"
```

---

### Task 2: Feature hooks — `useDashboard` + `useAgenda` + `usePatients` + `appointmentActions`

**Files:**
- Create: `apps/mobile/features/practitioner/hooks/useDashboard.ts`
- Create: `apps/mobile/features/practitioner/hooks/useAgenda.ts`
- Create: `apps/mobile/features/practitioner/hooks/usePatients.ts`
- Create: `apps/mobile/features/practitioner/services/appointmentActions.ts`

**Step 1: Créer `useDashboard.ts`**

```typescript
// apps/mobile/features/practitioner/hooks/useDashboard.ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'

export interface DashboardData {
  earningsThisMonth: number
  earningsTrend: number // % vs mois précédent
  consultationsTotal: number
  rating: number
  todayAppointments: TodayAppointment[]
  recentActivity: ActivityItem[]
}

export interface TodayAppointment {
  id: string
  patientName: string
  patientInitials: string
  type: string // 'Follow-up' | 'Initial Consultation' | 'Video Call'
  scheduledAt: string
  status: string
}

export interface ActivityItem {
  id: string
  title: string
  body: string
  type: string
  createdAt: string
}

export function useDashboard(practitionerId: string, userId: string) {
  return useQuery({
    queryKey: ['practitioner-dashboard', practitionerId],
    queryFn: async (): Promise<DashboardData> => {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString()

      const [
        { data: paymentsThisMonth },
        { data: paymentsLastMonth },
        { count: consultationsTotal },
        { data: practitioner },
        { data: todayAppts },
        { data: notifications },
      ] = await Promise.all([
        supabase.from('payments').select('amount').eq('practitioner_id', practitionerId).eq('status', 'completed').gte('created_at', startOfMonth),
        supabase.from('payments').select('amount').eq('practitioner_id', practitionerId).eq('status', 'completed').gte('created_at', startOfLastMonth).lte('created_at', endOfLastMonth),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('practitioner_id', practitionerId).eq('status', 'completed'),
        supabase.from('practitioners').select('rating').eq('id', practitionerId).single(),
        supabase.from('appointments').select('id, scheduled_at, status, notes, type, users!appointments_patient_id_fkey(full_name)').eq('practitioner_id', practitionerId).gte('scheduled_at', todayStart).lte('scheduled_at', todayEnd).in('status', ['confirmed', 'pending']).order('scheduled_at', { ascending: true }).limit(5),
        supabase.from('notifications').select('id, title, body, type, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
      ])

      const earningsThisMonth = (paymentsThisMonth ?? []).reduce((s, p) => s + (p.amount ?? 0), 0)
      const earningsLastMonth = (paymentsLastMonth ?? []).reduce((s, p) => s + (p.amount ?? 0), 0)
      const earningsTrend = earningsLastMonth > 0
        ? Math.round(((earningsThisMonth - earningsLastMonth) / earningsLastMonth) * 100)
        : 0

      const todayAppointments: TodayAppointment[] = (todayAppts ?? []).map((a) => {
        const patient = a.users as unknown as { full_name: string } | null
        const name = patient?.full_name ?? 'Patient'
        const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
        return {
          id: a.id,
          patientName: name,
          patientInitials: initials,
          type: a.type === 'video' ? 'Video Call' : a.type === 'audio' ? 'Audio Call' : 'Chat',
          scheduledAt: a.scheduled_at,
          status: a.status,
        }
      })

      const recentActivity: ActivityItem[] = (notifications ?? []).map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        type: n.type,
        createdAt: n.created_at,
      }))

      return {
        earningsThisMonth,
        earningsTrend,
        consultationsTotal: consultationsTotal ?? 0,
        rating: (practitioner?.rating as number) ?? 0,
        todayAppointments,
        recentActivity,
      }
    },
    staleTime: 30_000,
    enabled: !!practitionerId,
  })
}
```

**Step 2: Créer `useAgenda.ts`**

```typescript
// apps/mobile/features/practitioner/hooks/useAgenda.ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'

export interface AgendaAppointment {
  id: string
  patientName: string
  patientInitials: string
  consultationType: string // 'Telehealth' | 'In-person'
  scheduledAt: string
  notes: string | null
  status: string
}

export function useAgenda(practitionerId: string) {
  return useQuery({
    queryKey: ['practitioner-agenda', practitionerId],
    queryFn: async () => {
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString()

      const { data, error } = await supabase
        .from('appointments')
        .select('id, scheduled_at, status, notes, type, users!appointments_patient_id_fkey(full_name)')
        .eq('practitioner_id', practitionerId)
        .gte('scheduled_at', todayStart)
        .lte('scheduled_at', todayEnd)
        .order('scheduled_at', { ascending: true })

      if (error) throw error

      const appointments: AgendaAppointment[] = (data ?? []).map((a) => {
        const patient = a.users as unknown as { full_name: string } | null
        const name = patient?.full_name ?? 'Patient'
        const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
        return {
          id: a.id,
          patientName: name,
          patientInitials: initials,
          consultationType: a.type === 'video' ? 'Telehealth' : 'In-person',
          scheduledAt: a.scheduled_at,
          notes: a.notes,
          status: a.status,
        }
      })

      return {
        pending: appointments.filter((a) => a.status === 'pending'),
        confirmed: appointments.filter((a) => a.status === 'confirmed'),
      }
    },
    staleTime: 15_000,
    enabled: !!practitionerId,
  })
}
```

**Step 3: Créer `usePatients.ts`**

```typescript
// apps/mobile/features/practitioner/hooks/usePatients.ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'

export interface PatientItem {
  patientId: string
  patientName: string
  patientInitials: string
  shortId: string // 4 derniers chars UUID
  lastConsultDate: string | null
  lastConsultNotes: string | null
  status: 'follow-up' | 'stable'
}

export function usePatients(practitionerId: string) {
  return useQuery({
    queryKey: ['practitioner-patients', practitionerId],
    queryFn: async (): Promise<PatientItem[]> => {
      const { data, error } = await supabase
        .from('appointments')
        .select('patient_id, scheduled_at, notes, status, users!appointments_patient_id_fkey(id, full_name)')
        .eq('practitioner_id', practitionerId)
        .in('status', ['completed', 'confirmed', 'cancelled'])
        .order('scheduled_at', { ascending: false })

      if (error) throw error

      // Dédupliquer par patient, garder la dernière consultation
      const patientMap = new Map<string, PatientItem>()
      for (const appt of data ?? []) {
        const patient = appt.users as unknown as { id: string; full_name: string } | null
        if (!patient || patientMap.has(appt.patient_id)) continue
        const name = patient.full_name
        const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
        const shortId = appt.patient_id.replace(/-/g, '').slice(-4).toUpperCase()
        const daysSince = appt.scheduled_at
          ? Math.floor((Date.now() - new Date(appt.scheduled_at).getTime()) / 86400000)
          : 999
        patientMap.set(appt.patient_id, {
          patientId: appt.patient_id,
          patientName: name,
          patientInitials: initials,
          shortId: `MS-${shortId}`,
          lastConsultDate: appt.scheduled_at,
          lastConsultNotes: appt.notes,
          status: daysSince > 30 ? 'follow-up' : 'stable',
        })
      }

      return Array.from(patientMap.values())
    },
    staleTime: 30_000,
    enabled: !!practitionerId,
  })
}
```

**Step 4: Créer `appointmentActions.ts`**

```typescript
// apps/mobile/features/practitioner/services/appointmentActions.ts
import { supabase } from '@/services/supabase'

export async function approveAppointment(appointmentId: string, patientId: string): Promise<void> {
  const { error } = await supabase
    .from('appointments')
    .update({ status: 'confirmed' })
    .eq('id', appointmentId)
  if (error) throw error

  await supabase.from('notifications').insert({
    user_id: patientId,
    type: 'appointment_confirm',
    title: 'Rendez-vous confirmé',
    body: 'Votre rendez-vous a été confirmé par le praticien.',
    channel: 'push',
  })
}

export async function declineAppointment(appointmentId: string, patientId: string): Promise<void> {
  const { error } = await supabase
    .from('appointments')
    .update({ status: 'cancelled' })
    .eq('id', appointmentId)
  if (error) throw error

  await supabase.from('notifications').insert({
    user_id: patientId,
    type: 'appointment_cancelled',
    title: 'Rendez-vous annulé',
    body: 'Votre rendez-vous a été décliné par le praticien.',
    channel: 'push',
  })
}
```

**Step 5: Commit**

```bash
git add apps/mobile/features/practitioner/
git commit -m "feat(practitioner): add useDashboard, useAgenda, usePatients hooks and appointmentActions"
```

---

### Task 3: Dashboard screen `index.tsx`

**Files:**
- Modify: `apps/mobile/app/(practitioner)/index.tsx`

**Step 1: Implémenter le Dashboard complet**

```typescript
// apps/mobile/app/(practitioner)/index.tsx
import { ScrollView, View, Text, TouchableOpacity, StatusBar } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useDashboard } from '@/features/practitioner/hooks/useDashboard'
import { GlassCard } from '@/components/ui/GlassCard'

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return 'À l\'instant'
  if (h < 24) return `Il y a ${h}h`
  return 'Hier'
}

function InitialsAvatar({ initials, size = 44 }: { initials: string; size?: number }) {
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#006685' }}
      className="items-center justify-center"
    >
      <Text style={{ color: '#fff', fontFamily: 'Manrope', fontWeight: '700', fontSize: size * 0.36 }}>
        {initials}
      </Text>
    </View>
  )
}

export default function DashboardScreen() {
  const { profile, practitioner } = useAuth()
  const { data, isLoading } = useDashboard(practitioner?.id ?? '', profile?.id ?? '')

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Praticien'

  return (
    <SafeAreaView className="flex-1 bg-[#f8f9ff]" edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9ff" />

      {/* Header */}
      <View
        className="flex-row items-center justify-between px-6 py-3 border-b border-white/20"
        style={{ backgroundColor: 'rgba(255,255,255,0.70)', backdropFilter: 'blur(20px)' }}
      >
        <View className="flex-row items-center gap-3">
          <InitialsAvatar initials={(profile?.full_name ?? 'P').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()} size={40} />
          <View>
            <Text style={{ fontFamily: 'Manrope', fontWeight: '700', fontSize: 16, color: '#0284c7' }}>
              Dr. {firstName}
            </Text>
            <Text style={{ fontFamily: 'Manrope', fontSize: 11, color: '#6f787e', letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Practitioner Portal
            </Text>
          </View>
        </View>
        <View className="w-10 h-10 rounded-full bg-white/50 border border-white/40 items-center justify-center">
          <Text style={{ fontSize: 18 }}>🔔</Text>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, gap: 32 }} showsVerticalScrollIndicator={false}>

        {/* KPI Bento Grid */}
        <View style={{ gap: 12 }}>
          {/* Earnings — full width */}
          <GlassCard>
            <View className="flex-row items-center gap-2 mb-2">
              <Text style={{ fontSize: 16 }}>💰</Text>
              <Text style={{ fontFamily: 'Manrope', fontSize: 11, fontWeight: '700', color: '#6f787e', letterSpacing: 1, textTransform: 'uppercase' }}>
                Revenus
              </Text>
            </View>
            {isLoading ? (
              <View className="h-10 bg-slate-100 rounded animate-pulse" />
            ) : (
              <>
                <Text style={{ fontFamily: 'Manrope', fontSize: 36, fontWeight: '700', color: '#006685', letterSpacing: -1 }}>
                  {new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(data?.earningsThisMonth ?? 0)} XOF
                </Text>
                <View className="flex-row items-center gap-1 mt-1">
                  <Text style={{ fontSize: 12 }}>{(data?.earningsTrend ?? 0) >= 0 ? '📈' : '📉'}</Text>
                  <Text style={{ fontFamily: 'Manrope', fontSize: 13, color: (data?.earningsTrend ?? 0) >= 0 ? '#16a34a' : '#dc2626' }}>
                    {(data?.earningsTrend ?? 0) >= 0 ? '+' : ''}{data?.earningsTrend ?? 0}% ce mois
                  </Text>
                </View>
              </>
            )}
          </GlassCard>

          {/* Consultations + Rating */}
          <View className="flex-row gap-3">
            <GlassCard className="flex-1">
              <Text style={{ fontFamily: 'Manrope', fontSize: 11, fontWeight: '700', color: '#6f787e', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
                🩺 Consultations
              </Text>
              <Text style={{ fontFamily: 'Manrope', fontSize: 28, fontWeight: '600', color: '#0b1c30' }}>
                {data?.consultationsTotal ?? '—'}
              </Text>
            </GlassCard>
            <GlassCard className="flex-1">
              <Text style={{ fontFamily: 'Manrope', fontSize: 11, fontWeight: '700', color: '#6f787e', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
                ⭐ Note
              </Text>
              <View className="flex-row items-baseline gap-1">
                <Text style={{ fontFamily: 'Manrope', fontSize: 28, fontWeight: '600', color: '#0b1c30' }}>
                  {data?.rating?.toFixed(1) ?? '—'}
                </Text>
                <Text style={{ fontFamily: 'Manrope', fontSize: 13, color: '#6f787e' }}>/5</Text>
              </View>
            </GlassCard>
          </View>
        </View>

        {/* Today's Agenda */}
        <View style={{ gap: 12 }}>
          <View className="flex-row justify-between items-center px-1">
            <Text style={{ fontFamily: 'Manrope', fontSize: 20, fontWeight: '600', color: '#0b1c30', letterSpacing: -0.3 }}>
              Agenda du jour
            </Text>
            <TouchableOpacity>
              <Text style={{ fontFamily: 'Manrope', fontSize: 11, fontWeight: '700', color: '#006685', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                VOIR TOUT
              </Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <GlassCard><View className="h-20 bg-slate-100 rounded" /></GlassCard>
          ) : (data?.todayAppointments ?? []).length === 0 ? (
            <GlassCard>
              <Text style={{ fontFamily: 'Manrope', fontSize: 14, color: '#6f787e', textAlign: 'center' }}>
                Aucun rendez-vous aujourd'hui
              </Text>
            </GlassCard>
          ) : (
            (data?.todayAppointments ?? []).map((appt, index) => (
              <GlassCard key={appt.id}>
                <View className="flex-row justify-between items-start mb-3">
                  <View className="flex-row items-center gap-3">
                    <InitialsAvatar initials={appt.patientInitials} size={44} />
                    <View>
                      <Text style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: '600', color: '#0b1c30' }}>
                        {appt.patientName}
                      </Text>
                      <Text style={{ fontFamily: 'Manrope', fontSize: 13, color: '#6f787e' }}>
                        {appt.type}
                      </Text>
                    </View>
                  </View>
                  <View
                    className="px-3 py-1 rounded-full flex-row items-center gap-1"
                    style={{ backgroundColor: '#82d8ff' }}
                  >
                    <Text style={{ fontSize: 11 }}>🕐</Text>
                    <Text style={{ fontFamily: 'Manrope', fontSize: 11, fontWeight: '700', color: '#005e7a' }}>
                      {formatTime(appt.scheduledAt)}
                    </Text>
                  </View>
                </View>

                {index === 0 && (
                  <>
                    <View className="h-px bg-slate-100 mb-3" />
                    <TouchableOpacity
                      className="w-full py-3 rounded-xl items-center justify-center flex-row gap-2"
                      style={{ backgroundColor: '#006685' }}
                    >
                      <Text style={{ fontSize: 16 }}>🎥</Text>
                      <Text style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: '600', color: '#fff' }}>
                        Démarrer la session
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </GlassCard>
            ))
          )}
        </View>

        {/* Recent Activity */}
        <View style={{ gap: 12 }}>
          <Text style={{ fontFamily: 'Manrope', fontSize: 20, fontWeight: '600', color: '#0b1c30', letterSpacing: -0.3, paddingHorizontal: 4 }}>
            Activité récente
          </Text>
          <View
            className="rounded-xl border border-white/40 overflow-hidden p-2"
            style={{ backgroundColor: 'rgba(255,255,255,0.50)' }}
          >
            {(data?.recentActivity ?? []).length === 0 ? (
              <View className="py-6 items-center">
                <Text style={{ fontFamily: 'Manrope', fontSize: 14, color: '#6f787e' }}>Aucune activité récente</Text>
              </View>
            ) : (
              (data?.recentActivity ?? []).map((item, i) => (
                <View key={item.id}>
                  <View className="flex-row gap-4 items-start p-3">
                    <View
                      className="w-10 h-10 rounded-full items-center justify-center border border-white/50"
                      style={{ backgroundColor: item.type?.includes('payment') ? '#ffde5c' : '#e5eeff' }}
                    >
                      <Text style={{ fontSize: 16 }}>
                        {item.type?.includes('payment') ? '💳' : '✉️'}
                      </Text>
                    </View>
                    <View className="flex-1 gap-0.5">
                      <Text style={{ fontFamily: 'Manrope', fontSize: 14, fontWeight: '500', color: '#0b1c30' }}>
                        {item.title}
                      </Text>
                      <Text style={{ fontFamily: 'Manrope', fontSize: 12, color: '#6f787e' }} numberOfLines={1}>
                        {item.body}
                      </Text>
                      <Text style={{ fontFamily: 'Manrope', fontSize: 11, color: '#5c5f61', marginTop: 2 }}>
                        {relativeTime(item.createdAt)}
                      </Text>
                    </View>
                  </View>
                  {i < (data?.recentActivity ?? []).length - 1 && (
                    <View className="h-px bg-slate-100/60 ml-16" />
                  )}
                </View>
              ))
            )}
          </View>
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>
    </SafeAreaView>
  )
}
```

**Step 2: Commit**

```bash
git add apps/mobile/app/(practitioner)/index.tsx
git commit -m "feat(practitioner): implement Dashboard screen with KPIs, agenda and activity"
```

---

### Task 4: Agenda screen `agenda.tsx`

**Files:**
- Modify: `apps/mobile/app/(practitioner)/agenda.tsx`

**Step 1: Implémenter l'écran Agenda**

```typescript
// apps/mobile/app/(practitioner)/agenda.tsx
import { ScrollView, View, Text, TouchableOpacity, Alert, StatusBar } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useAgenda } from '@/features/practitioner/hooks/useAgenda'
import { approveAppointment, declineAppointment } from '@/features/practitioner/services/appointmentActions'
import { GlassCard } from '@/components/ui/GlassCard'
import type { AgendaAppointment } from '@/features/practitioner/hooks/useAgenda'

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function InitialsAvatar({ initials }: { initials: string }) {
  return (
    <View className="w-11 h-11 rounded-full items-center justify-center" style={{ backgroundColor: '#006685' }}>
      <Text style={{ color: '#fff', fontFamily: 'Manrope', fontWeight: '700', fontSize: 16 }}>{initials}</Text>
    </View>
  )
}

function AppointmentCard({
  appt,
  onApprove,
  onDecline,
  isPending,
}: {
  appt: AgendaAppointment
  onApprove: () => void
  onDecline: () => void
  isPending: boolean
}) {
  return (
    <GlassCard style={{ gap: 16 }}>
      <View className="flex-row items-start gap-3">
        <InitialsAvatar initials={appt.patientInitials} />
        <View className="flex-1">
          <Text style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: '600', color: '#0b1c30' }}>
            {appt.patientName}
          </Text>
          <View className="flex-row items-center gap-1.5 mt-0.5">
            <Text style={{ fontSize: 12 }}>{appt.consultationType === 'Telehealth' ? '📹' : '🏥'}</Text>
            <Text style={{ fontFamily: 'Manrope', fontSize: 13, color: '#6f787e' }}>
              {appt.consultationType}
            </Text>
          </View>
        </View>
      </View>

      <View className="flex-row items-center gap-2 px-3 py-2 rounded-xl" style={{ backgroundColor: '#eff4ff' }}>
        <Text style={{ fontSize: 14 }}>📅</Text>
        <Text style={{ fontFamily: 'Manrope', fontSize: 13, color: '#006685', fontWeight: '500' }}>
          {formatDateTime(appt.scheduledAt)}
        </Text>
      </View>

      {appt.notes ? (
        <Text style={{ fontFamily: 'Manrope', fontSize: 13, color: '#3f484d', lineHeight: 18 }} numberOfLines={2}>
          "{appt.notes}"
        </Text>
      ) : null}

      <View className="flex-row gap-3">
        <TouchableOpacity
          onPress={onApprove}
          disabled={isPending}
          className="flex-1 py-3 rounded-full items-center"
          style={{ backgroundColor: '#006685', opacity: isPending ? 0.5 : 1 }}
        >
          <Text style={{ fontFamily: 'Manrope', fontSize: 14, fontWeight: '700', color: '#fff' }}>
            Approuver
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {}}
          disabled={isPending}
          className="flex-1 py-3 rounded-full items-center border border-slate-200"
          style={{ backgroundColor: 'rgba(255,255,255,0.60)' }}
        >
          <Text style={{ fontFamily: 'Manrope', fontSize: 14, fontWeight: '600', color: '#006685' }}>
            Reprogrammer
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onDecline}
          disabled={isPending}
          className="py-3 px-4 rounded-full items-center"
        >
          <Text style={{ fontFamily: 'Manrope', fontSize: 14, fontWeight: '600', color: '#ba1a1a', opacity: isPending ? 0.5 : 1 }}>
            Refuser
          </Text>
        </TouchableOpacity>
      </View>
    </GlassCard>
  )
}

export default function AgendaScreen() {
  const { practitioner } = useAuth()
  const queryClient = useQueryClient()
  const { data, isLoading } = useAgenda(practitioner?.id ?? '')

  const approveMutation = useMutation({
    mutationFn: ({ appointmentId, patientId }: { appointmentId: string; patientId: string }) =>
      approveAppointment(appointmentId, patientId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['practitioner-agenda'] }),
    onError: () => Alert.alert('Erreur', 'Impossible d\'approuver ce rendez-vous.'),
  })

  const declineMutation = useMutation({
    mutationFn: ({ appointmentId, patientId }: { appointmentId: string; patientId: string }) =>
      declineAppointment(appointmentId, patientId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['practitioner-agenda'] }),
    onError: () => Alert.alert('Erreur', 'Impossible de refuser ce rendez-vous.'),
  })

  const pendingCount = data?.pending?.length ?? 0

  return (
    <SafeAreaView className="flex-1 bg-[#f8f9ff]" edges={['top']}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View
        className="flex-row items-center justify-between px-6 h-16 border-b border-white/20"
        style={{ backgroundColor: 'rgba(255,255,255,0.70)' }}
      >
        <Text style={{ fontFamily: 'Manrope', fontSize: 22, fontWeight: '600', color: '#0284c7', letterSpacing: -0.3 }}>
          Appointments
        </Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, gap: 24 }} showsVerticalScrollIndicator={false}>

        {/* Pending Approvals */}
        <View style={{ gap: 12 }}>
          <View className="flex-row items-center justify-between">
            <Text style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: '600', color: '#0b1c30' }}>
              Pending Approvals
            </Text>
            {pendingCount > 0 && (
              <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: '#82d8ff' }}>
                <Text style={{ fontFamily: 'Manrope', fontSize: 11, fontWeight: '700', color: '#005e7a' }}>
                  {pendingCount} Requests
                </Text>
              </View>
            )}
          </View>

          {isLoading ? (
            [1, 2].map((i) => (
              <View key={i} className="h-44 rounded-xl bg-white/40 animate-pulse" />
            ))
          ) : pendingCount === 0 ? (
            <GlassCard>
              <Text style={{ fontFamily: 'Manrope', fontSize: 14, color: '#6f787e', textAlign: 'center', paddingVertical: 8 }}>
                Aucune demande en attente
              </Text>
            </GlassCard>
          ) : (
            data?.pending.map((appt) => (
              <AppointmentCard
                key={appt.id}
                appt={appt}
                onApprove={() => approveMutation.mutate({ appointmentId: appt.id, patientId: appt.patientInitials })}
                onDecline={() =>
                  Alert.alert('Refuser ce RDV ?', 'Le patient sera notifié.', [
                    { text: 'Annuler', style: 'cancel' },
                    { text: 'Refuser', style: 'destructive', onPress: () => declineMutation.mutate({ appointmentId: appt.id, patientId: appt.patientInitials }) },
                  ])
                }
                isPending={approveMutation.isPending || declineMutation.isPending}
              />
            ))
          )}
        </View>

        {/* Confirmed today */}
        {(data?.confirmed ?? []).length > 0 && (
          <View style={{ gap: 12 }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: '600', color: '#0b1c30' }}>
              Confirmés aujourd'hui
            </Text>
            {data?.confirmed.map((appt) => (
              <GlassCard key={appt.id}>
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3">
                    <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: '#e5eeff' }}>
                      <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '700', color: '#006685' }}>
                        {appt.patientInitials}
                      </Text>
                    </View>
                    <View>
                      <Text style={{ fontFamily: 'Manrope', fontSize: 14, fontWeight: '600', color: '#0b1c30' }}>
                        {appt.patientName}
                      </Text>
                      <Text style={{ fontFamily: 'Manrope', fontSize: 12, color: '#6f787e' }}>
                        {appt.consultationType}
                      </Text>
                    </View>
                  </View>
                  <View className="px-3 py-1 rounded-full" style={{ backgroundColor: '#bee9ff' }}>
                    <Text style={{ fontFamily: 'Manrope', fontSize: 11, fontWeight: '700', color: '#004d65' }}>
                      {new Date(appt.scheduledAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              </GlassCard>
            ))}
          </View>
        )}

        <View style={{ height: 16 }} />
      </ScrollView>
    </SafeAreaView>
  )
}
```

**Step 2: Commit**

```bash
git add apps/mobile/app/(practitioner)/agenda.tsx
git commit -m "feat(practitioner): implement Agenda screen with pending approvals and confirmed appointments"
```

---

### Task 5: Patients screen `patients.tsx`

**Files:**
- Modify: `apps/mobile/app/(practitioner)/patients.tsx`

**Step 1: Implémenter l'écran Patients**

```typescript
// apps/mobile/app/(practitioner)/patients.tsx
import { useState, useMemo } from 'react'
import { ScrollView, View, Text, TouchableOpacity, TextInput, StatusBar } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { usePatients } from '@/features/practitioner/hooks/usePatients'
import { GlassCard } from '@/components/ui/GlassCard'
import type { PatientItem } from '@/features/practitioner/hooks/usePatients'

type FilterTab = 'all' | 'follow-up' | 'stable'

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All Patients' },
  { key: 'follow-up', label: 'Requires Follow-up' },
  { key: 'stable', label: 'Stable' },
]

const AVATAR_COLORS = ['#006685', '#705d00', '#1d7a3a', '#5c5f61', '#ba1a1a']

function PatientCard({ patient }: { patient: PatientItem }) {
  const colorIndex = patient.shortId.charCodeAt(patient.shortId.length - 1) % AVATAR_COLORS.length
  const avatarColor = AVATAR_COLORS[colorIndex]

  return (
    <GlassCard style={{ gap: 12 }}>
      <View className="flex-row items-start justify-between">
        <View className="flex-row items-center gap-3 flex-1">
          <View
            className="w-12 h-12 rounded-full items-center justify-center"
            style={{ backgroundColor: avatarColor }}
          >
            <Text style={{ fontFamily: 'Manrope', fontWeight: '700', fontSize: 16, color: '#fff' }}>
              {patient.patientInitials}
            </Text>
          </View>
          <View className="flex-1">
            <Text style={{ fontFamily: 'Manrope', fontSize: 16, fontWeight: '700', color: '#0b1c30' }}>
              {patient.patientName}
            </Text>
            <Text style={{ fontFamily: 'Manrope', fontSize: 12, color: '#6f787e', marginTop: 1 }}>
              ID: {patient.shortId}
            </Text>
          </View>
        </View>
        <View
          className="px-2.5 py-1 rounded-full"
          style={{ backgroundColor: patient.status === 'follow-up' ? '#ffdad6' : '#d1fae5' }}
        >
          <Text style={{
            fontFamily: 'Manrope', fontSize: 11, fontWeight: '700',
            color: patient.status === 'follow-up' ? '#ba1a1a' : '#1d7a3a',
          }}>
            {patient.status === 'follow-up' ? 'Follow-up' : 'Stable'}
          </Text>
        </View>
      </View>

      {patient.lastConsultDate && (
        <View className="flex-row items-start gap-2 px-3 py-2.5 rounded-xl" style={{ backgroundColor: '#eff4ff' }}>
          <Text style={{ fontSize: 14, marginTop: 1 }}>📅</Text>
          <View className="flex-1">
            <Text style={{ fontFamily: 'Manrope', fontSize: 12, color: '#6f787e' }}>
              Dernière consultation : {new Date(patient.lastConsultDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </Text>
            {patient.lastConsultNotes ? (
              <Text style={{ fontFamily: 'Manrope', fontSize: 12, color: '#3f484d', marginTop: 2 }} numberOfLines={2}>
                {patient.lastConsultNotes}
              </Text>
            ) : null}
          </View>
        </View>
      )}

      <View className="flex-row gap-3">
        <TouchableOpacity
          className="flex-1 py-2.5 rounded-full border border-slate-200 items-center flex-row justify-center gap-1.5"
          style={{ backgroundColor: 'rgba(255,255,255,0.60)' }}
        >
          <Text style={{ fontSize: 13 }}>📁</Text>
          <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '600', color: '#0b1c30' }}>Records</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 py-2.5 rounded-full items-center flex-row justify-center gap-1.5"
          style={{ backgroundColor: '#006685' }}
        >
          <Text style={{ fontSize: 13 }}>💬</Text>
          <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '600', color: '#fff' }}>Message</Text>
        </TouchableOpacity>
      </View>
    </GlassCard>
  )
}

export default function PatientsScreen() {
  const { practitioner } = useAuth()
  const { data: patients, isLoading } = usePatients(practitioner?.id ?? '')
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<FilterTab>('all')

  const filtered = useMemo(() => {
    let list = patients ?? []
    if (activeTab !== 'all') list = list.filter((p) => p.status === activeTab)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((p) => p.patientName.toLowerCase().includes(q) || p.shortId.toLowerCase().includes(q))
    }
    return list
  }, [patients, activeTab, search])

  return (
    <SafeAreaView className="flex-1 bg-[#f8f9ff]" edges={['top']}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View
        className="px-6 pt-4 pb-3 border-b border-white/20"
        style={{ backgroundColor: 'rgba(255,255,255,0.70)' }}
      >
        <View className="flex-row items-center justify-between mb-3">
          <Text style={{ fontFamily: 'Manrope', fontSize: 22, fontWeight: '700', color: '#0b1c30' }}>
            M-Santé
          </Text>
          <TouchableOpacity className="w-9 h-9 rounded-full bg-white/60 border border-slate-200/50 items-center justify-center">
            <Text style={{ fontSize: 16 }}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View className="flex-row items-center gap-2 px-4 py-2.5 rounded-full border border-slate-200/60" style={{ backgroundColor: 'rgba(255,255,255,0.70)' }}>
          <Text style={{ fontSize: 16 }}>🔍</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search patients, IDs..."
            placeholderTextColor="#6f787e"
            style={{ flex: 1, fontFamily: 'Manrope', fontSize: 14, color: '#0b1c30' }}
          />
        </View>

        {/* Filter tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3" contentContainerStyle={{ gap: 8 }}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              className="px-4 py-2 rounded-full"
              style={{
                backgroundColor: activeTab === tab.key ? '#006685' : 'rgba(255,255,255,0.60)',
                borderWidth: 1,
                borderColor: activeTab === tab.key ? '#006685' : 'rgba(203,200,206,0.5)',
              }}
            >
              <Text style={{
                fontFamily: 'Manrope', fontSize: 13, fontWeight: '600',
                color: activeTab === tab.key ? '#fff' : '#3f484d',
              }}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, gap: 16 }} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          [1, 2, 3].map((i) => <View key={i} className="h-44 rounded-xl bg-white/40 animate-pulse" />)
        ) : filtered.length === 0 ? (
          <View className="py-16 items-center">
            <Text style={{ fontFamily: 'Manrope', fontSize: 16, fontWeight: '600', color: '#6f787e' }}>
              Aucun patient trouvé
            </Text>
          </View>
        ) : (
          filtered.map((patient) => <PatientCard key={patient.patientId} patient={patient} />)
        )}
        <View style={{ height: 16 }} />
      </ScrollView>
    </SafeAreaView>
  )
}
```

**Step 2: Commit**

```bash
git add apps/mobile/app/(practitioner)/patients.tsx
git commit -m "feat(practitioner): implement Patients screen with search and filter tabs"
```

---

### Task 6: Profile stub `profile.tsx`

**Files:**
- Modify: `apps/mobile/app/(practitioner)/profile.tsx`

**Step 1: Implémenter le stub Profile**

```typescript
// apps/mobile/app/(practitioner)/profile.tsx
import { View, Text, TouchableOpacity, StatusBar, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useAuthStore } from '@/features/auth/store/authStore'
import { GlassCard } from '@/components/ui/GlassCard'

export default function ProfileScreen() {
  const { profile, practitioner } = useAuth()
  const signOut = useAuthStore((s) => s.signOut)

  const initials = (profile?.full_name ?? 'P').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()

  const handleSignOut = () => {
    Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnecter', style: 'destructive', onPress: () => signOut() },
    ])
  }

  return (
    <SafeAreaView className="flex-1 bg-[#f8f9ff]" edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <View className="flex-1 px-6 pt-8" style={{ gap: 24 }}>
        <Text style={{ fontFamily: 'Manrope', fontSize: 22, fontWeight: '700', color: '#0b1c30' }}>
          Profil
        </Text>

        {/* Avatar + identité */}
        <View className="items-center" style={{ gap: 12 }}>
          <View
            className="w-24 h-24 rounded-full items-center justify-center"
            style={{ backgroundColor: '#006685' }}
          >
            <Text style={{ fontFamily: 'Manrope', fontWeight: '700', fontSize: 32, color: '#fff' }}>
              {initials}
            </Text>
          </View>
          <View className="items-center">
            <Text style={{ fontFamily: 'Manrope', fontSize: 20, fontWeight: '700', color: '#0b1c30' }}>
              Dr. {profile?.full_name ?? '—'}
            </Text>
            <Text style={{ fontFamily: 'Manrope', fontSize: 14, color: '#6f787e', marginTop: 2 }}>
              {practitioner?.speciality ?? '—'}
            </Text>
          </View>

          {/* Badge vérification */}
          <View
            className="px-4 py-1.5 rounded-full"
            style={{
              backgroundColor: practitioner?.verification_status === 'approved' ? '#d1fae5' : '#fef3c7',
            }}
          >
            <Text style={{
              fontFamily: 'Manrope', fontSize: 12, fontWeight: '700',
              color: practitioner?.verification_status === 'approved' ? '#1d7a3a' : '#92400e',
            }}>
              {practitioner?.verification_status === 'approved' ? '✓ Compte vérifié' : '⏳ Vérification en cours'}
            </Text>
          </View>
        </View>

        {/* Stats */}
        <GlassCard>
          <View className="flex-row justify-around">
            {[
              { label: 'Note', value: practitioner?.rating ? `${Number(practitioner.rating).toFixed(1)}/5` : '—' },
              { label: 'Avis', value: String(practitioner?.total_reviews ?? 0) },
              { label: 'Tarif', value: practitioner?.session_price ? `${practitioner.session_price} XOF` : '—' },
            ].map(({ label, value }) => (
              <View key={label} className="items-center">
                <Text style={{ fontFamily: 'Manrope', fontSize: 18, fontWeight: '700', color: '#0b1c30' }}>{value}</Text>
                <Text style={{ fontFamily: 'Manrope', fontSize: 11, color: '#6f787e', marginTop: 2 }}>{label}</Text>
              </View>
            ))}
          </View>
        </GlassCard>

        {/* Déconnexion */}
        <View style={{ marginTop: 'auto' }}>
          <TouchableOpacity
            onPress={handleSignOut}
            className="py-4 rounded-full items-center"
            style={{ backgroundColor: '#ffdad6' }}
          >
            <Text style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: '700', color: '#ba1a1a' }}>
              Se déconnecter
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  )
}
```

**Step 2: Commit**

```bash
git add apps/mobile/app/(practitioner)/profile.tsx
git commit -m "feat(practitioner): implement Profile stub screen"
```

---

### Task 7: Typecheck mobile

**Step 1: Vérifier les types**

```bash
cd "c:/Users/Khodiaou/Desktop/m-santé app"
npx tsc --project apps/mobile/tsconfig.json --noEmit 2>&1 | grep "error TS" | grep -v node_modules | head -20
```

Expected: aucune erreur.

**Step 2: Corriger les erreurs éventuelles et commit**

```bash
git add apps/mobile/
git commit -m "fix(practitioner): typecheck fixes"
```
