# P2 — Auth, Praticien & Patient Features — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implémenter 6 features P2 : reset MDP web + deep link mobile, invitation collaborateur admin, refus patient multi-absences, créneaux × prestations × types, médecin traitant, gestion statuts praticiens admin.

**Architecture:** Hybride — Supabase Auth pour credentials, DB PostgreSQL custom pour logique métier. Chaque feature = migration SQL + Edge Function (si besoin) + UI mobile (Expo Router) + UI web (Next.js 15 App Router). Design validé dans `docs/plans/2026-05-13-p2-auth-practitioner-patient-design.md`.

**Tech Stack:** Supabase Auth/DB/Storage, Edge Functions (Deno), React Native + Expo Router v6, Next.js 15 App Router, NativeWind v4, TailwindCSS, TanStack Query v5, Zustand, React Hook Form + Zod, Resend, Expo Push Notifications.

---

## Task 1 : Toutes les migrations SQL P2

**Files:**
- Create: `supabase/migrations/20260513000003_p2_schema.sql`

**Contexte:** Toutes les nouvelles tables et colonnes pour les 6 features en une seule migration atomique. À appliquer via MCP Supabase `apply_migration`.

**Step 1: Créer la migration**

```sql
-- supabase/migrations/20260513000003_p2_schema.sql

-- ── SECTION 2 : Invitations ──
CREATE TABLE IF NOT EXISTS public.invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('admin','moderator','accountant','practitioner')),
  token       UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '48 hours',
  status      TEXT DEFAULT 'pending' CHECK (status IN ('pending','accepted','expired')),
  invited_by  UUID NOT NULL REFERENCES public.users(id),
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_manage_invitations" ON public.invitations
  FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON public.invitations(status);

-- ── SECTION 3 : Refus patient ──
CREATE TABLE IF NOT EXISTS public.practitioner_patient_rules (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id       UUID NOT NULL REFERENCES public.practitioners(id) UNIQUE,
  alert_threshold       INT DEFAULT 2,
  auto_block_threshold  INT DEFAULT 3,
  default_cooldown_days INT DEFAULT 30
);
ALTER TABLE public.practitioner_patient_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "practitioner_own_rules" ON public.practitioner_patient_rules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.practitioners p WHERE p.id = practitioner_id AND p.user_id = auth.uid())
  );

CREATE TABLE IF NOT EXISTS public.practitioner_patient_blocks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id UUID NOT NULL REFERENCES public.practitioners(id),
  patient_id      UUID NOT NULL REFERENCES public.users(id),
  reason          TEXT,
  cooldown_until  DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  unblocked_at    TIMESTAMPTZ,
  UNIQUE(practitioner_id, patient_id)
);
ALTER TABLE public.practitioner_patient_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "practitioner_own_blocks" ON public.practitioner_patient_blocks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.practitioners p WHERE p.id = practitioner_id AND p.user_id = auth.uid())
  );
CREATE INDEX IF NOT EXISTS idx_blocks_practitioner_patient ON public.practitioner_patient_blocks(practitioner_id, patient_id);

-- ── SECTION 4 : Créneaux × prestations ──
CREATE TABLE IF NOT EXISTS public.practitioner_services (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id UUID NOT NULL REFERENCES public.practitioners(id),
  name            TEXT NOT NULL,
  duration_min    INT NOT NULL DEFAULT 60,
  price           NUMERIC(10,2),
  session_types   TEXT[] NOT NULL DEFAULT ARRAY['video'],
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.practitioner_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "practitioner_own_services" ON public.practitioner_services
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.practitioners p WHERE p.id = practitioner_id AND p.user_id = auth.uid())
  );
CREATE POLICY "services_public_read" ON public.practitioner_services
  FOR SELECT USING (is_active = TRUE);

CREATE TABLE IF NOT EXISTS public.availability_day_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id UUID NOT NULL REFERENCES public.practitioners(id),
  day_of_week     INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  allowed_types   TEXT[] NOT NULL DEFAULT ARRAY['video','audio','presentiel'],
  UNIQUE(practitioner_id, day_of_week)
);
ALTER TABLE public.availability_day_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "practitioner_own_day_rules" ON public.availability_day_rules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.practitioners p WHERE p.id = practitioner_id AND p.user_id = auth.uid())
  );
CREATE POLICY "day_rules_public_read" ON public.availability_day_rules FOR SELECT USING (TRUE);

ALTER TABLE public.availabilities
  ADD COLUMN IF NOT EXISTS override_types TEXT[],
  ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES public.practitioner_services(id);

-- ── SECTION 5 : Médecin traitant ──
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS referring_doctor_id UUID REFERENCES public.practitioners(id),
  ADD COLUMN IF NOT EXISTS referring_doctor_status TEXT DEFAULT 'none'
    CHECK (referring_doctor_status IN ('none','pending','accepted','refused'));

-- RLS : médecin traitant accède au dossier médical de ses patients
DROP POLICY IF EXISTS "referring_doctor_access" ON public.patient_medical_profiles;
CREATE POLICY "referring_doctor_access" ON public.patient_medical_profiles
  FOR SELECT USING (
    auth.uid() = patient_id
    OR EXISTS (
      SELECT 1 FROM public.practitioners p
      JOIN public.users u ON u.referring_doctor_id = p.id
      WHERE p.user_id = auth.uid()
        AND u.id = patient_medical_profiles.patient_id
        AND u.referring_doctor_status = 'accepted'
    )
  );

-- ── SECTION 6 : Statuts praticiens ──
ALTER TABLE public.practitioners
  ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'active'
    CHECK (account_status IN ('active','suspended','blocked')),
  ADD COLUMN IF NOT EXISTS status_reason TEXT,
  ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_changed_by UUID REFERENCES public.users(id);

CREATE TABLE IF NOT EXISTS public.practitioner_status_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id UUID NOT NULL REFERENCES public.practitioners(id),
  old_status      TEXT,
  new_status      TEXT NOT NULL,
  reason          TEXT NOT NULL,
  changed_by      UUID NOT NULL REFERENCES public.users(id),
  changed_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.practitioner_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_read_status_history" ON public.practitioner_status_history
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "practitioner_own_status_history" ON public.practitioner_status_history
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.practitioners p WHERE p.id = practitioner_id AND p.user_id = auth.uid())
  );

CREATE TABLE IF NOT EXISTS public.practitioner_appeals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id UUID NOT NULL REFERENCES public.practitioners(id),
  message         TEXT NOT NULL,
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','reviewed','accepted','rejected')),
  admin_response  TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at     TIMESTAMPTZ,
  reviewed_by     UUID REFERENCES public.users(id)
);
ALTER TABLE public.practitioner_appeals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_manage_appeals" ON public.practitioner_appeals
  FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "practitioner_own_appeals" ON public.practitioner_appeals
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.practitioners p WHERE p.id = practitioner_id AND p.user_id = auth.uid())
  );
```

**Step 2: Appliquer via MCP Supabase**
```
mcp__claude_ai_Supabase__apply_migration(project_id="jilpynvkpkepusvwcqch", name="p2_schema", query=<contenu ci-dessus>)
```
Résultat attendu : `{"success": true}`

**Step 3: Commit**
```bash
git add supabase/migrations/20260513000003_p2_schema.sql
git commit -m "feat(db): P2 schema — invitations, patient-blocks, services, day-rules, referring-doctor, practitioner-status"
```

---

## Task 2 : Reset MDP — deep link mobile + écran reset

**Files:**
- Modify: `apps/mobile/features/auth/services/authService.ts`
- Modify: `apps/mobile/features/auth/schemas/authSchemas.ts`
- Create: `apps/mobile/app/(auth)/reset-password.tsx`
- Modify: `apps/mobile/app.json` (scheme déjà `msante`)

**Contexte:** `authService.resetPassword()` envoie déjà l'email mais sans `redirectTo`. Le deep link `msante://reset-password` doit ouvrir l'écran de reset avec le token Supabase dans l'URL.

**Step 1: Modifier authService — ajouter redirectTo**

Dans `apps/mobile/features/auth/services/authService.ts`, trouver `resetPassword` et modifier :
```typescript
async resetPassword(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'msante://reset-password',
  })
  if (error) throw error
},
```

**Step 2: Ajouter le schema Zod resetPassword**

Dans `apps/mobile/features/auth/schemas/authSchemas.ts`, ajouter :
```typescript
export const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, 'Minimum 8 caractères')
    .regex(/[A-Z]/, 'Au moins une majuscule')
    .regex(/[0-9]/, 'Au moins un chiffre')
    .regex(/[^A-Za-z0-9]/, 'Au moins un caractère spécial'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
})
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>
```

**Step 3: Créer l'écran reset-password**

Créer `apps/mobile/app/(auth)/reset-password.tsx` :
```tsx
import { useState, useEffect } from 'react'
import { View, Text, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as Linking from 'expo-linking'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { GlassCard, AppTextInput, PrimaryButton } from '@/components/ui'
import { supabase } from '@/services/supabase'
import { resetPasswordSchema, type ResetPasswordFormData } from '@/features/auth/schemas/authSchemas'

export default function ResetPasswordScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  // Récupérer access_token du deep link et l'injecter dans la session Supabase
  useEffect(() => {
    const handleUrl = async (url: string) => {
      const parsed = Linking.parse(url)
      const accessToken = parsed.queryParams?.access_token as string | undefined
      const refreshToken = parsed.queryParams?.refresh_token as string | undefined
      if (accessToken && refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      }
    }
    Linking.getInitialURL().then((url) => { if (url) handleUrl(url) })
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url))
    return () => sub.remove()
  }, [])

  const { control, handleSubmit, formState: { errors } } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  })

  const onSubmit = async (data: ResetPasswordFormData) => {
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: data.password })
      if (error) throw error
      setDone(true)
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible de réinitialiser')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff', paddingHorizontal: 24 }}>
      <View style={{ marginTop: 40, marginBottom: 28 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}>
            <MaterialIcons name="lock" size={22} color="#006685" />
          </View>
          <View>
            <Text style={{ fontSize: 24, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope', letterSpacing: -0.5 }}>
              Nouveau mot de passe
            </Text>
            <Text style={{ fontSize: 13, color: '#6f787e', fontFamily: 'Manrope' }}>
              Choisissez un mot de passe sécurisé
            </Text>
          </View>
        </View>
      </View>

      {done ? (
        <GlassCard style={{ alignItems: 'center', gap: 20 }}>
          <MaterialIcons name="check-circle" size={64} color="#006685" />
          <Text style={{ fontSize: 20, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope' }}>
            Mot de passe mis à jour !
          </Text>
          <PrimaryButton label="Se connecter" onPress={() => router.replace('/(auth)/login')} />
        </GlassCard>
      ) : (
        <GlassCard style={{ gap: 16 }}>
          <Controller control={control} name="password"
            render={({ field: { onChange, value } }) => (
              <AppTextInput label="Nouveau mot de passe" value={value} onChangeText={onChange}
                secureTextEntry error={errors.password?.message} />
            )} />
          <Controller control={control} name="confirmPassword"
            render={({ field: { onChange, value } }) => (
              <AppTextInput label="Confirmer le mot de passe" value={value} onChangeText={onChange}
                secureTextEntry error={errors.confirmPassword?.message} />
            )} />
          <Text style={{ fontSize: 12, color: '#6f787e', fontFamily: 'Manrope' }}>
            Min. 8 caractères · 1 majuscule · 1 chiffre · 1 caractère spécial
          </Text>
          <PrimaryButton label="Enregistrer" onPress={handleSubmit(onSubmit)} loading={loading} />
        </GlassCard>
      )}
    </SafeAreaView>
  )
}
```

**Step 4: Commit**
```bash
git add apps/mobile/features/auth/services/authService.ts apps/mobile/features/auth/schemas/authSchemas.ts apps/mobile/app/(auth)/reset-password.tsx
git commit -m "feat(mobile): reset password deep link + new password screen"
```

---

## Task 3 : Reset MDP — pages web

**Files:**
- Create: `apps/web/app/auth/forgot-password/page.tsx`
- Create: `apps/web/app/auth/reset-password/page.tsx`
- Create: `apps/web/app/auth/layout.tsx`

**Contexte:** Next.js 15 App Router. L'écran web doit intercepter le hash Supabase (`#access_token=...`) dans l'URL après le clic sur le lien email.

**Step 1: Créer le layout auth web**

```tsx
// apps/web/app/auth/layout.tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8">
          <span className="material-symbols-outlined text-sky-500 text-3xl">medical_services</span>
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-slate-900">M-Santé</h1>
            <p className="text-xs text-slate-500 font-medium">Health Sanctuary</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}
```

**Step 2: Page forgot-password web**

```tsx
// apps/web/app/auth/forgot-password/page.tsx
'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    setSent(true)
  }

  if (sent) return (
    <div className="glass-card rounded-xl p-8 text-center space-y-4">
      <span className="material-symbols-outlined text-sky-500 text-5xl">mark_email_read</span>
      <h2 className="text-xl font-bold text-slate-900">Email envoyé !</h2>
      <p className="text-slate-500 text-sm">Vérifiez votre boîte mail et cliquez sur le lien pour réinitialiser votre mot de passe.</p>
      <a href="/auth/login" className="block text-sky-600 text-sm font-semibold hover:underline">Retour à la connexion</a>
    </div>
  )

  return (
    <div className="glass-card rounded-xl p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900">Mot de passe oublié</h2>
        <p className="text-slate-500 text-sm mt-1">Entrez votre email pour recevoir un lien de réinitialisation.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-semibold text-slate-700">Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
            className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            placeholder="votre@email.com" />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full bg-[#006685] text-white rounded-lg py-3 font-semibold text-sm hover:bg-[#005470] transition disabled:opacity-50">
          {loading ? 'Envoi...' : 'Envoyer le lien'}
        </button>
      </form>
    </div>
  )
}
```

**Step 3: Page reset-password web**

```tsx
// apps/web/app/auth/reset-password/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Supabase envoie le token dans le hash — on établit la session
  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      // PASSWORD_RECOVERY event triggered when user follows the link
    })
  }, [])

  const validate = () => {
    if (password.length < 8) return 'Minimum 8 caractères'
    if (!/[A-Z]/.test(password)) return 'Au moins une majuscule'
    if (!/[0-9]/.test(password)) return 'Au moins un chiffre'
    if (!/[^A-Za-z0-9]/.test(password)) return 'Au moins un caractère spécial'
    if (password !== confirm) return 'Les mots de passe ne correspondent pas'
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validationError = validate()
    if (validationError) { setError(validationError); return }
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { setError(error.message); return }
    setDone(true)
    setTimeout(() => router.push('/auth/login'), 2000)
  }

  if (done) return (
    <div className="glass-card rounded-xl p-8 text-center space-y-4">
      <span className="material-symbols-outlined text-emerald-500 text-5xl">check_circle</span>
      <h2 className="text-xl font-bold text-slate-900">Mot de passe mis à jour !</h2>
      <p className="text-slate-500 text-sm">Redirection vers la connexion...</p>
    </div>
  )

  return (
    <div className="glass-card rounded-xl p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900">Nouveau mot de passe</h2>
        <p className="text-slate-500 text-sm mt-1">Choisissez un mot de passe sécurisé.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-semibold text-slate-700">Nouveau mot de passe</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
            className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-700">Confirmer le mot de passe</label>
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
            className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
        </div>
        <p className="text-xs text-slate-400">Min. 8 caractères · 1 majuscule · 1 chiffre · 1 caractère spécial</p>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full bg-[#006685] text-white rounded-lg py-3 font-semibold text-sm hover:bg-[#005470] transition disabled:opacity-50">
          {loading ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </form>
    </div>
  )
}
```

**Step 4: Commit**
```bash
git add apps/web/app/auth/
git commit -m "feat(web): forgot password + reset password pages"
```

---

## Task 4 : Edge Function `invite-collaborator`

**Files:**
- Create: `supabase/functions/invite-collaborator/index.ts`

**Contexte:** Appelée par l'admin. Crée l'invitation en DB et envoie l'email via Resend avec un lien d'onboarding. Protégée par JWT (seul admin peut appeler).

**Step 1: Créer la fonction**

```typescript
// supabase/functions/invite-collaborator/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401 })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Vérifier que l'appelant est admin
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data: caller } = await supabase
    .from('users').select('role').eq('id', user.id).single()
  if (caller?.role !== 'admin') return new Response('Forbidden', { status: 403 })

  const { email, role } = await req.json()
  if (!email || !role) return new Response('Missing email or role', { status: 400 })

  // Créer invitation
  const { data: invitation, error } = await supabase
    .from('invitations')
    .insert({ email, role, invited_by: user.id })
    .select('token')
    .single()

  if (error) return new Response(JSON.stringify({ error: error.message }), {
    status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })

  const baseUrl = Deno.env.get('APP_URL') ?? 'https://app.msante.sn'
  const inviteLink = `${baseUrl}/invite?token=${invitation.token}`
  const resendKey = Deno.env.get('RESEND_API_KEY') ?? ''

  const roleLabels: Record<string, string> = {
    admin: 'Administrateur', moderator: 'Modérateur',
    accountant: 'Comptable', practitioner: 'Praticien',
  }

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'M-Santé <noreply@msante.sn>',
      to: [email],
      subject: `Invitation M-Santé — ${roleLabels[role] ?? role}`,
      html: `
        <div style="font-family: Manrope, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #006685;">Vous êtes invité sur M-Santé</h2>
          <p>Vous avez été invité en tant que <strong>${roleLabels[role] ?? role}</strong>.</p>
          <p>Cliquez sur le lien ci-dessous pour créer votre compte. Ce lien expire dans 48 heures.</p>
          <a href="${inviteLink}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#006685;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
            Créer mon compte
          </a>
          <p style="color:#6f787e;font-size:12px;">Si vous n'attendiez pas cet email, ignorez-le.</p>
        </div>
      `,
    }),
  })

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})
```

**Step 2: Déployer via MCP**
```
mcp__claude_ai_Supabase__deploy_edge_function(name="invite-collaborator", verify_jwt=true, ...)
```

**Step 3: Commit**
```bash
git add supabase/functions/invite-collaborator/
git commit -m "feat(functions): invite-collaborator edge function"
```

---

## Task 5 : Page web `/invite?token=xxx` + onboarding

**Files:**
- Create: `apps/web/app/invite/page.tsx`

**Contexte:** L'invité clique sur le lien email, arrive sur cette page. Elle vérifie le token, affiche le formulaire de création de compte. Si rôle = praticien → redirect vers onboarding mobile (deep link) ou page web d'onboarding praticien.

**Step 1: Créer la page**

```tsx
// apps/web/app/invite/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Invitation {
  id: string; email: string; role: string; status: string; expires_at: string
}

export default function InvitePage() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get('token')

  const [invitation, setInvitation] = useState<Invitation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) { setError('Token manquant'); setLoading(false); return }
    supabase.from('invitations')
      .select('id, email, role, status, expires_at')
      .eq('token', token)
      .single()
      .then(({ data, error: e }) => {
        setLoading(false)
        if (e || !data) { setError('Invitation invalide ou expirée'); return }
        if (data.status !== 'pending') { setError('Cette invitation a déjà été utilisée'); return }
        if (new Date(data.expires_at) < new Date()) { setError('Cette invitation a expiré'); return }
        setInvitation(data)
      })
  }, [token])

  const validate = () => {
    if (password.length < 8) return 'Minimum 8 caractères'
    if (!/[A-Z]/.test(password)) return 'Au moins une majuscule'
    if (!/[0-9]/.test(password)) return 'Au moins un chiffre'
    if (!/[^A-Za-z0-9]/.test(password)) return 'Au moins un caractère spécial'
    if (password !== confirm) return 'Les mots de passe ne correspondent pas'
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validErr = validate()
    if (validErr) { setError(validErr); return }
    if (!invitation) return
    setSubmitting(true)
    setError(null)

    // Créer le compte via Supabase Auth
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: invitation.email,
      password,
    })
    if (authErr || !authData.user) { setError(authErr?.message ?? 'Erreur création compte'); setSubmitting(false); return }

    // Créer le profil public.users
    await supabase.from('users').upsert({
      id: authData.user.id,
      full_name: '',
      role: invitation.role === 'practitioner' ? 'practitioner' : (invitation.role === 'admin' ? 'admin' : 'patient'),
      onboarding_completed: invitation.role !== 'practitioner',
    })

    // Marquer invitation acceptée
    await supabase.from('invitations')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('token', token!)

    setSubmitting(false)
    // Redirect
    if (invitation.role === 'practitioner') router.push('/practitioner/onboarding')
    else router.push('/admin')
  }

  if (loading) return <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center"><p>Chargement...</p></div>

  if (error && !invitation) return (
    <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center p-6">
      <div className="glass-card rounded-xl p-8 text-center max-w-md w-full space-y-4">
        <span className="material-symbols-outlined text-red-500 text-5xl">error</span>
        <h2 className="text-xl font-bold text-slate-900">{error}</h2>
        <a href="/" className="text-sky-600 text-sm font-semibold hover:underline">Retour à l'accueil</a>
      </div>
    </div>
  )

  const roleLabels: Record<string, string> = {
    admin: 'Administrateur', moderator: 'Modérateur',
    accountant: 'Comptable', practitioner: 'Praticien',
  }

  return (
    <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-sky-500 text-3xl">medical_services</span>
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-slate-900">M-Santé</h1>
            <p className="text-xs text-slate-500 font-medium">Health Sanctuary</p>
          </div>
        </div>
        <div className="glass-card rounded-xl p-8 space-y-6">
          <div>
            <span className="inline-block bg-sky-100 text-sky-700 text-xs font-bold px-3 py-1 rounded-full mb-3">
              {roleLabels[invitation?.role ?? ''] ?? invitation?.role}
            </span>
            <h2 className="text-2xl font-extrabold text-slate-900">Créer votre compte</h2>
            <p className="text-slate-500 text-sm mt-1">{invitation?.email}</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-slate-700">Mot de passe</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Confirmer</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
                className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
            </div>
            <p className="text-xs text-slate-400">Min. 8 caractères · 1 majuscule · 1 chiffre · 1 caractère spécial</p>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button type="submit" disabled={submitting}
              className="w-full bg-[#006685] text-white rounded-lg py-3 font-semibold text-sm hover:bg-[#005470] transition disabled:opacity-50">
              {submitting ? 'Création...' : 'Créer mon compte'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Commit**
```bash
git add apps/web/app/invite/
git commit -m "feat(web): invite page — token validation + account creation"
```

---

## Task 6 : Page admin `/admin/collaborators`

**Files:**
- Create: `apps/web/app/admin/collaborators/page.tsx`
- Modify: `apps/web/app/admin/layout.tsx` (ajouter lien nav)

**Step 1: Créer la page collaborateurs**

```tsx
// apps/web/app/admin/collaborators/page.tsx
'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

const ROLES = [
  { value: 'admin', label: 'Administrateur' },
  { value: 'moderator', label: 'Modérateur' },
  { value: 'accountant', label: 'Comptable' },
  { value: 'practitioner', label: 'Praticien' },
]

export default function CollaboratorsPage() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('moderator')

  const { data: invitations = [] } = useQuery({
    queryKey: ['invitations'],
    queryFn: async () => {
      const { data } = await supabase
        .from('invitations')
        .select('id, email, role, status, created_at, expires_at')
        .order('created_at', { ascending: false })
      return data ?? []
    },
  })

  const invite = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/invite-collaborator`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ email, role }),
      })
      if (!res.ok) throw new Error('Erreur lors de l\'invitation')
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invitations'] })
      setShowModal(false)
      setEmail('')
      setRole('moderator')
    },
  })

  const STATUS_BADGE: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    accepted: 'bg-emerald-100 text-emerald-700',
    expired: 'bg-slate-100 text-slate-500',
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Collaborateurs</h1>
          <p className="text-slate-500 text-sm mt-1">Gérez les invitations et accès à la plateforme</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-[#006685] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#005470] transition">
          <span className="material-symbols-outlined text-sm">person_add</span>
          Inviter un collaborateur
        </button>
      </div>

      {/* Tableau invitations */}
      <div className="bg-white/60 backdrop-blur-md border border-white/80 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Invitations</h2>
        </div>
        <table className="w-full">
          <thead className="bg-slate-50/50">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Email</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Rôle</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Statut</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Envoyée le</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invitations.map((inv: any) => (
              <tr key={inv.id} className="hover:bg-slate-50/50">
                <td className="px-6 py-4 text-sm text-slate-800">{inv.email}</td>
                <td className="px-6 py-4 text-sm text-slate-600 capitalize">{ROLES.find(r => r.value === inv.role)?.label ?? inv.role}</td>
                <td className="px-6 py-4">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_BADGE[inv.status] ?? ''}`}>
                    {inv.status === 'pending' ? 'En attente' : inv.status === 'accepted' ? 'Acceptée' : 'Expirée'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-500">
                  {new Date(inv.created_at).toLocaleDateString('fr-FR')}
                </td>
              </tr>
            ))}
            {invitations.length === 0 && (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-400 text-sm">Aucune invitation pour le moment</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal invitation */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Inviter un collaborateur</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-700">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="collaborateur@email.com" />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700">Rôle</label>
                <div className="mt-2 space-y-2">
                  {ROLES.map(r => (
                    <label key={r.value} className="flex items-center gap-3 cursor-pointer">
                      <input type="radio" name="role" value={r.value} checked={role === r.value}
                        onChange={() => setRole(r.value)} className="text-sky-600" />
                      <span className="text-sm text-slate-700">{r.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)}
                className="flex-1 border border-slate-200 text-slate-700 rounded-lg py-2.5 text-sm font-semibold hover:bg-slate-50 transition">
                Annuler
              </button>
              <button onClick={() => invite.mutate({ email, role })} disabled={!email || invite.isPending}
                className="flex-1 bg-[#006685] text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-[#005470] transition disabled:opacity-50">
                {invite.isPending ? 'Envoi...' : 'Envoyer l\'invitation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Ajouter lien dans la nav admin**

Dans `apps/web/app/admin/layout.tsx`, ajouter dans les liens de navigation :
```tsx
{ href: '/admin/collaborators', icon: 'group', label: 'Collaborateurs' }
```

**Step 3: Commit**
```bash
git add apps/web/app/admin/collaborators/ apps/web/app/admin/layout.tsx
git commit -m "feat(web): admin collaborators page + invite modal"
```

---

## Task 7 : Edge Function `on-appointment-status-change` (no_show alert)

**Files:**
- Create: `supabase/functions/on-appointment-status-change/index.ts`

**Contexte:** Appelée quand un RDV passe au statut `no_show`. Compte les absences du patient chez ce praticien et envoie une alerte push si seuil atteint.

**Step 1: Créer la fonction**

```typescript
// supabase/functions/on-appointment-status-change/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { appointment_id, new_status } = await req.json()
  if (new_status !== 'no_show') {
    return new Response(JSON.stringify({ skipped: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Récupérer le RDV
  const { data: appt } = await supabase
    .from('appointments')
    .select('patient_id, practitioner_id')
    .eq('id', appointment_id)
    .single()

  if (!appt) return new Response('Not found', { status: 404 })

  // Compter les no_shows de ce patient chez ce praticien
  const { count } = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('patient_id', appt.patient_id)
    .eq('practitioner_id', appt.practitioner_id)
    .eq('status', 'no_show')

  const noShowCount = count ?? 0

  // Récupérer les règles du praticien
  const { data: rules } = await supabase
    .from('practitioner_patient_rules')
    .select('alert_threshold')
    .eq('practitioner_id', appt.practitioner_id)
    .maybeSingle()

  const alertThreshold = rules?.alert_threshold ?? 2

  if (noShowCount >= alertThreshold) {
    // Récupérer le push token du praticien
    const { data: practitioner } = await supabase
      .from('practitioners')
      .select('user_id')
      .eq('id', appt.practitioner_id)
      .single()

    if (practitioner) {
      const { data: practUser } = await supabase
        .from('users')
        .select('push_token, full_name')
        .eq('id', practitioner.user_id)
        .single()

      const { data: patient } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', appt.patient_id)
        .single()

      if (practUser?.push_token) {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: practUser.push_token,
            title: 'Patient absent ⚠️',
            body: `${patient?.full_name ?? 'Un patient'} a manqué ${noShowCount} RDV. Voulez-vous le restreindre ?`,
            data: {
              route: '/(practitioner)/patients',
              patient_id: appt.patient_id,
              practitioner_id: appt.practitioner_id,
            },
          }),
        })
      }

      // Log notification en DB
      await supabase.from('notifications').insert({
        user_id: practitioner.user_id,
        type: 'appointment_reminder',
        title: 'Patient absent ⚠️',
        body: `${patient?.full_name ?? 'Un patient'} a manqué ${noShowCount} RDV.`,
        data: { patient_id: appt.patient_id, no_show_count: noShowCount },
        channel: 'push',
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
    }
  }

  return new Response(JSON.stringify({ no_show_count: noShowCount }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})
```

**Step 2: Déployer**
```
mcp__claude_ai_Supabase__deploy_edge_function(name="on-appointment-status-change", verify_jwt=true, ...)
```

**Step 3: Commit**
```bash
git add supabase/functions/on-appointment-status-change/
git commit -m "feat(functions): no-show alert edge function"
```

---

## Task 8 : UI praticien — gestion patients à risque (mobile + web)

**Files:**
- Create: `apps/mobile/features/practitioner/hooks/usePatientBlocks.ts`
- Create: `apps/mobile/app/(practitioner)/patients.tsx`
- Create: `apps/web/app/practitioner/patients/page.tsx`

**Contexte:** Le praticien voit les patients ayant des absences, peut les bloquer/mettre en carence/débloquer. La vérification de blocage est faite dans `create-appointment`.

**Step 1: Hook `usePatientBlocks`**

```typescript
// apps/mobile/features/practitioner/hooks/usePatientBlocks.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/features/auth/store/authStore'

export function usePatientBlocks() {
  const { practitioner } = useAuthStore()
  const qc = useQueryClient()

  const noShowPatients = useQuery({
    queryKey: ['no-show-patients', practitioner?.id],
    enabled: !!practitioner?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('appointments')
        .select('patient_id, users!appointments_patient_id_fkey(id, full_name, avatar_url)')
        .eq('practitioner_id', practitioner!.id)
        .eq('status', 'no_show')
      // Grouper par patient
      const counts: Record<string, { patient: any; count: number }> = {}
      for (const row of data ?? []) {
        const pid = row.patient_id
        if (!counts[pid]) counts[pid] = { patient: row.users, count: 0 }
        counts[pid].count++
      }
      return Object.values(counts).filter(c => c.count >= 1)
    },
  })

  const blocks = useQuery({
    queryKey: ['patient-blocks', practitioner?.id],
    enabled: !!practitioner?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('practitioner_patient_blocks')
        .select('*, patient:users!practitioner_patient_blocks_patient_id_fkey(id, full_name)')
        .eq('practitioner_id', practitioner!.id)
        .is('unblocked_at', null)
      return data ?? []
    },
  })

  const blockPatient = useMutation({
    mutationFn: async ({ patientId, cooldownDays }: { patientId: string; cooldownDays: number | null }) => {
      const cooldownUntil = cooldownDays
        ? new Date(Date.now() + cooldownDays * 86400000).toISOString().split('T')[0]
        : null
      await supabase.from('practitioner_patient_blocks').upsert({
        practitioner_id: practitioner!.id,
        patient_id: patientId,
        cooldown_until: cooldownUntil,
        unblocked_at: null,
      })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['patient-blocks'] }) },
  })

  const unblockPatient = useMutation({
    mutationFn: async (patientId: string) => {
      await supabase.from('practitioner_patient_blocks')
        .update({ unblocked_at: new Date().toISOString() })
        .eq('practitioner_id', practitioner!.id)
        .eq('patient_id', patientId)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['patient-blocks'] }) },
  })

  return { noShowPatients, blocks, blockPatient, unblockPatient }
}
```

**Step 2: Écran mobile patients**

Créer `apps/mobile/app/(practitioner)/patients.tsx` avec :
- Section "Patients à surveiller" (no_shows ≥ 1)
- Actions par patient : Ignorer / Délai de carence (input jours) / Bloquer définitivement
- Section "Patients restreints" avec bouton Débloquer

**Step 3: Page web patients praticien**

Créer `apps/web/app/practitioner/patients/page.tsx` avec la même logique en Tailwind/shadcn.

**Step 4: Modifier `create-appointment` Edge Function**

Dans `supabase/functions/create-appointment/index.ts`, ajouter avant la création du RDV :
```typescript
// Vérifier si le patient est bloqué chez ce praticien
const today = new Date().toISOString().split('T')[0]
const { data: block } = await supabase
  .from('practitioner_patient_blocks')
  .select('cooldown_until')
  .eq('practitioner_id', practitionerId)
  .eq('patient_id', patientId)
  .is('unblocked_at', null)
  .maybeSingle()

if (block && (block.cooldown_until === null || block.cooldown_until >= today)) {
  return new Response(JSON.stringify({ error: 'Ce praticien n\'accepte plus de nouvelles réservations pour le moment.' }), {
    status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}
```

**Step 5: Commit**
```bash
git add apps/mobile/features/practitioner/hooks/usePatientBlocks.ts apps/mobile/app/(practitioner)/patients.tsx apps/web/app/practitioner/patients/ supabase/functions/create-appointment/
git commit -m "feat: practitioner patient blocking — no-show alerts + block/cooldown UI"
```

---

## Task 9 : Prestations praticien — CRUD mobile + web

**Files:**
- Create: `apps/mobile/features/practitioner/hooks/usePractitionerServices.ts`
- Create: `apps/mobile/app/(practitioner)/services.tsx`
- Create: `apps/web/app/practitioner/services/page.tsx`

**Step 1: Hook `usePractitionerServices`**

```typescript
// apps/mobile/features/practitioner/hooks/usePractitionerServices.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/features/auth/store/authStore'

export type SessionType = 'video' | 'audio' | 'presentiel'

export interface PractitionerService {
  id: string
  name: string
  duration_min: number
  price: number | null
  session_types: SessionType[]
  is_active: boolean
}

export function usePractitionerServices() {
  const { practitioner } = useAuthStore()
  const qc = useQueryClient()

  const services = useQuery({
    queryKey: ['practitioner-services', practitioner?.id],
    enabled: !!practitioner?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('practitioner_services')
        .select('*')
        .eq('practitioner_id', practitioner!.id)
        .order('created_at')
      return (data ?? []) as PractitionerService[]
    },
  })

  const createService = useMutation({
    mutationFn: async (service: Omit<PractitionerService, 'id' | 'is_active'>) => {
      await supabase.from('practitioner_services').insert({
        ...service,
        practitioner_id: practitioner!.id,
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['practitioner-services'] }),
  })

  const updateService = useMutation({
    mutationFn: async ({ id, ...data }: Partial<PractitionerService> & { id: string }) => {
      await supabase.from('practitioner_services').update(data).eq('id', id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['practitioner-services'] }),
  })

  const deleteService = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('practitioner_services').update({ is_active: false }).eq('id', id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['practitioner-services'] }),
  })

  return { services, createService, updateService, deleteService }
}
```

**Step 2: Écran mobile services**

Créer `apps/mobile/app/(practitioner)/services.tsx` :
- Liste des prestations avec nom, durée, prix, badges types (vidéo/audio/présentiel)
- Bouton "+" → bottom sheet : formulaire nom + durée + prix + toggles types
- Swipe gauche pour supprimer / tap pour éditer

**Step 3: Page web services praticien**

Créer `apps/web/app/practitioner/services/page.tsx` avec un tableau CRUD + modal ajout/édition.

**Step 4: Commit**
```bash
git add apps/mobile/features/practitioner/hooks/usePractitionerServices.ts apps/mobile/app/(practitioner)/services.tsx apps/web/app/practitioner/services/
git commit -m "feat: practitioner services CRUD — mobile + web"
```

---

## Task 10 : Règles par jour + override créneau (availability settings)

**Files:**
- Modify: `apps/mobile/app/(practitioner)/availability.tsx`
- Modify: `apps/web/app/practitioner/availability/page.tsx` (si existant)
- Create: `apps/mobile/features/practitioner/hooks/useDayRules.ts`

**Step 1: Hook `useDayRules`**

```typescript
// apps/mobile/features/practitioner/hooks/useDayRules.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/features/auth/store/authStore'

const DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

export function useDayRules() {
  const { practitioner } = useAuthStore()
  const qc = useQueryClient()

  const dayRules = useQuery({
    queryKey: ['day-rules', practitioner?.id],
    enabled: !!practitioner?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('availability_day_rules')
        .select('*')
        .eq('practitioner_id', practitioner!.id)
      return data ?? []
    },
  })

  const upsertDayRule = useMutation({
    mutationFn: async ({ dayOfWeek, allowedTypes }: { dayOfWeek: number; allowedTypes: string[] }) => {
      await supabase.from('availability_day_rules').upsert({
        practitioner_id: practitioner!.id,
        day_of_week: dayOfWeek,
        allowed_types: allowedTypes,
      }, { onConflict: 'practitioner_id,day_of_week' })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['day-rules'] }),
  })

  return { dayRules, upsertDayRule, DAYS }
}
```

**Step 2: Modifier l'écran availability mobile**

Dans `apps/mobile/app/(practitioner)/availability.tsx`, ajouter une section "Types par jour" avec des toggles (vidéo / audio / présentiel) pour chaque jour de la semaine actif.

**Step 3: Commit**
```bash
git add apps/mobile/features/practitioner/hooks/useDayRules.ts apps/mobile/app/(practitioner)/availability.tsx
git commit -m "feat(mobile): day-level session type rules in availability screen"
```

---

## Task 11 : Filtre type de consultation côté patient (booking)

**Files:**
- Modify: `apps/mobile/app/(patient)/booking/[practitionerId].tsx`

**Step 1: Ajouter la logique de résolution des types disponibles**

Dans le hook de booking, après avoir chargé les créneaux, calculer les types disponibles pour chaque slot :

```typescript
// Résolution : override_types > service.session_types > day_rules > practitioner.session_types
function resolveSlotTypes(slot: Availability, dayRules: DayRule[], practitioner: Practitioner): string[] {
  if (slot.override_types?.length) return slot.override_types
  if (slot.service_id) {
    // Récupéré via join dans la query
    return slot.service?.session_types ?? ['video']
  }
  const dow = new Date(slot.start_time).getDay()
  const dayRule = dayRules.find(r => r.day_of_week === dow)
  if (dayRule) return dayRule.allowed_types
  return practitioner.session_types ?? ['video', 'audio', 'presentiel']
}
```

**Step 2: Ajouter le filtre UI**

En haut de la liste des créneaux, ajouter 3 boutons filtres :
```tsx
const SESSION_FILTERS = [
  { id: 'all', label: 'Tous', icon: 'calendar_month' },
  { id: 'video', label: 'Vidéo', icon: 'videocam' },
  { id: 'audio', label: 'Audio', icon: 'headset_mic' },
  { id: 'presentiel', label: 'Présentiel', icon: 'location_on' },
]
```

**Step 3: Badges sur les créneaux**

Sur chaque créneau, afficher les icônes des types disponibles.

**Step 4: Commit**
```bash
git add apps/mobile/app/(patient)/booking/[practitionerId].tsx
git commit -m "feat(mobile): session type filter + badges on booking slots"
```

---

## Task 12 : Médecin traitant — UI patient (mobile + web)

**Files:**
- Create: `apps/mobile/features/patient/hooks/useReferringDoctor.ts`
- Modify: `apps/mobile/app/(patient)/profile.tsx` (ou create si absent)
- Create: `apps/web/app/patient/profile/page.tsx` (section médecin traitant)

**Step 1: Hook `useReferringDoctor`**

```typescript
// apps/mobile/features/patient/hooks/useReferringDoctor.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/features/auth/store/authStore'

export function useReferringDoctor() {
  const { profile, setProfile } = useAuthStore()
  const qc = useQueryClient()

  const generalPractitioners = useQuery({
    queryKey: ['general-practitioners'],
    queryFn: async () => {
      const { data } = await supabase
        .from('practitioners')
        .select('id, speciality, session_price, users!inner(full_name, avatar_url)')
        .ilike('speciality', '%generaliste%')
        .eq('is_verified', true)
        .eq('account_status', 'active')
      return data ?? []
    },
  })

  const setReferringDoctor = useMutation({
    mutationFn: async (practitionerId: string) => {
      await supabase.from('users').update({
        referring_doctor_id: practitionerId,
        referring_doctor_status: 'pending',
      }).eq('id', profile!.id)
      // Notifier le médecin
      await supabase.functions.invoke('notify-referring-doctor', {
        body: { patient_id: profile!.id, practitioner_id: practitionerId },
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  })

  const removeReferringDoctor = useMutation({
    mutationFn: async () => {
      await supabase.from('users').update({
        referring_doctor_id: null,
        referring_doctor_status: 'none',
      }).eq('id', profile!.id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  })

  return { generalPractitioners, setReferringDoctor, removeReferringDoctor }
}
```

**Step 2: Section "Mon médecin traitant" dans le profil patient mobile**

Ajouter dans `apps/mobile/app/(patient)/profile.tsx` (ou équivalent) :
- Si pas de médecin traitant : bouton "Choisir mon médecin traitant" → bottom sheet avec liste des généralistes
- Si en attente : badge "En attente d'acceptation"
- Si accepté : carte médecin avec photo + nom + bouton "Changer"

**Step 3: Edge Function `notify-referring-doctor`**

```typescript
// supabase/functions/notify-referring-doctor/index.ts
// Envoie une notification push + email au médecin quand un patient le désigne
// Envoie aussi confirmation au patient quand le médecin accepte/refuse
```

**Step 4: Dashboard médecin — onglet patients**

Dans `apps/web/app/practitioner/patients/page.tsx`, ajouter une section "Désignations médecin traitant" avec boutons Accepter/Refuser.

**Step 5: Commit**
```bash
git add apps/mobile/features/patient/hooks/useReferringDoctor.ts apps/mobile/app/(patient)/ apps/web/app/practitioner/patients/ supabase/functions/notify-referring-doctor/
git commit -m "feat: referring doctor — patient selection + practitioner accept/refuse"
```

---

## Task 13 : Admin — gestion statuts praticiens (suspendre/bloquer + appels)

**Files:**
- Modify: `apps/web/app/admin/practitioners/page.tsx`
- Create: `apps/web/app/admin/appeals/page.tsx`
- Create: `supabase/functions/update-practitioner-status/index.ts`

**Step 1: Edge Function `update-practitioner-status`**

```typescript
// supabase/functions/update-practitioner-status/index.ts
// Paramètres : { practitioner_id, new_status, reason }
// Actions :
//   - Met à jour practitioners.account_status + status_reason + status_changed_at
//   - Insère dans practitioner_status_history
//   - Si blocked : annule les RDV futurs + déclenche remboursements
//   - Envoie notification push + email au praticien avec le motif
```

**Step 2: Modifier page admin practitioners**

Dans `apps/web/app/admin/practitioners/page.tsx`, ajouter :
- Colonne "Statut compte" (actif / suspendu / bloqué) avec badge coloré
- Boutons **Suspendre** et **Bloquer** par ligne → modal "Motif (obligatoire)"
- Bouton **Réactiver** si suspendu/bloqué
- Onglet **"Appels en cours"** avec compteur badge

**Step 3: Page admin appeals**

```tsx
// apps/web/app/admin/appeals/page.tsx
// Liste des practitioner_appeals avec status='pending'
// Actions par appel : champ texte réponse + boutons Accepter/Rejeter
// Si accepté → réactive le praticien automatiquement
```

**Step 4: Bannière praticien suspendu/bloqué (mobile + web)**

Dans le layout praticien (mobile `_layout.tsx` et web `practitioner/layout.tsx`), vérifier `practitioner.account_status` :
- Si `suspended` ou `blocked` : afficher bannière rouge avec motif + bouton "Contester"
- Bouton "Contester" → formulaire → insert dans `practitioner_appeals`

**Step 5: Ajouter lien "Appels" dans nav admin**

Dans `apps/web/app/admin/layout.tsx` ajouter :
```tsx
{ href: '/admin/appeals', icon: 'gavel', label: 'Appels' }
```

**Step 6: Commit**
```bash
git add supabase/functions/update-practitioner-status/ apps/web/app/admin/practitioners/ apps/web/app/admin/appeals/ apps/web/app/admin/layout.tsx apps/mobile/app/(practitioner)/ apps/web/app/practitioner/layout.tsx
git commit -m "feat: admin practitioner status management — suspend/block/appeal flow"
```

---

## Task 14 : Push GitHub + deploy Supabase

**Step 1: Push GitHub**
```bash
git push origin main
```

**Step 2: Deploy toutes les nouvelles Edge Functions**
```
mcp__claude_ai_Supabase__deploy_edge_function(name="invite-collaborator", ...)
mcp__claude_ai_Supabase__deploy_edge_function(name="on-appointment-status-change", ...)
mcp__claude_ai_Supabase__deploy_edge_function(name="notify-referring-doctor", ...)
mcp__claude_ai_Supabase__deploy_edge_function(name="update-practitioner-status", ...)
```

**Step 3: Vérifier les migrations appliquées**
```
mcp__claude_ai_Supabase__list_migrations(project_id="jilpynvkpkepusvwcqch")
```
Résultat attendu : `p2_schema` dans la liste.

**Step 4: Typecheck final**
```bash
cd apps/mobile && pnpm typecheck
cd apps/web && pnpm typecheck
```
Résultat attendu : 0 erreurs.
