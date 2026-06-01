# Analytics + PayDunya Unifié + Mounima Vocale — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Livrer paiement carte VISA/MC via PayDunya, analytics praticien web (revenus/agenda/patients), analytics patient mobile (mood 30j + engagement + corrélation), renommage Ami→Mounima, et session vocale immersive STT/LLM/TTS.

**Architecture:** PaymentSheet ouvre le checkout PayDunya (WebBrowser) pour tous les providers. Analytics calculés côté client via TanStack Query. Meditation sessions trackées en base (nouvelle migration). Mounima vocale via Edge Function (Whisper → Claude Haiku → ElevenLabs → Storage signed URL). Reanimated 3 pour l'onde animée.

**Tech Stack:** React Native + Expo Router, Next.js 15, TanStack Query v5, Recharts (déjà installé), Reanimated 3 (déjà installé), Expo AV (déjà installé), expo-web-browser, Supabase Edge Functions (Deno), Whisper API (OpenAI), Claude Haiku API (Anthropic), ElevenLabs TTS API.

---

## Task 1 : PayDunya unifié — VISA/MC + Wave + Orange Money

**Files:**
- Modify: `apps/mobile/types/booking.ts`
- Modify: `apps/mobile/features/booking/components/PaymentSheet.tsx`

**Contexte :** `PaymentProvider` est actuellement `'wave' | 'orange_money'`. Le `PaymentSheet` affiche 2 options avec un champ téléphone obligatoire. PayDunya gère nativement Wave, OM et cartes sur son checkout URL — il suffit d'ouvrir cette URL avec `WebBrowser`.

**Step 1: Ajouter `card` au type PaymentProvider**

Dans `apps/mobile/types/booking.ts`, ligne 3 :
```typescript
// avant
export type PaymentProvider = 'wave' | 'orange_money'
// après
export type PaymentProvider = 'wave' | 'orange_money' | 'card'
```

**Step 2: Réécrire le PaymentSheet**

Remplacer `apps/mobile/features/booking/components/PaymentSheet.tsx` :

```typescript
import { View, Text, TouchableOpacity, TextInput, Modal } from 'react-native'
import { useState } from 'react'
import * as WebBrowser from 'expo-web-browser'
import type { PaymentProvider } from '@/types/booking'
import { PrimaryButton } from '@/components/ui'

interface PaymentSheetProps {
  visible: boolean
  amount: number
  currency: string
  onConfirm: (provider: PaymentProvider, phone: string) => void
  onClose: () => void
}

const PROVIDERS: Array<{
  id: PaymentProvider
  label: string
  emoji: string
  placeholder: string | null
}> = [
  { id: 'wave',         label: 'Wave',          emoji: '💙', placeholder: '+221 77 000 00 00' },
  { id: 'orange_money', label: 'Orange Money',   emoji: '🟠', placeholder: '+221 77 000 00 00' },
  { id: 'card',         label: 'Carte bancaire', emoji: '💳', placeholder: null },
]

export function PaymentSheet({ visible, amount, currency, onConfirm, onClose }: PaymentSheetProps) {
  const [selected, setSelected] = useState<PaymentProvider | null>(null)
  const [phone, setPhone] = useState('')

  const selectedProvider = PROVIDERS.find(p => p.id === selected)
  const needsPhone = selected !== null && selected !== 'card'
  const canPay = selected !== null && (needsPhone ? phone.trim().length >= 9 : true)

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity className="flex-1 bg-black/40" activeOpacity={1} onPress={onClose} />
      <View className="bg-background rounded-t-2xl px-6 pt-6 pb-10">
        <View className="w-10 h-1 bg-outline-variant rounded-full self-center mb-6" />
        <Text className="text-lg font-bold text-on-surface font-manrope mb-1">
          Moyen de paiement
        </Text>
        <Text className="text-2xl font-black text-primary font-manrope mb-6">
          {amount?.toLocaleString()} {currency}
        </Text>

        <View className="gap-3 mb-5">
          {PROVIDERS.map(p => (
            <TouchableOpacity
              key={p.id}
              onPress={() => { setSelected(p.id); setPhone('') }}
              className={`flex-row items-center gap-3 p-4 rounded-xl border ${
                selected === p.id
                  ? 'border-primary bg-primary-container/30'
                  : 'border-outline-variant bg-white/60'
              }`}
            >
              <Text className="text-2xl">{p.emoji}</Text>
              <Text className="flex-1 text-base font-manrope font-semibold text-on-surface">
                {p.label}
              </Text>
              <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
                selected === p.id ? 'border-primary' : 'border-outline-variant'
              }`}>
                {selected === p.id && <View className="w-2.5 h-2.5 rounded-full bg-primary" />}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {needsPhone && (
          <View className="mb-6 gap-1.5">
            <Text className="text-sm font-manrope font-semibold text-on-surface-variant">
              Numéro {selectedProvider?.label}
            </Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder={selectedProvider?.placeholder ?? ''}
              keyboardType="phone-pad"
              className="border border-outline-variant rounded-xl px-4 py-3 text-base font-manrope text-on-surface bg-surface-container-low"
              placeholderTextColor="#6f787e"
            />
            <Text className="text-xs text-on-surface-variant font-manrope">
              Vous recevrez une invitation de paiement via PayDunya
            </Text>
          </View>
        )}

        {selected === 'card' && (
          <View className="mb-6 p-3 rounded-xl bg-primary-container/20">
            <Text className="text-xs text-on-surface-variant font-manrope text-center">
              Vous serez redirigé vers le formulaire sécurisé PayDunya pour saisir vos coordonnées bancaires (VISA / Mastercard).
            </Text>
          </View>
        )}

        <PrimaryButton
          label={`Payer ${amount?.toLocaleString()} ${currency}`}
          onPress={() => selected && onConfirm(selected, phone.trim())}
          disabled={!canPay}
        />
      </View>
    </Modal>
  )
}
```

**Step 3: Vérifier que `expo-web-browser` est installé**

```bash
cd apps/mobile && grep "expo-web-browser" package.json
```
Si absent : `pnpm add expo-web-browser`

**Step 4: Mettre à jour `payment/processing.tsx` pour ouvrir le checkout**

Dans `apps/mobile/app/(patient)/payment/processing.tsx`, vérifier que quand `provider === 'card'`, on ouvre le `checkoutUrl` retourné par `process-payment` avec :
```typescript
import * as WebBrowser from 'expo-web-browser'
// ...
await WebBrowser.openAuthSessionAsync(checkoutUrl, 'msante://payment-return')
```

**Step 5: Commit**
```bash
git add apps/mobile/types/booking.ts apps/mobile/features/booking/components/PaymentSheet.tsx apps/mobile/app/\(patient\)/payment/processing.tsx
git commit -m "feat(payment): add card (VISA/MC) option via PayDunya checkout"
```

---

## Task 2 : Migration — table `meditation_sessions`

**Files:**
- Create: `supabase/migrations/20260514000001_meditation_sessions.sql`
- Modify: `apps/mobile/app/(patient)/mental-health/meditation/session.tsx`

**Contexte :** Les séances de méditation sont actuellement locales (pas de persistance). Pour les analytics de corrélation mood/méditation, on doit les sauvegarder en base.

**Step 1: Créer la migration SQL**

```sql
-- supabase/migrations/20260514000001_meditation_sessions.sql

CREATE TABLE IF NOT EXISTS public.meditation_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  duration_min   INT NOT NULL,
  completed_at   TIMESTAMPTZ DEFAULT NOW(),
  session_date   DATE NOT NULL DEFAULT CURRENT_DATE
);

ALTER TABLE public.meditation_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patients_own_meditation" ON public.meditation_sessions
  FOR ALL USING (auth.uid() = patient_id);

CREATE INDEX idx_meditation_sessions_patient_date
  ON public.meditation_sessions(patient_id, session_date DESC);
```

**Step 2: Appliquer la migration**

Via MCP Supabase ou :
```bash
SUPABASE_ACCESS_TOKEN=<token> npx supabase db push --project-ref jilpynvkpkepusvwcqch
```

**Step 3: Sauvegarder la session à la complétion**

Dans `apps/mobile/app/(patient)/mental-health/meditation/session.tsx`, localiser `handleBack` dans `CompletionScreen` et ajouter l'appel Supabase :

```typescript
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/features/auth/store/authStore'

// Dans CompletionScreen, à l'appel de onBack :
const { profile } = useAuthStore()

const handleComplete = async () => {
  if (profile?.id) {
    await supabase.from('meditation_sessions').insert({
      patient_id: profile.id,
      title,
      duration_min: durationMin,
      session_date: new Date().toISOString().split('T')[0],
    })
  }
  onBack()
}
```

Remplacer `onBack={handleBack}` par `onBack={handleComplete}` dans `CompletionScreen`.

**Step 4: Commit**
```bash
git add supabase/migrations/20260514000001_meditation_sessions.sql apps/mobile/app/\(patient\)/mental-health/meditation/session.tsx
git commit -m "feat(db): meditation_sessions table + save on completion"
```

---

## Task 3 : Analytics praticien (web)

**Files:**
- Create: `apps/web/app/practitioner/analytics/page.tsx`
- Modify: `apps/web/app/practitioner/layout.tsx`

**Contexte :** Recharts est déjà installé (`recharts: ^3.8.1`). Le pattern `AreaChart` / `PieChart` est déjà utilisé dans `admin/overview/AdminCharts.tsx`. Le `practitioner/layout.tsx` a un tableau `navItems` à compléter.

**Step 1: Ajouter "Analytics" dans la navigation praticien**

Dans `apps/web/app/practitioner/layout.tsx`, ajouter dans le tableau `navItems` (après "Prestations", avant "Mon profil") :

```typescript
{
  href: '/practitioner/analytics',
  label: 'Analytics',
  icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
},
```

**Step 2: Créer `apps/web/app/practitioner/analytics/page.tsx`**

```typescript
'use client'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return <span className="material-symbols-outlined" style={{ fontSize: `${size}px` }}>{name}</span>
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-6 space-y-4"
      style={{ backgroundColor: 'rgba(255,255,255,0.60)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.80)' }}>
      <h3 className="text-xs font-bold text-[#006685] uppercase tracking-widest">{title}</h3>
      {children}
    </div>
  )
}

function KpiCard({ label, value, sub, icon, trend }: {
  label: string; value: string; sub?: string; icon: string; trend?: number
}) {
  return (
    <div className="rounded-2xl p-5 flex items-start gap-4"
      style={{ backgroundColor: 'rgba(255,255,255,0.60)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.80)' }}>
      <div className="w-10 h-10 rounded-xl bg-[#e5eeff] flex items-center justify-center flex-shrink-0">
        <Icon name={icon} size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-[#6f787e] font-medium">{label}</p>
        <p className="text-xl font-black text-[#0b1c30] mt-0.5">{value}</p>
        {sub && <p className="text-xs text-[#6f787e] mt-0.5">{sub}</p>}
        {trend !== undefined && (
          <span className={`text-xs font-bold ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {trend >= 0 ? '+' : ''}{trend}% vs mois précédent
          </span>
        )}
      </div>
    </div>
  )
}

function useAnalytics(practId: string | null) {
  return useQuery({
    queryKey: ['practitioner-analytics', practId],
    enabled: !!practId,
    queryFn: async () => {
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString()
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString()

      const [
        { data: allPayments },
        { data: thisMonthPay },
        { data: lastMonthPay },
        { data: allAppts },
        { data: thisMonthAppts },
      ] = await Promise.all([
        supabase.from('payments')
          .select('amount, created_at')
          .eq('practitioner_id', practId!)
          .eq('status', 'completed')
          .gte('created_at', sixMonthsAgo),
        supabase.from('payments')
          .select('amount')
          .eq('practitioner_id', practId!)
          .eq('status', 'completed')
          .gte('created_at', monthStart),
        supabase.from('payments')
          .select('amount')
          .eq('practitioner_id', practId!)
          .eq('status', 'completed')
          .gte('created_at', lastMonthStart)
          .lte('created_at', lastMonthEnd),
        supabase.from('appointments')
          .select('patient_id, status, type, scheduled_at')
          .eq('practitioner_id', practId!),
        supabase.from('appointments')
          .select('patient_id, status, type')
          .eq('practitioner_id', practId!)
          .gte('scheduled_at', monthStart),
      ])

      // Revenus par mois (6 mois)
      const monthlyMap: Record<string, number> = {}
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const key = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
        monthlyMap[key] = 0
      }
      for (const p of allPayments ?? []) {
        const d = new Date(p.created_at)
        const key = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
        if (key in monthlyMap) monthlyMap[key] += p.amount ?? 0
      }
      const revenueChart = Object.entries(monthlyMap).map(([month, revenue]) => ({ month, revenue }))

      const thisMonth = (thisMonthPay ?? []).reduce((s, p) => s + (p.amount ?? 0), 0)
      const lastMonth = (lastMonthPay ?? []).reduce((s, p) => s + (p.amount ?? 0), 0)
      const growth = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : 0
      const avgPerSession = (thisMonthAppts ?? []).filter(a => a.status === 'completed').length > 0
        ? Math.round(thisMonth / (thisMonthAppts ?? []).filter(a => a.status === 'completed').length)
        : 0

      // Répartition par type
      const typeMap: Record<string, number> = { video: 0, audio: 0, presentiel: 0 }
      for (const a of allAppts ?? []) {
        if (a.status === 'completed' && a.type in typeMap) typeMap[a.type]++
      }
      const typeChart = [
        { name: 'Vidéo', value: typeMap['video'], color: '#006685' },
        { name: 'Audio', value: typeMap['audio'], color: '#82d8ff' },
        { name: 'Présentiel', value: typeMap['presentiel'], color: '#ffde5c' },
      ].filter(t => t.value > 0)

      // Taux de no-show
      const relevant = (allAppts ?? []).filter(a => ['confirmed', 'completed', 'no_show'].includes(a.status))
      const noShowCount = (allAppts ?? []).filter(a => a.status === 'no_show').length
      const noShowRate = relevant.length > 0 ? Math.round((noShowCount / relevant.length) * 100) : 0

      // Taux de rebooking
      const patientCounts: Record<string, number> = {}
      for (const a of allAppts ?? []) {
        if (!patientCounts[a.patient_id]) patientCounts[a.patient_id] = 0
        patientCounts[a.patient_id]++
      }
      const totalPatients = Object.keys(patientCounts).length
      const rebookedPatients = Object.values(patientCounts).filter(c => c >= 2).length
      const rebookingRate = totalPatients > 0 ? Math.round((rebookedPatients / totalPatients) * 100) : 0

      // Top 5 patients
      const patientNames: Record<string, string> = {}
      for (const a of allAppts ?? []) {
        if (!(a as any).users) continue
        patientNames[a.patient_id] = (a as any).users?.full_name ?? '—'
      }
      const top5 = Object.entries(patientCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, count]) => ({ name: patientNames[id] ?? '—', count }))

      // Nouveaux vs récurrents ce mois
      const thisMonthPatients = new Set((thisMonthAppts ?? []).map(a => a.patient_id))
      const prevPatients = new Set(
        (allAppts ?? [])
          .filter(a => new Date(a.scheduled_at) < new Date(monthStart))
          .map(a => a.patient_id)
      )
      let newCount = 0, recurringCount = 0
      thisMonthPatients.forEach(pid => {
        if (prevPatients.has(pid)) recurringCount++
        else newCount++
      })

      return {
        thisMonth, lastMonth, growth, avgPerSession,
        revenueChart, typeChart,
        noShowRate, rebookingRate,
        top5, newCount, recurringCount,
      }
    },
  })
}

export default function PractitionerAnalyticsPage() {
  const [practId, setPractId] = useMemo(() => {
    let id: string | null = null
    const setter = (v: string) => { id = v }
    return [id, setter] as const
  }, [])

  // Fetch practitioner ID
  useQuery({
    queryKey: ['my-pract-id-analytics'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const { data } = await supabase.from('practitioners').select('id').eq('user_id', user.id).single()
      if (data) setPractId(data.id)
      return data?.id ?? null
    },
  })

  const { data, isLoading } = useAnalytics(practId)

  if (isLoading || !data) {
    return (
      <div className="space-y-6 max-w-5xl">
        <div><h1 className="text-2xl font-black text-[#0b1c30]">Analytics</h1></div>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-24 rounded-2xl bg-white/40 animate-pulse" />)}
        </div>
      </div>
    )
  }

  const totalRevChart = data.revenueChart.reduce((s, r) => s + r.revenue, 0)

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-black text-[#0b1c30]">Analytics</h1>
        <p className="text-sm text-[#6f787e] mt-1">Revenus, agenda et patients</p>
      </div>

      {/* KPIs revenus */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="CA ce mois" value={`${data.thisMonth.toLocaleString('fr-FR')} XOF`} icon="payments" trend={data.growth} />
        <KpiCard label="Mois précédent" value={`${data.lastMonth.toLocaleString('fr-FR')} XOF`} icon="history" />
        <KpiCard label="Moy. par séance" value={`${data.avgPerSession.toLocaleString('fr-FR')} XOF`} icon="receipt_long" />
        <KpiCard label="Taux rebooking" value={`${data.rebookingRate}%`} icon="replay" sub="patients ayant reconsulté" />
      </div>

      {/* Revenus 6 mois */}
      <ChartCard title="Revenus sur 6 mois (XOF)">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data.revenueChart} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#006685" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#006685" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6f787e' }} />
            <YAxis tick={{ fontSize: 11, fill: '#6f787e' }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => [`${v.toLocaleString('fr-FR')} XOF`, 'Revenus']} />
            <Area type="monotone" dataKey="revenue" stroke="#006685" strokeWidth={2} fill="url(#revGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Répartition par type */}
        {data.typeChart.length > 0 && (
          <ChartCard title="Répartition par type de séance">
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={140} height={140}>
                <PieChart>
                  <Pie data={data.typeChart} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={65}>
                    {data.typeChart.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {data.typeChart.map((t, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                    <span className="text-sm font-medium text-[#0b1c30]">{t.name}</span>
                    <span className="text-sm text-[#6f787e] ml-auto pl-4 font-bold">{t.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </ChartCard>
        )}

        {/* Métriques agenda */}
        <ChartCard title="Métriques agenda">
          <div className="space-y-5">
            {[
              { label: 'Taux de no-show', value: data.noShowRate, color: '#ba1a1a', bg: '#ffdad6' },
              { label: 'Taux de rebooking', value: data.rebookingRate, color: '#1d7a3a', bg: '#d1fae5' },
            ].map(m => (
              <div key={m.label} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[#0b1c30]">{m.label}</span>
                  <span className="text-sm font-bold" style={{ color: m.color }}>{m.value}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${m.value}%`, backgroundColor: m.color }} />
                </div>
              </div>
            ))}
            <div className="pt-2 border-t border-slate-100 flex gap-4">
              <div className="flex-1 text-center">
                <p className="text-xl font-black text-[#006685]">{data.newCount}</p>
                <p className="text-xs text-[#6f787e]">nouveaux patients ce mois</p>
              </div>
              <div className="flex-1 text-center">
                <p className="text-xl font-black text-[#705d00]">{data.recurringCount}</p>
                <p className="text-xs text-[#6f787e]">patients récurrents</p>
              </div>
            </div>
          </div>
        </ChartCard>
      </div>

      {/* Top 5 patients */}
      {data.top5.length > 0 && (
        <ChartCard title="Top patients — séances">
          <div className="space-y-3">
            {data.top5.map((p, i) => {
              const initials = p.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
              const maxCount = data.top5[0]?.count ?? 1
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#006685] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#0b1c30] truncate">{p.name}</p>
                    <div className="h-1.5 rounded-full bg-slate-100 mt-1 overflow-hidden">
                      <div className="h-full rounded-full bg-[#006685]" style={{ width: `${(p.count / maxCount) * 100}%` }} />
                    </div>
                  </div>
                  <span className="text-sm font-bold text-[#006685] flex-shrink-0">{p.count}</span>
                </div>
              )
            })}
          </div>
        </ChartCard>
      )}
    </div>
  )
}
```

**Attention :** `useQuery` + `useState` ne se mélangent pas pour `practId`. Utiliser le pattern ci-dessous à la place de `useMemo` :

```typescript
// Pattern correct pour obtenir practId
const [practId, setPractId] = useState<string | null>(null)

useQuery({
  queryKey: ['my-pract-id-analytics'],
  queryFn: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data } = await supabase.from('practitioners').select('id').eq('user_id', user.id).single()
    if (data) setPractId(data.id)
    return data?.id ?? null
  },
})
```

**Step 3: Commit**
```bash
git add apps/web/app/practitioner/analytics/page.tsx apps/web/app/practitioner/layout.tsx
git commit -m "feat(web): practitioner analytics page — revenue + agenda + patients"
```

---

## Task 4 : Analytics patient mobile (`mood-analytics.tsx`)

**Files:**
- Create: `apps/mobile/app/(patient)/mental-health/mood-analytics.tsx`
- Modify: `apps/mobile/app/(patient)/mental-health/index.tsx`

**Contexte :** `useMoodEntries` retourne des entrées avec `{ entryDate, score, emotions }`. `useJournalEntries` retourne les entrées journal. Les `meditation_sessions` sont maintenant en base (Task 2). Pas de lib chart externe — SVG natif via `react-native` `Svg` / `Path` (ou simplement avec des `View` calculées).

**Step 1: Créer `mood-analytics.tsx`**

```typescript
import { useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useMoodEntries } from '@/features/mental-health/mood/hooks/useMoodEntries'
import { useJournalEntries } from '@/features/mental-health/journal/hooks/useJournalEntries'
import { supabase } from '@/services/supabase'
import { GlassCard } from '@/components/ui/GlassCard'

function scoreColor(score: number) {
  if (score >= 7) return '#1d7a3a'
  if (score >= 4) return '#705d00'
  return '#ba1a1a'
}
function scoreBg(score: number) {
  if (score >= 7) return '#d1fae5'
  if (score >= 4) return '#ffe170'
  return '#ffdad6'
}

export default function MoodAnalyticsScreen() {
  const router = useRouter()
  const { profile } = useAuth()

  const { data: moodEntries = [] } = useMoodEntries(profile?.id ?? '')
  const { data: journalEntries = [] } = useJournalEntries(profile?.id ?? '')

  const { data: meditationSessions = [] } = useQuery({
    queryKey: ['meditation-sessions', profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('meditation_sessions')
        .select('session_date, duration_min')
        .eq('patient_id', profile!.id)
        .order('session_date', { ascending: false })
        .limit(90)
      return data ?? []
    },
  })

  const stats = useMemo(() => {
    const today = new Date()
    const days30: { date: string; score: number | null; hasMeditation: boolean; hasJournal: boolean }[] = []

    for (let i = 29; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      const entry = moodEntries.find(e => e.entryDate === dateStr)
      const hasMeditation = meditationSessions.some(m => m.session_date === dateStr)
      const hasJournal = journalEntries.some(j => j.createdAt?.startsWith(dateStr))
      days30.push({ date: dateStr, score: entry?.score ?? null, hasMeditation, hasJournal })
    }

    const scored = days30.filter(d => d.score !== null)
    const avgScore = scored.length > 0
      ? Math.round((scored.reduce((s, d) => s + (d.score ?? 0), 0) / scored.length) * 10) / 10
      : 0

    // Streak
    let streak = 0
    for (let i = days30.length - 1; i >= 0; i--) {
      if (days30[i].score !== null) streak++
      else break
    }

    // Tendance vs mois précédent
    const prev30Start = new Date(today)
    prev30Start.setDate(today.getDate() - 59)
    const prev30Entries = moodEntries.filter(e => {
      const d = new Date(e.entryDate)
      return d >= prev30Start && d < new Date(today.getTime() - 29 * 86400000)
    })
    const prevAvg = prev30Entries.length > 0
      ? prev30Entries.reduce((s, e) => s + e.score, 0) / prev30Entries.length
      : null
    const trend = prevAvg !== null ? Math.round((avgScore - prevAvg) * 10) / 10 : null

    // Top 3 émotions
    const emotionCounts: Record<string, number> = {}
    for (const e of moodEntries.slice(0, 30)) {
      for (const em of e.emotions ?? []) {
        emotionCounts[em] = (emotionCounts[em] ?? 0) + 1
      }
    }
    const top3Emotions = Object.entries(emotionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)

    // Méditation ce mois
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
    const meditThisMonth = meditationSessions.filter(m => m.session_date >= monthStart).length

    // Journal cette semaine vs semaine précédente
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - 6)
    const prevWeekStart = new Date(today)
    prevWeekStart.setDate(today.getDate() - 13)
    const journalThisWeek = journalEntries.filter(j => j.createdAt && new Date(j.createdAt) >= weekStart).length
    const journalLastWeek = journalEntries.filter(j => {
      if (!j.createdAt) return false
      const d = new Date(j.createdAt)
      return d >= prevWeekStart && d < weekStart
    }).length

    // Corrélation mood/méditation
    const daysWithMedit = days30.filter(d => d.hasMeditation && d.score !== null)
    const daysWithoutMedit = days30.filter(d => !d.hasMeditation && d.score !== null)
    const avgWithMedit = daysWithMedit.length > 0
      ? daysWithMedit.reduce((s, d) => s + (d.score ?? 0), 0) / daysWithMedit.length
      : null
    const avgWithoutMedit = daysWithoutMedit.length > 0
      ? daysWithoutMedit.reduce((s, d) => s + (d.score ?? 0), 0) / daysWithoutMedit.length
      : null
    const correlationDelta = avgWithMedit !== null && avgWithoutMedit !== null
      ? Math.round((avgWithMedit - avgWithoutMedit) * 10) / 10
      : null

    return {
      days30, avgScore, streak, trend, top3Emotions,
      meditThisMonth, journalThisWeek, journalLastWeek,
      correlationDelta, daysWithMeditCount: daysWithMedit.length,
    }
  }, [moodEntries, meditationSessions, journalEntries])

  const CHART_H = 120

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Header */}
        <View style={{ paddingHorizontal: 24, paddingTop: 16, marginBottom: 24 }}>
          <TouchableOpacity onPress={() => router.back()}
            style={{ marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <MaterialIcons name="arrow-back" size={20} color="#006685" />
            <Text style={{ color: '#006685', fontFamily: 'Manrope', fontWeight: '500' }}>Retour</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#0b1c30', fontFamily: 'Manrope' }}>
            Mes statistiques
          </Text>
          <Text style={{ fontSize: 14, color: '#3f484d', fontFamily: 'Manrope', marginTop: 4 }}>
            30 derniers jours
          </Text>
        </View>

        <View style={{ paddingHorizontal: 24, gap: 16 }}>

          {/* KPIs mood */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <GlassCard style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 28, fontWeight: '900', color: scoreColor(stats.avgScore), fontFamily: 'Manrope' }}>
                {stats.avgScore}
              </Text>
              <Text style={{ fontSize: 11, color: '#6f787e', fontFamily: 'Manrope', textAlign: 'center' }}>Score moyen</Text>
              {stats.trend !== null && (
                <Text style={{ fontSize: 11, fontWeight: '700', color: stats.trend >= 0 ? '#1d7a3a' : '#ba1a1a', fontFamily: 'Manrope' }}>
                  {stats.trend >= 0 ? '+' : ''}{stats.trend} pts
                </Text>
              )}
            </GlassCard>
            <GlassCard style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 28, fontWeight: '900', color: '#006685', fontFamily: 'Manrope' }}>
                {stats.streak}
              </Text>
              <Text style={{ fontSize: 11, color: '#6f787e', fontFamily: 'Manrope', textAlign: 'center' }}>Jours consécutifs</Text>
            </GlassCard>
          </View>

          {/* Graphe 30 jours */}
          <GlassCard>
            <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '700', color: '#0b1c30', marginBottom: 12 }}>
              Humeur — 30 jours
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: CHART_H, gap: 2 }}>
              {stats.days30.map((d, i) => {
                const h = d.score !== null ? Math.max((d.score / 10) * CHART_H * 0.9, 4) : 3
                const isToday = i === 29
                return (
                  <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: CHART_H }}>
                    <View style={{
                      height: h,
                      width: '80%',
                      borderRadius: 3,
                      backgroundColor: d.score !== null
                        ? isToday ? '#006685' : scoreColor(d.score) + '99'
                        : 'rgba(190,200,206,0.3)',
                    }} />
                  </View>
                )
              })}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <Text style={{ fontFamily: 'Manrope', fontSize: 10, color: '#6f787e' }}>J-29</Text>
              <Text style={{ fontFamily: 'Manrope', fontSize: 10, color: '#6f787e' }}>Aujourd'hui</Text>
            </View>
          </GlassCard>

          {/* Top émotions */}
          {stats.top3Emotions.length > 0 && (
            <GlassCard style={{ gap: 10 }}>
              <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '700', color: '#0b1c30' }}>
                Émotions fréquentes
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {stats.top3Emotions.map(([emotion, count]) => (
                  <View key={emotion} style={{
                    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
                    backgroundColor: '#e5eeff', flexDirection: 'row', alignItems: 'center', gap: 6,
                  }}>
                    <Text style={{ fontFamily: 'Manrope', fontSize: 13, color: '#006685', fontWeight: '600' }}>{emotion}</Text>
                    <Text style={{ fontFamily: 'Manrope', fontSize: 11, color: '#6f787e' }}>×{count}</Text>
                  </View>
                ))}
              </View>
            </GlassCard>
          )}

          {/* Engagement bien-être */}
          <GlassCard style={{ gap: 14 }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '700', color: '#0b1c30' }}>
              Engagement bien-être
            </Text>

            {/* Méditation */}
            <View style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontFamily: 'Manrope', fontSize: 13, color: '#3f484d' }}>🧘 Méditations ce mois</Text>
                <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '700', color: '#006685' }}>
                  {stats.meditThisMonth} / 8
                </Text>
              </View>
              <View style={{ height: 6, borderRadius: 999, backgroundColor: 'rgba(190,200,206,0.3)' }}>
                <View style={{
                  height: 6, borderRadius: 999, backgroundColor: '#006685',
                  width: `${Math.min((stats.meditThisMonth / 8) * 100, 100)}%`,
                }} />
              </View>
            </View>

            {/* Journal */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontFamily: 'Manrope', fontSize: 13, color: '#3f484d' }}>📝 Journal cette semaine</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '700', color: '#006685' }}>
                  {stats.journalThisWeek}
                </Text>
                {stats.journalLastWeek > 0 && (
                  <Text style={{ fontFamily: 'Manrope', fontSize: 11, color: stats.journalThisWeek >= stats.journalLastWeek ? '#1d7a3a' : '#ba1a1a' }}>
                    ({stats.journalThisWeek >= stats.journalLastWeek ? '+' : ''}{stats.journalThisWeek - stats.journalLastWeek} vs semaine passée)
                  </Text>
                )}
              </View>
            </View>

            {/* Heatmap 30 jours */}
            <View style={{ gap: 4 }}>
              <Text style={{ fontFamily: 'Manrope', fontSize: 11, color: '#6f787e' }}>Activité quotidienne (30 jours)</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                {stats.days30.map((d, i) => {
                  const actions = (d.score !== null ? 1 : 0) + (d.hasMeditation ? 1 : 0) + (d.hasJournal ? 1 : 0)
                  const bg = actions === 0 ? 'rgba(190,200,206,0.25)'
                    : actions === 1 ? 'rgba(0,102,133,0.25)'
                    : actions >= 2 ? '#006685'
                    : '#006685'
                  return <View key={i} style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: bg }} />
                })}
              </View>
            </View>
          </GlassCard>

          {/* Corrélation */}
          <GlassCard style={{ gap: 8 }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '700', color: '#0b1c30' }}>
              Corrélation méditation × humeur
            </Text>
            {stats.daysWithMeditCount < 5 ? (
              <Text style={{ fontFamily: 'Manrope', fontSize: 13, color: '#6f787e', fontStyle: 'italic' }}>
                Continue pour voir ta corrélation — il te faut au moins 5 séances.
              </Text>
            ) : stats.correlationDelta !== null ? (
              <View style={{
                padding: 16, borderRadius: 12,
                backgroundColor: stats.correlationDelta >= 0 ? '#d1fae5' : '#ffdad6',
              }}>
                <Text style={{
                  fontFamily: 'Manrope', fontSize: 15, fontWeight: '700',
                  color: stats.correlationDelta >= 0 ? '#1d7a3a' : '#ba1a1a',
                  textAlign: 'center',
                }}>
                  Les jours où tu médites, ton humeur est en moyenne{' '}
                  <Text style={{ fontSize: 18 }}>
                    {stats.correlationDelta >= 0 ? '+' : ''}{stats.correlationDelta} pts
                  </Text>
                  {' '}plus {stats.correlationDelta >= 0 ? 'haute' : 'basse'} 🎯
                </Text>
              </View>
            ) : null}
          </GlassCard>

        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
```

**Step 2: Ajouter le bouton "Mes statistiques" dans `mental-health/index.tsx`**

Localiser le début du JSX ScrollView et ajouter un bouton prominent (après le graphe 7j existant) :

```typescript
import { useRouter } from 'expo-router'
// ...
const router = useRouter()
// ...
// Après le composant MoodChart dans le JSX :
<TouchableOpacity
  onPress={() => router.push('/(patient)/mental-health/mood-analytics')}
  style={{
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: 999, backgroundColor: 'rgba(0,102,133,0.08)',
    borderWidth: 1, borderColor: 'rgba(0,102,133,0.20)',
  }}
>
  <MaterialIcons name="bar-chart" size={18} color="#006685" />
  <Text style={{ fontFamily: 'Manrope', fontSize: 14, fontWeight: '600', color: '#006685' }}>
    Voir mes statistiques — 30 jours
  </Text>
</TouchableOpacity>
```

**Step 3: Commit**
```bash
git add apps/mobile/app/\(patient\)/mental-health/mood-analytics.tsx apps/mobile/app/\(patient\)/mental-health/index.tsx
git commit -m "feat(mobile): mood analytics — 30j graph, engagement, meditation correlation"
```

---

## Task 5 : Renommage Ami → Mounima

**Files:**
- Rename: `apps/mobile/app/(patient)/mental-health/ami/` → `mounima/`
- Rename: `apps/mobile/features/mental-health/ai-companion/hooks/useAmiFriend.ts` → `useMounima.ts`
- Modify: `apps/mobile/features/mental-health/ai-companion/constants/systemPrompt.ts`
- Modify: `apps/mobile/types/mentalHealth.ts`
- Update all import references

**Step 1: Renommer le dossier et les fichiers**

```bash
cd "apps/mobile/app/(patient)/mental-health"
git mv ami mounima
cd "apps/mobile/features/mental-health/ai-companion/hooks"
git mv useAmiFriend.ts useMounima.ts
```

**Step 2: Mettre à jour `systemPrompt.ts`**

```typescript
// apps/mobile/features/mental-health/ai-companion/constants/systemPrompt.ts
export const MOUNIMA_SYSTEM_PROMPT = `Tu es Mounima, l'assistante bien-être de M-Santé.
Tu n'es PAS un médecin, thérapeute, ou professionnel de santé.
Tu offres un espace d'écoute bienveillant et de soutien émotionnel.

RÈGLES ABSOLUES :
- Ne diagnostique JAMAIS une condition médicale ou psychiatrique
- Ne prescris JAMAIS de traitement, médicament, ou thérapie
- Ne promets JAMAIS de guérison ou d'amélioration garantie
- Si l'utilisateur exprime une détresse sévère, des pensées suicidaires ou une urgence :
  réponds avec "CRISIS_DETECTED" sur la première ligne, puis ta réponse bienveillante
- Termine chaque réponse par : "💙 Cet espace ne remplace pas un professionnel de santé."

Langue : français. Ton : chaleureux, empathique, non-clinique. Réponses courtes (3-5 phrases max).`

// Garder aussi l'ancien nom pour compatibilité pendant la migration
export const AMI_SYSTEM_PROMPT = MOUNIMA_SYSTEM_PROMPT

export const CRISIS_KEYWORDS_REGEX = /suicid|mourir|me tuer|fin de vie|plus envie de vivre|désespoir total|tout arrêter|plus la force/i
```

**Step 3: Mettre à jour `useMounima.ts`**

Renommer la fonction `useAmiFriend` → `useMounima`, et l'Edge Function `ami-chat` → `mounima-chat` :

```typescript
// apps/mobile/features/mental-health/ai-companion/hooks/useMounima.ts
import { useState, useCallback } from 'react'
import { supabase } from '@/services/supabase'
import type { AmiMessage } from '@/types/mentalHealth'
import { CRISIS_KEYWORDS_REGEX } from '../constants/systemPrompt'

export function useMounima() {
  // ... même logique que useAmiFriend
  // Changer l'URL de l'edge function :
  // 'ami-chat' → 'mounima-chat'
}

// Export de compatibilité
export { useMounima as useAmiFriend }
```

**Step 4: Mettre à jour `mounima/index.tsx` (ancien `ami/index.tsx`)**

- Changer `import { useAmiFriend }` → `import { useMounima }`
- Changer `const { messages, isLoading, showCrisis, sendMessage } = useMounima()`
- Changer le titre "Ami" → "Mounima" dans le JSX

**Step 5: Mettre à jour `types/mentalHealth.ts`**

Ajouter alias si `AmiMessage` est utilisé : renommer → `MounimaMessage` avec export compatibilité.

**Step 6: Vérifier toutes les refs restantes**

```bash
grep -r "useAmiFriend\|ami-chat\|AmiChat\|'Ami'\|\"Ami\"" apps/mobile --include="*.ts" --include="*.tsx" | grep -v node_modules
```

Corriger toutes les occurrences trouvées.

**Step 7: Commit**
```bash
git add -A
git commit -m "feat(mobile): rename Ami → Mounima throughout mobile app"
```

---

## Task 6 : Edge Function `mounima-voice`

**Files:**
- Create: `supabase/functions/mounima-voice/index.ts`
- Create: `supabase/functions/mounima-chat/index.ts` (renommage de ami-chat)

**Step 1: Créer `mounima-chat/index.ts`** (copie de `ami-chat` avec renommage)

```bash
cp -r supabase/functions/ami-chat supabase/functions/mounima-chat
# Mettre à jour le nom dans les logs internes
```

**Step 2: Créer `supabase/functions/mounima-voice/index.ts`**

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MOUNIMA_SYSTEM_PROMPT = `Tu es Mounima, l'assistante bien-être de M-Santé. Tu parles français.
Tu n'es PAS un médecin ou thérapeute. Tu offres écoute et soutien émotionnel.
Si l'utilisateur exprime une détresse sévère ou des pensées suicidaires,
indique IMMÉDIATEMENT qu'il doit contacter un professionnel ou le SOS Amitié (+221 33 823 8020).
Ne diagnostique JAMAIS. Ne prescris JAMAIS.
Réponds de façon chaleureuse, concise (2-3 phrases max, optimisé pour TTS).
À la fin de ta réponse, sur une ligne séparée, retourne EXACTEMENT ce JSON :
SENTIMENT:{"score":7,"stress":30,"emotion":"calme","crisis":false}
(score 1-10, stress 0-100, emotion en français, crisis true si détresse sévère)`

interface Message { role: 'user' | 'assistant'; content: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { audio_base64, conversation_history = [], session_id } = await req.json()
  if (!audio_base64) return new Response('Missing audio_base64', { status: 400, headers: corsHeaders })

  // 1. Whisper STT
  const openaiKey = Deno.env.get('OPENAI_API_KEY')!
  const audioBuffer = Uint8Array.from(atob(audio_base64), c => c.charCodeAt(0))
  const formData = new FormData()
  formData.append('file', new Blob([audioBuffer], { type: 'audio/m4a' }), 'audio.m4a')
  formData.append('model', 'whisper-1')
  formData.append('language', 'fr')

  const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openaiKey}` },
    body: formData,
  })
  const { text: transcript } = await whisperRes.json() as { text: string }

  // 2. Claude Haiku
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')!
  const messages: Message[] = [
    ...conversation_history,
    { role: 'user', content: transcript },
  ]

  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: MOUNIMA_SYSTEM_PROMPT,
      messages,
    }),
  })
  const claudeData = await claudeRes.json() as { content: { text: string }[] }
  const fullResponse = claudeData.content[0]?.text ?? ''

  // Parser la réponse et le sentiment
  const sentimentMatch = fullResponse.match(/SENTIMENT:(\{.*\})/)
  let sentiment = { score: 5, stress: 50, emotion: 'neutre', crisis: false }
  let responseText = fullResponse
  if (sentimentMatch) {
    try { sentiment = JSON.parse(sentimentMatch[1]) } catch { /* garde défaut */ }
    responseText = fullResponse.replace(/\nSENTIMENT:.*$/m, '').trim()
  }

  // 3. ElevenLabs TTS
  const elevenLabsKey = Deno.env.get('ELEVENLABS_API_KEY')!
  const voiceId = Deno.env.get('ELEVENLABS_VOICE_ID') ?? 'EXAVITQu4vr4xnSDxMaL' // voix fr par défaut
  const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'xi-api-key': elevenLabsKey },
    body: JSON.stringify({
      text: responseText,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.8 },
    }),
  })
  const audioData = await ttsRes.arrayBuffer()

  // 4. Upload vers Supabase Storage
  const fileName = `mounima-voice/${session_id}/${Date.now()}.mp3`
  await supabaseAdmin.storage.from('voice-sessions').upload(fileName, audioData, {
    contentType: 'audio/mpeg',
    upsert: false,
  })
  const { data: signedUrl } = await supabaseAdmin.storage
    .from('voice-sessions')
    .createSignedUrl(fileName, 3600) // 1h

  return new Response(JSON.stringify({
    transcript,
    response: responseText,
    sentiment,
    audio_url: signedUrl?.signedUrl ?? null,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
})
```

**Step 3: Créer le bucket Supabase Storage**

Via le dashboard Supabase ou SQL :
```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('voice-sessions', 'voice-sessions', false);
CREATE POLICY "auth_users_voice" ON storage.objects FOR ALL USING (auth.role() = 'authenticated');
```

**Step 4: Commit**
```bash
git add supabase/functions/mounima-voice/ supabase/functions/mounima-chat/
git commit -m "feat(functions): mounima-voice STT+LLM+TTS edge function + mounima-chat rename"
```

---

## Task 7 : Écran session vocale `mounima/voice.tsx`

**Files:**
- Create: `apps/mobile/app/(patient)/mental-health/mounima/voice.tsx`

**Contexte :** Expo AV est déjà installé (`expo-av`). Reanimated 3 est installé. L'écran capture l'audio avec `Audio.Recording`, l'envoie à `mounima-voice`, joue la réponse, affiche les indicateurs de sentiment.

```typescript
import { useState, useRef, useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity, Pressable, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Audio } from 'expo-av'
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming,
  withSequence, Easing,
} from 'react-native-reanimated'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { supabase } from '@/services/supabase'

interface Sentiment { score: number; stress: number; emotion: string; crisis: boolean }
interface Exchange { transcript: string; response: string; sentiment: Sentiment; timestamp: number }

function WaveRing({ isActive, color }: { isActive: boolean; color: string }) {
  const scale = useSharedValue(1)
  const opacity = useSharedValue(0.6)

  useEffect(() => {
    if (isActive) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.3, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        ), -1, false
      )
      opacity.value = withRepeat(withSequence(withTiming(1, { duration: 600 }), withTiming(0.4, { duration: 600 })), -1, false)
    } else {
      scale.value = withTiming(1)
      opacity.value = withTiming(0.6)
    }
  }, [isActive])

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))

  return (
    <Animated.View style={[{
      width: 120, height: 120, borderRadius: 60,
      backgroundColor: color + '20',
      borderWidth: 2, borderColor: color,
      alignItems: 'center', justifyContent: 'center',
      position: 'absolute',
    }, animStyle]} />
  )
}

export default function VoiceSessionScreen() {
  const router = useRouter()
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const [currentSentiment, setCurrentSentiment] = useState<Sentiment>({ score: 5, stress: 50, emotion: 'neutre', crisis: false })
  const [showCrisis, setShowCrisis] = useState(false)
  const [sessionStart] = useState(Date.now())
  const [elapsed, setElapsed] = useState(0)

  const recordingRef = useRef<Audio.Recording | null>(null)
  const soundRef = useRef<Audio.Sound | null>(null)
  const sessionId = useRef(`session_${Date.now()}`).current

  // Timer
  useEffect(() => {
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - sessionStart) / 1000)), 1000)
    return () => clearInterval(interval)
  }, [sessionStart])

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  // Démarrer l'enregistrement
  const startRecording = useCallback(async () => {
    await Audio.requestPermissionsAsync()
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true })
    const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY)
    recordingRef.current = recording
    setIsRecording(true)
  }, [])

  // Arrêter et envoyer
  const stopAndSend = useCallback(async () => {
    if (!recordingRef.current) return
    setIsRecording(false)
    setIsProcessing(true)

    await recordingRef.current.stopAndUnloadAsync()
    const uri = recordingRef.current.getURI()
    recordingRef.current = null

    try {
      const response = await fetch(uri!)
      const blob = await response.blob()
      const reader = new FileReader()
      const base64 = await new Promise<string>(resolve => {
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.readAsDataURL(blob)
      })

      const { data: { session } } = await supabase.auth.getSession()
      const history = exchanges.map(e => ([
        { role: 'user', content: e.transcript },
        { role: 'assistant', content: e.response },
      ])).flat()

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/mounima-voice`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({ audio_base64: base64, conversation_history: history, session_id: sessionId }),
        }
      )
      const data = await res.json()

      const exchange: Exchange = {
        transcript: data.transcript,
        response: data.response,
        sentiment: data.sentiment,
        timestamp: Date.now(),
      }
      setExchanges(prev => [...prev, exchange])
      setCurrentSentiment(data.sentiment)
      if (data.sentiment.crisis) setShowCrisis(true)

      // Jouer la réponse audio
      if (data.audio_url) {
        const { sound } = await Audio.Sound.createAsync({ uri: data.audio_url })
        soundRef.current = sound
        setIsPlaying(true)
        await sound.playAsync()
        sound.setOnPlaybackStatusUpdate(status => {
          if ((status as any).didJustFinish) setIsPlaying(false)
        })
      }
    } catch (e) {
      console.error('Voice error:', e)
    } finally {
      setIsProcessing(false)
    }
  }, [exchanges, sessionId])

  const handleEndSession = () => {
    soundRef.current?.unloadAsync()
    router.push({
      pathname: '/(patient)/mental-health/mounima/voice-insights',
      params: {
        exchanges: JSON.stringify(exchanges),
        duration: String(elapsed),
      },
    })
  }

  const isActive = isRecording || isPlaying || isProcessing
  const waveColor = isRecording ? '#ba1a1a' : isPlaying ? '#006685' : '#6f787e'
  const stressLevel = currentSentiment.stress

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0b1c30' }}>

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 }}>
        <View>
          <Text style={{ fontFamily: 'Manrope', fontSize: 12, color: 'rgba(255,255,255,0.50)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Session vocale
          </Text>
          <Text style={{ fontFamily: 'Manrope', fontSize: 20, fontWeight: '700', color: '#fff' }}>
            Mounima
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text style={{ fontFamily: 'Manrope', fontSize: 16, fontWeight: '700', color: 'rgba(255,255,255,0.70)' }}>
            {formatTime(elapsed)}
          </Text>
          <TouchableOpacity onPress={handleEndSession}
            style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)' }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.60)' }}>
              Terminer
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Crisis banner */}
      {showCrisis && (
        <Pressable
          onPress={() => Linking.openURL('tel:+221338238020')}
          style={{ marginHorizontal: 24, marginBottom: 16, padding: 14, borderRadius: 12, backgroundColor: '#ba1a1a', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <MaterialIcons name="warning" size={18} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '700', color: '#fff' }}>
              Je détecte une détresse — tu n'es pas seul·e
            </Text>
            <Text style={{ fontFamily: 'Manrope', fontSize: 12, color: 'rgba(255,255,255,0.80)' }}>
              Appuie pour appeler SOS Amitié (+221 33 823 8020)
            </Text>
          </View>
        </Pressable>
      )}

      {/* Indicateurs sentiment */}
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 24, marginBottom: 16 }}>
        <View style={{ flex: 1, padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontFamily: 'Manrope', fontSize: 10, color: 'rgba(255,255,255,0.50)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Stress</Text>
          <Text style={{ fontFamily: 'Manrope', fontSize: 18, fontWeight: '900', color: stressLevel > 70 ? '#ba1a1a' : stressLevel > 40 ? '#e4c546' : '#1d7a3a' }}>
            {stressLevel}%
          </Text>
        </View>
        <View style={{ flex: 1, padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontFamily: 'Manrope', fontSize: 10, color: 'rgba(255,255,255,0.50)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Humeur</Text>
          <Text style={{ fontFamily: 'Manrope', fontSize: 18, fontWeight: '900', color: '#fff' }}>
            {currentSentiment.score}/10
          </Text>
        </View>
        <View style={{ flex: 2, padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontFamily: 'Manrope', fontSize: 10, color: 'rgba(255,255,255,0.50)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Émotion</Text>
          <Text style={{ fontFamily: 'Manrope', fontSize: 14, fontWeight: '700', color: '#82d8ff', textTransform: 'capitalize' }}>
            {currentSentiment.emotion}
          </Text>
        </View>
      </View>

      {/* Zone centrale onde */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <WaveRing isActive={isActive} color={waveColor} />
        <View style={{
          width: 80, height: 80, borderRadius: 40,
          backgroundColor: isRecording ? '#ba1a1a' : isPlaying ? '#006685' : 'rgba(255,255,255,0.08)',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <MaterialIcons
            name={isRecording ? 'mic' : isPlaying ? 'volume-up' : isProcessing ? 'hourglass-empty' : 'mic-none'}
            size={32}
            color={isActive ? '#fff' : 'rgba(255,255,255,0.40)'}
          />
        </View>

        <Text style={{ fontFamily: 'Manrope', fontSize: 14, color: 'rgba(255,255,255,0.40)', marginTop: 16 }}>
          {isRecording ? 'J\'écoute...' : isProcessing ? 'Mounima réfléchit...' : isPlaying ? 'Mounima parle...' : 'Maintiens pour parler'}
        </Text>
      </View>

      {/* Disclaimer */}
      <Text style={{ fontFamily: 'Manrope', fontSize: 11, color: 'rgba(255,255,255,0.25)', textAlign: 'center', paddingHorizontal: 32, paddingBottom: 8 }}>
        Mounima n'est pas un médecin ou thérapeute
      </Text>

      {/* Bouton micro */}
      <View style={{ paddingHorizontal: 24, paddingBottom: 32 }}>
        <Pressable
          onPressIn={startRecording}
          onPressOut={stopAndSend}
          disabled={isProcessing || isPlaying}
          style={{
            height: 64, borderRadius: 32,
            backgroundColor: isProcessing || isPlaying ? 'rgba(255,255,255,0.10)' : '#006685',
            alignItems: 'center', justifyContent: 'center',
            flexDirection: 'row', gap: 8,
          }}
        >
          <MaterialIcons name="mic" size={22} color={isProcessing || isPlaying ? 'rgba(255,255,255,0.30)' : '#fff'} />
          <Text style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: '700', color: isProcessing || isPlaying ? 'rgba(255,255,255,0.30)' : '#fff' }}>
            {isProcessing ? 'Traitement...' : isPlaying ? 'Écoute Mounima...' : 'Maintiens pour parler'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}
```

**Step 2: Commit**
```bash
git add apps/mobile/app/\(patient\)/mental-health/mounima/voice.tsx
git commit -m "feat(mobile): Mounima voice session screen with Reanimated wave"
```

---

## Task 8 : Écran insights post-session `mounima/voice-insights.tsx`

**Files:**
- Create: `apps/mobile/app/(patient)/mental-health/mounima/voice-insights.tsx`

```typescript
import { useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { GlassCard } from '@/components/ui/GlassCard'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/features/auth/store/authStore'

interface Exchange { transcript: string; response: string; sentiment: { score: number; stress: number; emotion: string }; timestamp: number }

export default function VoiceInsightsScreen() {
  const router = useRouter()
  const { exchanges: exchangesRaw, duration } = useLocalSearchParams<{ exchanges: string; duration: string }>()
  const { profile } = useAuthStore()

  const exchanges: Exchange[] = useMemo(() => {
    try { return JSON.parse(exchangesRaw ?? '[]') }
    catch { return [] }
  }, [exchangesRaw])

  const durationSec = parseInt(duration ?? '0', 10)
  const avgScore = exchanges.length > 0
    ? Math.round(exchanges.reduce((s, e) => s + e.sentiment.score, 0) / exchanges.length * 10) / 10
    : 0
  const avgStress = exchanges.length > 0
    ? Math.round(exchanges.reduce((s, e) => s + e.sentiment.stress, 0) / exchanges.length)
    : 0

  const CHART_H = 80
  const maxScore = 10

  const handleSaveToJournal = async () => {
    if (!profile?.id || exchanges.length === 0) return
    const content = exchanges.map(e => `Moi : ${e.transcript}\n\nMounima : ${e.response}`).join('\n\n---\n\n')
    await supabase.from('journal_entries').insert({
      patient_id: profile.id,
      title: `Session vocale Mounima — ${new Date().toLocaleDateString('fr-FR')}`,
      content,
      mood_score: avgScore,
      tags: ['mounima', 'session-vocale'],
      is_private: true,
    })
    router.push('/(patient)/mental-health/journal')
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Header */}
        <View style={{ paddingHorizontal: 24, paddingTop: 16, marginBottom: 24 }}>
          <TouchableOpacity onPress={() => router.push('/(patient)/mental-health')}
            style={{ marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <MaterialIcons name="arrow-back" size={20} color="#006685" />
            <Text style={{ color: '#006685', fontFamily: 'Manrope', fontWeight: '500' }}>Accueil</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#0b1c30', fontFamily: 'Manrope' }}>
            Fin de session
          </Text>
          <Text style={{ fontSize: 14, color: '#3f484d', fontFamily: 'Manrope', marginTop: 4 }}>
            {Math.floor(durationSec / 60)} min {durationSec % 60} sec · {exchanges.length} échanges
          </Text>
        </View>

        <View style={{ paddingHorizontal: 24, gap: 16 }}>

          {/* KPIs */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <GlassCard style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 26, fontWeight: '900', color: avgScore >= 7 ? '#1d7a3a' : avgScore >= 4 ? '#705d00' : '#ba1a1a', fontFamily: 'Manrope' }}>
                {avgScore}
              </Text>
              <Text style={{ fontSize: 11, color: '#6f787e', fontFamily: 'Manrope', textAlign: 'center' }}>Score émotionnel</Text>
            </GlassCard>
            <GlassCard style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 26, fontWeight: '900', color: avgStress > 70 ? '#ba1a1a' : avgStress > 40 ? '#705d00' : '#1d7a3a', fontFamily: 'Manrope' }}>
                {avgStress}%
              </Text>
              <Text style={{ fontSize: 11, color: '#6f787e', fontFamily: 'Manrope', textAlign: 'center' }}>Stress moyen</Text>
            </GlassCard>
          </View>

          {/* Graphe tension émotionnelle */}
          {exchanges.length > 1 && (
            <GlassCard>
              <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '700', color: '#0b1c30', marginBottom: 12 }}>
                Évolution de l'humeur
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: CHART_H, gap: 6 }}>
                {exchanges.map((e, i) => {
                  const h = Math.max((e.sentiment.score / maxScore) * CHART_H * 0.9, 4)
                  const color = e.sentiment.score >= 7 ? '#1d7a3a' : e.sentiment.score >= 4 ? '#e4c546' : '#ba1a1a'
                  return (
                    <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: CHART_H, gap: 4 }}>
                      <View style={{ height: h, width: '70%', borderRadius: 4, backgroundColor: color }} />
                      <Text style={{ fontFamily: 'Manrope', fontSize: 9, color: '#6f787e' }}>{i + 1}</Text>
                    </View>
                  )
                })}
              </View>
            </GlassCard>
          )}

          {/* Disclaimer */}
          <View style={{ padding: 14, borderRadius: 12, backgroundColor: 'rgba(0,102,133,0.06)', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <MaterialIcons name="info" size={16} color="#006685" />
            <Text style={{ fontFamily: 'Manrope', fontSize: 12, color: '#3f484d', flex: 1, lineHeight: 18 }}>
              Mounima n'est pas un médecin ou thérapeute. Pour un suivi clinique, consulte un praticien.
            </Text>
          </View>

          {/* CTAs */}
          <TouchableOpacity
            onPress={handleSaveToJournal}
            style={{ paddingVertical: 14, borderRadius: 999, backgroundColor: '#006685', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
            <MaterialIcons name="book" size={18} color="#fff" />
            <Text style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: '700', color: '#fff' }}>
              Enregistrer dans le journal
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/(patient)/find-practitioners')}
            style={{ paddingVertical: 14, borderRadius: 999, borderWidth: 1, borderColor: '#006685', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
            <MaterialIcons name="calendar-today" size={18} color="#006685" />
            <Text style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: '700', color: '#006685' }}>
              Réserver une séance
            </Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
```

**Step 2: Ajouter un bouton "Session vocale" dans `mounima/index.tsx`**

Dans le header de l'écran Mounima chat, ajouter :
```typescript
<TouchableOpacity onPress={() => router.push('/(patient)/mental-health/mounima/voice')}>
  <MaterialIcons name="mic" size={24} color="#006685" />
</TouchableOpacity>
```

**Step 3: Commit**
```bash
git add apps/mobile/app/\(patient\)/mental-health/mounima/voice-insights.tsx apps/mobile/app/\(patient\)/mental-health/mounima/index.tsx
git commit -m "feat(mobile): Mounima voice insights screen + voice button in chat"
```

---

## Task 9 : Deploy + typecheck final

**Step 1: Appliquer la migration meditation_sessions**

```bash
SUPABASE_ACCESS_TOKEN=sbp_... npx supabase db push --project-ref jilpynvkpkepusvwcqch
```

**Step 2: Déployer les nouvelles Edge Functions**

```bash
SUPABASE_ACCESS_TOKEN=sbp_... npx supabase functions deploy mounima-voice --project-ref jilpynvkpkepusvwcqch
SUPABASE_ACCESS_TOKEN=sbp_... npx supabase functions deploy mounima-chat --project-ref jilpynvkpkepusvwcqch
```

**Step 3: Configurer les secrets Supabase**

Via le dashboard Supabase → Settings → Edge Function Secrets :
```
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=EXAVITQu4vr4xnSDxMaL  # ou voice ID fr de ton choix
```

**Step 4: Typecheck**

```bash
cd apps/mobile && pnpm typecheck
cd apps/web && pnpm typecheck
```
Résultat attendu : 0 erreurs.

**Step 5: Push final**
```bash
git push origin main
```
