# P0 Auth + Onboarding Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implémenter l'authentification complète (email/password + Google OAuth), l'onboarding différencié patient/praticien, et la sécurité RLS Supabase pour M-Santé.

**Architecture:** Supabase Auth natif + Zustand authStore + Expo Router guards. Le store centralise user/profile/practitioner et synchro via `onAuthStateChange`. Le routing est entièrement piloté par l'état du store (authenticated → onboarding → espace rôle).

**Tech Stack:** React Native + Expo SDK 52, Expo Router v3, NativeWind v4, Supabase JS v2, Zustand, TanStack Query v5, React Hook Form, Zod, expo-auth-session, expo-document-picker, expo-secure-store.

---

## Task 1 : Scaffolding monorepo + Expo

**Files:**
- Create: `apps/mobile/package.json`
- Create: `apps/mobile/app.json`
- Create: `apps/mobile/tsconfig.json`
- Create: `package.json` (root)
- Create: `pnpm-workspace.yaml`

**Step 1: Initialiser le workspace pnpm**

```bash
mkdir -p apps/mobile packages/backend packages/ui
```

**Step 2: Créer `pnpm-workspace.yaml`**

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

**Step 3: Créer `package.json` racine**

```json
{
  "name": "m-sante",
  "private": true,
  "scripts": {
    "dev:mobile": "pnpm --filter mobile start",
    "dev:web": "pnpm --filter web dev",
    "typecheck": "pnpm --filter mobile tsc --noEmit",
    "test": "pnpm --filter mobile test"
  }
}
```

**Step 4: Initialiser l'app Expo**

```bash
cd apps/mobile
npx create-expo-app@latest . --template blank-typescript
```

**Step 5: Installer les dépendances**

```bash
cd apps/mobile
pnpm add @supabase/supabase-js zustand @tanstack/react-query \
  react-hook-form zod @hookform/resolvers \
  expo-router expo-secure-store expo-auth-session \
  expo-document-picker expo-image-picker \
  react-native-reanimated nativewind@4
pnpm add -D tailwindcss@3
```

**Step 6: Créer `apps/mobile/tsconfig.json`**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

**Step 7: Configurer NativeWind — `apps/mobile/tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './features/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#006685',
        'primary-container': '#82d8ff',
        'on-primary': '#ffffff',
        secondary: '#705d00',
        'secondary-container': '#ffde5c',
        background: '#f8f9ff',
        surface: '#f8f9ff',
        'surface-container-low': '#eff4ff',
        'surface-container': '#e5eeff',
        'on-surface': '#0b1c30',
        'on-surface-variant': '#3f484d',
        outline: '#6f787e',
        'outline-variant': '#bec8ce',
        error: '#ba1a1a',
        'error-container': '#ffdad6',
      },
      fontFamily: {
        manrope: ['Manrope'],
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
        full: '9999px',
      },
    },
  },
  plugins: [],
}
```

**Step 8: Configurer `apps/mobile/app.json`**

```json
{
  "expo": {
    "name": "M-Santé",
    "slug": "m-sante",
    "scheme": "msante",
    "version": "1.0.0",
    "orientation": "portrait",
    "platforms": ["ios", "android"],
    "plugins": [
      "expo-router",
      "expo-secure-store",
      ["expo-document-picker", { "iCloudContainerEnvironment": "Production" }]
    ],
    "android": { "adaptiveIcon": { "foregroundImage": "./assets/icon.png" } },
    "ios": { "bundleIdentifier": "com.msante.app" }
  }
}
```

**Step 9: Vérifier que le projet compile**

```bash
cd apps/mobile && npx tsc --noEmit
```
Expected: 0 erreurs

**Step 10: Commit**

```bash
git add -A
git commit -m "chore(mobile): scaffold Expo monorepo with NativeWind + Supabase deps"
```

---

## Task 2 : Migration Supabase — Tables + RLS + Trigger

**Files:**
- Create: `supabase/migrations/20260430000001_create_users.sql`
- Create: `supabase/migrations/20260430000002_create_practitioners.sql`
- Create: `supabase/migrations/20260430000003_rls_policies.sql`
- Create: `supabase/migrations/20260430000004_auth_trigger.sql`

**Step 1: Créer `supabase/migrations/20260430000001_create_users.sql`**

```sql
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'patient'
    CHECK (role IN ('patient', 'practitioner', 'admin')),
  full_name TEXT NOT NULL,
  phone TEXT,
  country TEXT DEFAULT 'SN',
  language TEXT DEFAULT 'fr',
  date_of_birth DATE,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_role ON public.users(role);
```

**Step 2: Créer `supabase/migrations/20260430000002_create_practitioners.sql`**

```sql
CREATE TABLE public.practitioners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  speciality TEXT NOT NULL,
  bio TEXT,
  languages TEXT[] DEFAULT ARRAY['fr'],
  session_price NUMERIC(10,2),
  session_currency TEXT DEFAULT 'XOF',
  session_duration_min INT DEFAULT 60,
  is_verified BOOLEAN DEFAULT FALSE,
  verification_status TEXT DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'under_review', 'approved', 'rejected')),
  rating NUMERIC(3,2),
  total_reviews INT DEFAULT 0,
  timezone TEXT DEFAULT 'Africa/Dakar',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.verification_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id UUID NOT NULL REFERENCES public.practitioners(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL
    CHECK (document_type IN ('diploma', 'license', 'id_card', 'other')),
  file_url TEXT NOT NULL,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES public.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_practitioners_user ON public.practitioners(user_id);
CREATE INDEX idx_practitioners_status ON public.practitioners(verification_status);
CREATE INDEX idx_verification_docs_practitioner ON public.verification_documents(practitioner_id);
```

**Step 3: Créer `supabase/migrations/20260430000003_rls_policies.sql`**

```sql
-- === users ===
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_self_read" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_self_update" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "admins_full_access_users" ON public.users
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- === practitioners ===
ALTER TABLE public.practitioners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "practitioners_public_read" ON public.practitioners
  FOR SELECT USING (is_verified = TRUE OR user_id = auth.uid());

CREATE POLICY "practitioners_self_insert" ON public.practitioners
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "practitioners_self_update" ON public.practitioners
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "admins_full_access_practitioners" ON public.practitioners
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- === verification_documents ===
ALTER TABLE public.verification_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "docs_practitioner_own" ON public.verification_documents
  FOR ALL USING (
    practitioner_id IN (
      SELECT id FROM public.practitioners WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "docs_admin_all" ON public.verification_documents
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
```

**Step 4: Créer `supabase/migrations/20260430000004_auth_trigger.sql`**

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, role, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'patient'),
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    )
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

**Step 5: Lancer Supabase local et appliquer les migrations**

```bash
supabase start
supabase db reset
```
Expected: "Reset successful"

**Step 6: Vérifier les tables dans Supabase Studio**

```bash
supabase status
# Ouvrir http://localhost:54323 → Table Editor → vérifier users, practitioners, verification_documents
```

**Step 7: Commit**

```bash
git add supabase/
git commit -m "feat(db): create users, practitioners, verification_documents tables with RLS"
```

---

## Task 3 : Types TypeScript globaux

**Files:**
- Create: `apps/mobile/types/database.ts`
- Create: `apps/mobile/types/auth.ts`

**Step 1: Créer `apps/mobile/types/database.ts`**

```typescript
export type UserRole = 'patient' | 'practitioner' | 'admin'
export type VerificationStatus = 'pending' | 'under_review' | 'approved' | 'rejected'
export type DocumentType = 'diploma' | 'license' | 'id_card' | 'other'

export interface UserProfile {
  id: string
  role: UserRole
  full_name: string
  phone: string | null
  country: string
  language: string
  date_of_birth: string | null
  onboarding_completed: boolean
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Practitioner {
  id: string
  user_id: string
  speciality: string
  bio: string | null
  languages: string[]
  session_price: number | null
  session_currency: string
  session_duration_min: number
  is_verified: boolean
  verification_status: VerificationStatus
  rating: number | null
  total_reviews: number
  timezone: string
  created_at: string
}

export interface VerificationDocument {
  id: string
  practitioner_id: string
  document_type: DocumentType
  file_url: string
  status: 'pending' | 'approved' | 'rejected'
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}
```

**Step 2: Créer `apps/mobile/types/auth.ts`**

```typescript
import type { User } from '@supabase/supabase-js'
import type { UserProfile, Practitioner } from './database'

export interface AuthResult {
  user: User | null
  error: string | null
}

export interface PatientOnboardingData {
  full_name: string
  phone: string
  country: string
  date_of_birth: string
  language: string
}

export interface PractitionerOnboardingData {
  speciality: string
  bio: string
  languages: string[]
  session_price: number
  session_currency: string
  session_duration_min: number
  documents: Array<{
    document_type: 'diploma' | 'license' | 'id_card' | 'other'
    uri: string
    name: string
  }>
}

export { User, UserProfile, Practitioner }
```

**Step 3: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```
Expected: 0 erreurs

**Step 4: Commit**

```bash
git add apps/mobile/types/
git commit -m "feat(types): add database and auth TypeScript interfaces"
```

---

## Task 4 : Client Supabase singleton

**Files:**
- Create: `apps/mobile/services/supabase.ts`
- Create: `apps/mobile/.env.local` (template uniquement)

**Step 1: Créer `.env.local`**

```bash
EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

**Step 2: Créer `apps/mobile/services/supabase.ts`**

```typescript
import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'
import type { UserProfile, Practitioner } from '@/types/database'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) return null
  return data
}

export async function fetchPractitionerProfile(userId: string): Promise<Practitioner | null> {
  const { data, error } = await supabase
    .from('practitioners')
    .select('*')
    .eq('user_id', userId)
    .single()
  if (error) return null
  return data
}
```

**Step 3: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add apps/mobile/services/supabase.ts apps/mobile/.env.local
git commit -m "feat(supabase): add client singleton with SecureStore adapter"
```

---

## Task 5 : Zod Schemas

**Files:**
- Create: `apps/mobile/features/auth/schemas/authSchemas.ts`

**Step 1: Créer `apps/mobile/features/auth/schemas/authSchemas.ts`**

```typescript
import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Minimum 8 caractères'),
})

export const signupSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Minimum 8 caractères'),
  confirmPassword: z.string(),
  full_name: z.string().min(2, 'Nom requis'),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
})

export const patientOnboardingSchema = z.object({
  full_name: z.string().min(2, 'Nom requis'),
  phone: z.string().regex(/^\+?[0-9]{8,15}$/, 'Numéro invalide'),
  country: z.enum(['SN', 'CI', 'CM', 'FR']),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide'),
  language: z.enum(['fr', 'en']),
})

export const practitionerStep1Schema = z.object({
  speciality: z.string().min(2, 'Spécialité requise'),
  bio: z.string().min(20, 'Bio trop courte (min 20 caractères)'),
  languages: z.array(z.string()).min(1, 'Au moins une langue'),
  session_price: z.number().positive('Tarif invalide'),
  session_currency: z.enum(['XOF', 'EUR', 'USD']),
  session_duration_min: z.enum([30, 45, 60, 90]).transform(Number),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email('Email invalide'),
})

export type LoginFormData = z.infer<typeof loginSchema>
export type SignupFormData = z.infer<typeof signupSchema>
export type PatientOnboardingData = z.infer<typeof patientOnboardingSchema>
export type PractitionerStep1Data = z.infer<typeof practitionerStep1Schema>
export type ForgotPasswordData = z.infer<typeof forgotPasswordSchema>
```

**Step 2: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add apps/mobile/features/auth/schemas/
git commit -m "feat(auth): add Zod validation schemas"
```

---

## Task 6 : Zustand AuthStore

**Files:**
- Create: `apps/mobile/features/auth/store/authStore.ts`

**Step 1: Écrire le test**

Créer `apps/mobile/features/auth/store/__tests__/authStore.test.ts` :

```typescript
import { act, renderHook } from '@testing-library/react-hooks'
import { useAuthStore } from '../authStore'

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.getState().setSession(null)
    useAuthStore.getState().setProfile(null)
  })

  it('starts unauthenticated', () => {
    const { result } = renderHook(() => useAuthStore())
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.user).toBeNull()
  })

  it('setSession updates isAuthenticated', () => {
    const { result } = renderHook(() => useAuthStore())
    act(() => {
      result.current.setSession({ id: 'user-1', email: 'test@test.com' } as any)
    })
    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.user?.id).toBe('user-1')
  })

  it('signOut clears state', async () => {
    const { result } = renderHook(() => useAuthStore())
    act(() => {
      result.current.setSession({ id: 'user-1' } as any)
    })
    await act(async () => {
      await result.current.signOut()
    })
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.user).toBeNull()
  })
})
```

**Step 2: Lancer le test (doit échouer)**

```bash
cd apps/mobile && pnpm test -- --testPathPattern=authStore
```
Expected: FAIL — "authStore not found"

**Step 3: Créer `apps/mobile/features/auth/store/authStore.ts`**

```typescript
import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'
import type { UserProfile, Practitioner } from '@/types/database'
import { supabase } from '@/services/supabase'

interface AuthState {
  user: User | null
  profile: UserProfile | null
  practitioner: Practitioner | null
  isLoading: boolean
  isAuthenticated: boolean
  setSession: (user: User | null) => void
  setProfile: (profile: UserProfile | null) => void
  setPractitioner: (practitioner: Practitioner | null) => void
  setLoading: (loading: boolean) => void
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  practitioner: null,
  isLoading: true,
  isAuthenticated: false,

  setSession: (user) => set({ user, isAuthenticated: !!user }),
  setProfile: (profile) => set({ profile }),
  setPractitioner: (practitioner) => set({ practitioner }),
  setLoading: (isLoading) => set({ isLoading }),

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, profile: null, practitioner: null, isAuthenticated: false })
  },
}))
```

**Step 4: Relancer les tests (doivent passer)**

```bash
cd apps/mobile && pnpm test -- --testPathPattern=authStore
```
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add apps/mobile/features/auth/store/
git commit -m "feat(auth): add Zustand authStore with session management"
```

---

## Task 7 : AuthService

**Files:**
- Create: `apps/mobile/features/auth/services/authService.ts`

**Step 1: Écrire le test**

Créer `apps/mobile/features/auth/services/__tests__/authService.test.ts` :

```typescript
import { authService } from '../authService'
import { supabase } from '@/services/supabase'

jest.mock('@/services/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      resetPasswordForEmail: jest.fn(),
    },
    from: jest.fn(() => ({
      update: jest.fn(() => ({ eq: jest.fn(() => ({ error: null })) })),
      insert: jest.fn(() => ({ error: null })),
    })),
    storage: { from: jest.fn() },
  },
}))

describe('authService', () => {
  it('signInWithEmail returns error on failure', async () => {
    ;(supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid credentials' },
    })
    const result = await authService.signInWithEmail('bad@test.com', 'wrongpass')
    expect(result.error).toBe('Invalid credentials')
    expect(result.user).toBeNull()
  })

  it('signInWithEmail returns user on success', async () => {
    ;(supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    })
    const result = await authService.signInWithEmail('ok@test.com', 'password123')
    expect(result.user?.id).toBe('user-1')
    expect(result.error).toBeNull()
  })
})
```

**Step 2: Lancer le test (doit échouer)**

```bash
cd apps/mobile && pnpm test -- --testPathPattern=authService
```
Expected: FAIL

**Step 3: Créer `apps/mobile/features/auth/services/authService.ts`**

```typescript
import * as WebBrowser from 'expo-web-browser'
import * as AuthSession from 'expo-auth-session'
import { supabase, fetchUserProfile, fetchPractitionerProfile } from '@/services/supabase'
import { useAuthStore } from '../store/authStore'
import type { AuthResult, PatientOnboardingData, PractitionerOnboardingData } from '@/types/auth'

WebBrowser.maybeCompleteAuthSession()

export const authService = {
  async signInWithEmail(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { user: null, error: error.message }
    return { user: data.user, error: null }
  },

  async signUpWithEmail(
    email: string,
    password: string,
    role: 'patient' | 'practitioner',
    full_name: string
  ): Promise<AuthResult> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role, full_name } },
    })
    if (error) return { user: null, error: error.message }
    return { user: data.user, error: null }
  },

  async signInWithGoogle(): Promise<AuthResult> {
    const redirectUrl = AuthSession.makeRedirectUri({ scheme: 'msante' })
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectUrl },
    })
    if (error) return { user: null, error: error.message }
    return { user: null, error: null }
  },

  async resetPassword(email: string): Promise<void> {
    await supabase.auth.resetPasswordForEmail(email)
  },

  async completePatientOnboarding(data: PatientOnboardingData): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
      .from('users')
      .update({
        full_name: data.full_name,
        phone: data.phone,
        country: data.country,
        date_of_birth: data.date_of_birth,
        language: data.language,
        onboarding_completed: true,
      })
      .eq('id', user.id)

    if (error) throw error

    const profile = await fetchUserProfile(user.id)
    useAuthStore.getState().setProfile(profile)
  },

  async completePractitionerOnboarding(data: PractitionerOnboardingData): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data: practitioner, error: pErr } = await supabase
      .from('practitioners')
      .insert({
        user_id: user.id,
        speciality: data.speciality,
        bio: data.bio,
        languages: data.languages,
        session_price: data.session_price,
        session_currency: data.session_currency,
        session_duration_min: data.session_duration_min,
        verification_status: 'pending',
      })
      .select()
      .single()

    if (pErr) throw pErr

    for (const doc of data.documents) {
      const fileExt = doc.name.split('.').pop()
      const filePath = `${user.id}/${doc.document_type}.${fileExt}`
      const blob = await (await fetch(doc.uri)).blob()

      const { error: uploadError } = await supabase.storage
        .from('verification-documents')
        .upload(filePath, blob)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('verification-documents')
        .getPublicUrl(filePath)

      await supabase.from('verification_documents').insert({
        practitioner_id: practitioner.id,
        document_type: doc.document_type,
        file_url: publicUrl,
      })
    }

    await supabase
      .from('users')
      .update({ onboarding_completed: true })
      .eq('id', user.id)

    const profile = await fetchUserProfile(user.id)
    const practitionerProfile = await fetchPractitionerProfile(user.id)
    useAuthStore.getState().setProfile(profile)
    useAuthStore.getState().setPractitioner(practitionerProfile)
  },
}
```

**Step 4: Relancer les tests**

```bash
cd apps/mobile && pnpm test -- --testPathPattern=authService
```
Expected: PASS

**Step 5: Commit**

```bash
git add apps/mobile/features/auth/services/
git commit -m "feat(auth): add authService with email/Google OAuth + onboarding completion"
```

---

## Task 8 : Hooks auth

**Files:**
- Create: `apps/mobile/features/auth/hooks/useAuth.ts`
- Create: `apps/mobile/features/auth/hooks/usePractitionerAccess.ts`

**Step 1: Créer `apps/mobile/features/auth/hooks/useAuth.ts`**

```typescript
import { useAuthStore } from '../store/authStore'

export function useAuth() {
  const { user, profile, practitioner, isLoading, isAuthenticated } = useAuthStore()
  return { user, profile, practitioner, isLoading, isAuthenticated }
}
```

**Step 2: Créer `apps/mobile/features/auth/hooks/usePractitionerAccess.ts`**

```typescript
import { useAuthStore } from '../store/authStore'

export function usePractitionerAccess() {
  const { practitioner } = useAuthStore()
  const status = practitioner?.verification_status ?? 'pending'

  return {
    canAcceptPayments: status === 'approved',
    canStartConsultation: status === 'approved',
    isPending: status === 'pending' || status === 'under_review',
    isApproved: status === 'approved',
    isRejected: status === 'rejected',
    status,
  }
}
```

**Step 3: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add apps/mobile/features/auth/hooks/
git commit -m "feat(auth): add useAuth and usePractitionerAccess hooks"
```

---

## Task 9 : Root Layout + Routing Guard

**Files:**
- Create: `apps/mobile/app/_layout.tsx`
- Create: `apps/mobile/app/(auth)/_layout.tsx`
- Create: `apps/mobile/app/(patient)/_layout.tsx`
- Create: `apps/mobile/app/(practitioner)/_layout.tsx`

**Step 1: Créer `apps/mobile/app/_layout.tsx`**

```typescript
import { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { useAuthStore } from '@/features/auth/store/authStore'
import { supabase, fetchUserProfile, fetchPractitionerProfile } from '@/services/supabase'

export default function RootLayout() {
  const { isAuthenticated, profile, isLoading, setSession, setProfile, setPractitioner, setLoading } = useAuthStore()
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setLoading(true)
      if (session?.user) {
        setSession(session.user)
        const [userProfile, practitionerProfile] = await Promise.all([
          fetchUserProfile(session.user.id),
          fetchPractitionerProfile(session.user.id),
        ])
        setProfile(userProfile)
        setPractitioner(practitionerProfile)
      } else {
        setSession(null)
        setProfile(null)
        setPractitioner(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (isLoading) return

    const inAuth = segments[0] === '(auth)'
    const inOnboarding = segments[0] === '(onboarding)'

    if (!isAuthenticated) {
      if (!inAuth) router.replace('/(auth)/welcome')
      return
    }

    if (!profile?.onboarding_completed) {
      if (!inOnboarding) {
        const route = profile?.role === 'practitioner'
          ? '/(onboarding)/practitioner'
          : '/(onboarding)/patient'
        router.replace(route)
      }
      return
    }

    if (profile.role === 'practitioner') {
      if (!segments[0]?.includes('practitioner')) {
        router.replace('/(practitioner)/home')
      }
    } else {
      if (!segments[0]?.includes('patient')) {
        router.replace('/(patient)/home')
      }
    }
  }, [isAuthenticated, profile, isLoading])

  return <Stack screenOptions={{ headerShown: false }} />
}
```

**Step 2: Créer `apps/mobile/app/(auth)/_layout.tsx`**

```typescript
import { Stack } from 'expo-router'

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
}
```

**Step 3: Créer `apps/mobile/app/(patient)/_layout.tsx`**

```typescript
import { Stack } from 'expo-router'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { Redirect } from 'expo-router'

export default function PatientLayout() {
  const { isAuthenticated, profile } = useAuth()
  if (!isAuthenticated || profile?.role !== 'patient') {
    return <Redirect href="/(auth)/welcome" />
  }
  return <Stack screenOptions={{ headerShown: false }} />
}
```

**Step 4: Créer `apps/mobile/app/(practitioner)/_layout.tsx`**

```typescript
import { Stack } from 'expo-router'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { Redirect } from 'expo-router'

export default function PractitionerLayout() {
  const { isAuthenticated, profile } = useAuth()
  if (!isAuthenticated || profile?.role !== 'practitioner') {
    return <Redirect href="/(auth)/welcome" />
  }
  return <Stack screenOptions={{ headerShown: false }} />
}
```

**Step 5: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

**Step 6: Commit**

```bash
git add apps/mobile/app/
git commit -m "feat(routing): add root layout with onAuthStateChange + route guards"
```

---

## Task 10 : Composants UI partagés

**Files:**
- Create: `apps/mobile/components/ui/GlassCard.tsx`
- Create: `apps/mobile/components/ui/PrimaryButton.tsx`
- Create: `apps/mobile/components/ui/AppTextInput.tsx`
- Create: `apps/mobile/components/ui/StepIndicator.tsx`
- Create: `apps/mobile/components/ui/DocumentUploader.tsx`

**Step 1: Créer `apps/mobile/components/ui/GlassCard.tsx`**

```typescript
import { View } from 'react-native'
import type { ViewProps } from 'react-native'

interface GlassCardProps extends ViewProps {
  children: React.ReactNode
}

export function GlassCard({ children, className = '', ...props }: GlassCardProps) {
  return (
    <View
      className={`bg-white/60 rounded-xl p-5 border border-white/80 ${className}`}
      style={{ backdropFilter: 'blur(16px)' }}
      {...props}
    >
      {children}
    </View>
  )
}
```

**Step 2: Créer `apps/mobile/components/ui/PrimaryButton.tsx`**

```typescript
import { TouchableOpacity, Text, ActivityIndicator } from 'react-native'

interface PrimaryButtonProps {
  label: string
  onPress: () => void
  loading?: boolean
  disabled?: boolean
  variant?: 'primary' | 'outline'
}

export function PrimaryButton({ label, onPress, loading, disabled, variant = 'primary' }: PrimaryButtonProps) {
  const isPrimary = variant === 'primary'
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      className={`rounded-lg py-4 items-center justify-center ${
        isPrimary ? 'bg-primary' : 'border border-primary bg-transparent'
      } ${disabled || loading ? 'opacity-60' : ''}`}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? '#ffffff' : '#006685'} />
      ) : (
        <Text className={`font-manrope font-semibold text-base ${isPrimary ? 'text-white' : 'text-primary'}`}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  )
}
```

**Step 3: Créer `apps/mobile/components/ui/AppTextInput.tsx`**

```typescript
import { View, Text, TextInput } from 'react-native'
import type { TextInputProps } from 'react-native'

interface AppTextInputProps extends TextInputProps {
  label: string
  error?: string
}

export function AppTextInput({ label, error, ...props }: AppTextInputProps) {
  return (
    <View className="gap-1">
      <Text className="text-sm font-manrope font-medium text-on-surface-variant">{label}</Text>
      <TextInput
        className={`border rounded-lg px-4 py-3 text-base font-manrope text-on-surface bg-surface-container-low
          ${error ? 'border-error' : 'border-outline-variant focus:border-primary'}`}
        placeholderTextColor="#6f787e"
        {...props}
      />
      {error && <Text className="text-xs text-error font-manrope">{error}</Text>}
    </View>
  )
}
```

**Step 4: Créer `apps/mobile/components/ui/StepIndicator.tsx`**

```typescript
import { View } from 'react-native'

interface StepIndicatorProps {
  total: number
  current: number
}

export function StepIndicator({ total, current }: StepIndicatorProps) {
  return (
    <View className="flex-row gap-2 justify-center">
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          className={`h-2 rounded-full ${
            i === current ? 'bg-primary w-8' : 'bg-outline-variant w-2'
          }`}
        />
      ))}
    </View>
  )
}
```

**Step 5: Créer `apps/mobile/components/ui/DocumentUploader.tsx`**

```typescript
import { View, Text, TouchableOpacity } from 'react-native'
import * as DocumentPicker from 'expo-document-picker'

interface UploadedDoc {
  uri: string
  name: string
  document_type: 'diploma' | 'license' | 'id_card' | 'other'
}

interface DocumentUploaderProps {
  label: string
  documentType: UploadedDoc['document_type']
  value?: UploadedDoc
  onUpload: (doc: UploadedDoc) => void
}

export function DocumentUploader({ label, documentType, value, onUpload }: DocumentUploaderProps) {
  const handlePick = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    })
    if (!result.canceled && result.assets[0]) {
      onUpload({
        uri: result.assets[0].uri,
        name: result.assets[0].name,
        document_type: documentType,
      })
    }
  }

  return (
    <TouchableOpacity
      onPress={handlePick}
      className="border border-dashed border-outline-variant rounded-xl p-4 items-center gap-2"
    >
      <Text className="text-sm font-manrope font-medium text-on-surface-variant">{label}</Text>
      {value ? (
        <Text className="text-sm text-primary font-manrope">{value.name}</Text>
      ) : (
        <Text className="text-xs text-outline font-manrope">Appuyer pour sélectionner (PDF ou image)</Text>
      )}
    </TouchableOpacity>
  )
}
```

**Step 6: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

**Step 7: Commit**

```bash
git add apps/mobile/components/
git commit -m "feat(ui): add GlassCard, PrimaryButton, AppTextInput, StepIndicator, DocumentUploader"
```

---

## Task 11 : Écran Welcome

**Files:**
- Create: `apps/mobile/app/(auth)/welcome.tsx`

> Référence UI : `patient_onboarding_practitioner_mobile/screen.png`

**Step 1: Créer `apps/mobile/app/(auth)/welcome.tsx`**

```typescript
import { View, Text, Image, SafeAreaView } from 'react-native'
import { useRouter } from 'expo-router'
import { PrimaryButton } from '@/components/ui/PrimaryButton'

export default function WelcomeScreen() {
  const router = useRouter()

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-6 justify-between pb-8">
        {/* Logo */}
        <View className="items-center mt-16">
          <View className="flex-row items-center gap-3">
            <Text className="text-sky-500 text-4xl">⚕</Text>
            <View>
              <Text className="text-2xl font-black tracking-tight text-on-surface font-manrope">
                M-Santé
              </Text>
              <Text className="text-xs text-outline font-medium font-manrope">
                Health Sanctuary
              </Text>
            </View>
          </View>
        </View>

        {/* Tagline */}
        <View className="items-center gap-4">
          <Text className="text-3xl font-bold text-center text-on-surface font-manrope leading-tight">
            Votre santé mentale,{'\n'}notre priorité
          </Text>
          <Text className="text-base text-center text-on-surface-variant font-manrope">
            Connectez-vous à des praticiens de confiance au Sénégal et en Afrique francophone.
          </Text>
        </View>

        {/* Actions */}
        <View className="gap-4">
          <PrimaryButton
            label="Je suis patient"
            onPress={() => router.push('/(auth)/signup-patient')}
          />
          <PrimaryButton
            label="Je suis praticien"
            onPress={() => router.push('/(auth)/signup-practitioner')}
            variant="outline"
          />
          <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
            <Text className="text-center text-sm text-on-surface-variant font-manrope">
              Déjà un compte ?{' '}
              <Text className="text-primary font-semibold">Se connecter</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  )
}
```

(Corriger l'import manquant TouchableOpacity en haut.)

**Step 2: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add apps/mobile/app/(auth)/welcome.tsx
git commit -m "feat(auth): add Welcome screen"
```

---

## Task 12 : Écran Login

**Files:**
- Create: `apps/mobile/app/(auth)/login.tsx`

**Step 1: Créer `apps/mobile/app/(auth)/login.tsx`**

```typescript
import { useState } from 'react'
import { View, Text, TouchableOpacity, SafeAreaView, ScrollView, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { GlassCard } from '@/components/ui/GlassCard'
import { AppTextInput } from '@/components/ui/AppTextInput'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { authService } from '@/features/auth/services/authService'
import { loginSchema, type LoginFormData } from '@/features/auth/schemas/authSchemas'

export default function LoginScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const { control, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    setLoading(true)
    const result = await authService.signInWithEmail(data.email, data.password)
    setLoading(false)
    if (result.error) {
      Alert.alert('Erreur de connexion', result.error)
    }
    // Navigation gérée par le root layout via onAuthStateChange
  }

  const handleGoogle = async () => {
    setGoogleLoading(true)
    await authService.signInWithGoogle()
    setGoogleLoading(false)
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1 px-6" contentContainerClassName="pb-8">
        {/* Header */}
        <View className="mt-12 mb-8">
          <TouchableOpacity onPress={() => router.back()} className="mb-6">
            <Text className="text-primary font-manrope">← Retour</Text>
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-on-surface font-manrope">Connexion</Text>
          <Text className="text-sm text-on-surface-variant font-manrope mt-1">
            Bon retour sur M-Santé
          </Text>
        </View>

        <GlassCard className="gap-4">
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, value } }) => (
              <AppTextInput
                label="Email"
                value={value}
                onChangeText={onChange}
                keyboardType="email-address"
                autoCapitalize="none"
                error={errors.email?.message}
                placeholder="votre@email.com"
              />
            )}
          />
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, value } }) => (
              <AppTextInput
                label="Mot de passe"
                value={value}
                onChangeText={onChange}
                secureTextEntry
                error={errors.password?.message}
                placeholder="••••••••"
              />
            )}
          />
          <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')}>
            <Text className="text-right text-sm text-primary font-manrope">
              Mot de passe oublié ?
            </Text>
          </TouchableOpacity>
          <PrimaryButton label="Se connecter" onPress={handleSubmit(onSubmit)} loading={loading} />
        </GlassCard>

        {/* Séparateur */}
        <View className="flex-row items-center gap-4 my-6">
          <View className="flex-1 h-px bg-outline-variant" />
          <Text className="text-xs text-outline font-manrope">ou</Text>
          <View className="flex-1 h-px bg-outline-variant" />
        </View>

        {/* Google OAuth */}
        <PrimaryButton
          label="Continuer avec Google"
          onPress={handleGoogle}
          loading={googleLoading}
          variant="outline"
        />
      </ScrollView>
    </SafeAreaView>
  )
}
```

**Step 2: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add apps/mobile/app/(auth)/login.tsx
git commit -m "feat(auth): add Login screen with email/password + Google OAuth"
```

---

## Task 13 : Écrans Signup

**Files:**
- Create: `apps/mobile/app/(auth)/signup-patient.tsx`
- Create: `apps/mobile/app/(auth)/signup-practitioner.tsx`

**Step 1: Créer `apps/mobile/app/(auth)/signup-patient.tsx`**

```typescript
import { useState } from 'react'
import { View, Text, TouchableOpacity, SafeAreaView, ScrollView, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { GlassCard } from '@/components/ui/GlassCard'
import { AppTextInput } from '@/components/ui/AppTextInput'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { authService } from '@/features/auth/services/authService'
import { signupSchema, type SignupFormData } from '@/features/auth/schemas/authSchemas'

export default function SignupPatientScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const { control, handleSubmit, formState: { errors } } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  })

  const onSubmit = async (data: SignupFormData) => {
    setLoading(true)
    const result = await authService.signUpWithEmail(data.email, data.password, 'patient', data.full_name)
    setLoading(false)
    if (result.error) {
      Alert.alert('Erreur', result.error)
    }
    // Routing automatique via onAuthStateChange → onboarding/patient
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1 px-6" contentContainerClassName="pb-8">
        <View className="mt-12 mb-8">
          <TouchableOpacity onPress={() => router.back()} className="mb-6">
            <Text className="text-primary font-manrope">← Retour</Text>
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-on-surface font-manrope">Créer un compte patient</Text>
        </View>

        <GlassCard className="gap-4">
          <Controller control={control} name="full_name"
            render={({ field: { onChange, value } }) => (
              <AppTextInput label="Nom complet" value={value} onChangeText={onChange}
                error={errors.full_name?.message} placeholder="Prénom Nom" />
            )} />
          <Controller control={control} name="email"
            render={({ field: { onChange, value } }) => (
              <AppTextInput label="Email" value={value} onChangeText={onChange}
                keyboardType="email-address" autoCapitalize="none"
                error={errors.email?.message} placeholder="votre@email.com" />
            )} />
          <Controller control={control} name="password"
            render={({ field: { onChange, value } }) => (
              <AppTextInput label="Mot de passe" value={value} onChangeText={onChange}
                secureTextEntry error={errors.password?.message} placeholder="••••••••" />
            )} />
          <Controller control={control} name="confirmPassword"
            render={({ field: { onChange, value } }) => (
              <AppTextInput label="Confirmer le mot de passe" value={value} onChangeText={onChange}
                secureTextEntry error={errors.confirmPassword?.message} placeholder="••••••••" />
            )} />
          <PrimaryButton label="Créer mon compte" onPress={handleSubmit(onSubmit)} loading={loading} />
        </GlassCard>

        <TouchableOpacity onPress={() => router.push('/(auth)/login')} className="mt-4">
          <Text className="text-center text-sm text-on-surface-variant font-manrope">
            Déjà un compte ? <Text className="text-primary font-semibold">Se connecter</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}
```

**Step 2: Créer `apps/mobile/app/(auth)/signup-practitioner.tsx`**

Même structure que signup-patient, avec :
- Titre : "Créer un compte praticien"
- Appel : `authService.signUpWithEmail(... , 'practitioner', ...)`
- Champ supplémentaire : "Numéro de licence professionnelle" (stocké dans `full_name` metadata pour l'instant, collecté au vrai onboarding)

**Step 3: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add apps/mobile/app/(auth)/signup-patient.tsx apps/mobile/app/(auth)/signup-practitioner.tsx
git commit -m "feat(auth): add signup screens for patient and practitioner"
```

---

## Task 14 : Écran Forgot Password

**Files:**
- Create: `apps/mobile/app/(auth)/forgot-password.tsx`

**Step 1: Créer `apps/mobile/app/(auth)/forgot-password.tsx`**

```typescript
import { useState } from 'react'
import { View, Text, TouchableOpacity, SafeAreaView, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { GlassCard } from '@/components/ui/GlassCard'
import { AppTextInput } from '@/components/ui/AppTextInput'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { authService } from '@/features/auth/services/authService'
import { forgotPasswordSchema, type ForgotPasswordData } from '@/features/auth/schemas/authSchemas'

export default function ForgotPasswordScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const { control, handleSubmit, formState: { errors } } = useForm<ForgotPasswordData>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  const onSubmit = async (data: ForgotPasswordData) => {
    setLoading(true)
    await authService.resetPassword(data.email)
    setLoading(false)
    setSent(true)
  }

  return (
    <SafeAreaView className="flex-1 bg-background px-6">
      <View className="mt-12 mb-8">
        <TouchableOpacity onPress={() => router.back()} className="mb-6">
          <Text className="text-primary font-manrope">← Retour</Text>
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-on-surface font-manrope">Mot de passe oublié</Text>
      </View>

      {sent ? (
        <GlassCard className="items-center gap-4">
          <Text className="text-4xl">📩</Text>
          <Text className="text-base font-manrope text-center text-on-surface">
            Un lien de réinitialisation a été envoyé à votre email.
          </Text>
          <PrimaryButton label="Retour à la connexion" onPress={() => router.replace('/(auth)/login')} />
        </GlassCard>
      ) : (
        <GlassCard className="gap-4">
          <Controller control={control} name="email"
            render={({ field: { onChange, value } }) => (
              <AppTextInput label="Email" value={value} onChangeText={onChange}
                keyboardType="email-address" autoCapitalize="none"
                error={errors.email?.message} placeholder="votre@email.com" />
            )} />
          <PrimaryButton label="Envoyer le lien" onPress={handleSubmit(onSubmit)} loading={loading} />
        </GlassCard>
      )}
    </SafeAreaView>
  )
}
```

**Step 2: Typecheck + commit**

```bash
cd apps/mobile && npx tsc --noEmit
git add apps/mobile/app/(auth)/forgot-password.tsx
git commit -m "feat(auth): add ForgotPassword screen"
```

---

## Task 15 : Onboarding Patient

**Files:**
- Create: `apps/mobile/app/(onboarding)/patient.tsx`

> Référence UI : `patient_onboarding_practitioner_mobile/code.html`

**Step 1: Créer `apps/mobile/app/(onboarding)/patient.tsx`**

```typescript
import { useState } from 'react'
import { View, Text, SafeAreaView, ScrollView, Alert } from 'react-native'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { GlassCard } from '@/components/ui/GlassCard'
import { AppTextInput } from '@/components/ui/AppTextInput'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { authService } from '@/features/auth/services/authService'
import { patientOnboardingSchema, type PatientOnboardingData } from '@/features/auth/schemas/authSchemas'

const COUNTRIES = [
  { label: '🇸🇳 Sénégal', value: 'SN' },
  { label: '🇨🇮 Côte d\'Ivoire', value: 'CI' },
  { label: '🇨🇲 Cameroun', value: 'CM' },
  { label: '🇫🇷 France', value: 'FR' },
]

export default function PatientOnboardingScreen() {
  const [loading, setLoading] = useState(false)

  const { control, handleSubmit, formState: { errors } } = useForm<PatientOnboardingData>({
    resolver: zodResolver(patientOnboardingSchema),
    defaultValues: { country: 'SN', language: 'fr' },
  })

  const onSubmit = async (data: PatientOnboardingData) => {
    setLoading(true)
    try {
      await authService.completePatientOnboarding(data)
      // Routing automatique via authStore → /(patient)/home
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de sauvegarder le profil')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1 px-6" contentContainerClassName="pb-8">
        <View className="mt-12 mb-8">
          <Text className="text-xs font-bold text-primary font-manrope uppercase tracking-widest mb-2">
            Étape 1 sur 1
          </Text>
          <Text className="text-2xl font-bold text-on-surface font-manrope">
            Complétez votre profil
          </Text>
          <Text className="text-sm text-on-surface-variant font-manrope mt-1">
            Ces informations nous aident à personnaliser votre expérience.
          </Text>
        </View>

        <GlassCard className="gap-4">
          <Controller control={control} name="full_name"
            render={({ field: { onChange, value } }) => (
              <AppTextInput label="Nom complet" value={value} onChangeText={onChange}
                error={errors.full_name?.message} placeholder="Prénom Nom" />
            )} />
          <Controller control={control} name="phone"
            render={({ field: { onChange, value } }) => (
              <AppTextInput label="Téléphone" value={value} onChangeText={onChange}
                keyboardType="phone-pad" error={errors.phone?.message}
                placeholder="+221 77 000 00 00" />
            )} />
          <Controller control={control} name="date_of_birth"
            render={({ field: { onChange, value } }) => (
              <AppTextInput label="Date de naissance" value={value} onChangeText={onChange}
                error={errors.date_of_birth?.message} placeholder="AAAA-MM-JJ" />
            )} />

          {/* Country Picker simplifié */}
          <View className="gap-1">
            <Text className="text-sm font-manrope font-medium text-on-surface-variant">Pays</Text>
            <View className="flex-row flex-wrap gap-2">
              {COUNTRIES.map(c => (
                <Controller key={c.value} control={control} name="country"
                  render={({ field: { onChange, value } }) => (
                    <TouchableOpacity
                      onPress={() => onChange(c.value)}
                      className={`px-3 py-2 rounded-full border ${
                        value === c.value
                          ? 'bg-primary border-primary'
                          : 'border-outline-variant'
                      }`}
                    >
                      <Text className={`text-sm font-manrope ${value === c.value ? 'text-white' : 'text-on-surface'}`}>
                        {c.label}
                      </Text>
                    </TouchableOpacity>
                  )} />
              ))}
            </View>
          </View>

          <PrimaryButton
            label="Commencer mon parcours"
            onPress={handleSubmit(onSubmit)}
            loading={loading}
          />
        </GlassCard>
      </ScrollView>
    </SafeAreaView>
  )
}
```

(Ajouter l'import `TouchableOpacity` manquant.)

**Step 2: Typecheck + commit**

```bash
cd apps/mobile && npx tsc --noEmit
git add apps/mobile/app/(onboarding)/patient.tsx
git commit -m "feat(onboarding): add patient onboarding screen (5 fields)"
```

---

## Task 16 : Onboarding Praticien (stepper 3 étapes)

**Files:**
- Create: `apps/mobile/app/(onboarding)/practitioner.tsx`

> Référence UI : `practitioner_onboarding_verification/code.html`

**Step 1: Créer `apps/mobile/app/(onboarding)/practitioner.tsx`**

```typescript
import { useState } from 'react'
import { View, Text, SafeAreaView, ScrollView, Alert } from 'react-native'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { GlassCard } from '@/components/ui/GlassCard'
import { AppTextInput } from '@/components/ui/AppTextInput'
import { PrimaryButton } from '@/components/ui/PrimaryButton'
import { StepIndicator } from '@/components/ui/StepIndicator'
import { DocumentUploader } from '@/components/ui/DocumentUploader'
import { authService } from '@/features/auth/services/authService'
import { practitionerStep1Schema, type PractitionerStep1Data } from '@/features/auth/schemas/authSchemas'
import type { PractitionerOnboardingData } from '@/types/auth'

type UploadedDoc = { uri: string; name: string; document_type: 'diploma' | 'license' | 'id_card' | 'other' }

export default function PractitionerOnboardingScreen() {
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [documents, setDocuments] = useState<UploadedDoc[]>([])
  const [step1Data, setStep1Data] = useState<PractitionerStep1Data | null>(null)

  const { control, handleSubmit, formState: { errors } } = useForm<PractitionerStep1Data>({
    resolver: zodResolver(practitionerStep1Schema),
    defaultValues: { languages: ['fr'], session_currency: 'XOF', session_duration_min: 60 },
  })

  const handleStep1 = (data: PractitionerStep1Data) => {
    setStep1Data(data)
    setStep(1)
  }

  const handleStep2 = () => {
    if (documents.length === 0) {
      Alert.alert('Documents requis', 'Veuillez uploader au moins un document.')
      return
    }
    setStep(2)
  }

  const handleSubmit_ = async () => {
    if (!step1Data) return
    setLoading(true)
    try {
      const data: PractitionerOnboardingData = {
        ...step1Data,
        documents,
      }
      await authService.completePractitionerOnboarding(data)
    } catch {
      Alert.alert('Erreur', 'Impossible de soumettre le profil')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1 px-6" contentContainerClassName="pb-8">
        <View className="mt-12 mb-6">
          <Text className="text-2xl font-bold text-on-surface font-manrope mb-4">
            Profil praticien
          </Text>
          <StepIndicator total={3} current={step} />
        </View>

        {step === 0 && (
          <GlassCard className="gap-4">
            <Text className="text-base font-semibold text-on-surface font-manrope">
              Étape 1 — Informations professionnelles
            </Text>
            <Controller control={control} name="speciality"
              render={({ field: { onChange, value } }) => (
                <AppTextInput label="Spécialité" value={value} onChangeText={onChange}
                  error={errors.speciality?.message} placeholder="Ex: Psychologue clinicien" />
              )} />
            <Controller control={control} name="bio"
              render={({ field: { onChange, value } }) => (
                <AppTextInput label="Biographie" value={value} onChangeText={onChange}
                  multiline numberOfLines={4} error={errors.bio?.message}
                  placeholder="Décrivez votre expérience..." />
              )} />
            <Controller control={control} name="session_price"
              render={({ field: { onChange, value } }) => (
                <AppTextInput label="Tarif par session (XOF)" value={value?.toString()}
                  onChangeText={v => onChange(Number(v))} keyboardType="numeric"
                  error={errors.session_price?.message} placeholder="25000" />
              )} />
            <PrimaryButton label="Suivant →" onPress={handleSubmit(handleStep1)} />
          </GlassCard>
        )}

        {step === 1 && (
          <GlassCard className="gap-4">
            <Text className="text-base font-semibold text-on-surface font-manrope">
              Étape 2 — Documents de vérification
            </Text>
            <Text className="text-xs text-on-surface-variant font-manrope">
              Vos documents sont stockés de façon sécurisée et examinés sous 48h.
            </Text>
            <DocumentUploader label="Diplôme" documentType="diploma"
              value={documents.find(d => d.document_type === 'diploma')}
              onUpload={doc => setDocuments(prev => [...prev.filter(d => d.document_type !== 'diploma'), doc])} />
            <DocumentUploader label="Licence professionnelle" documentType="license"
              value={documents.find(d => d.document_type === 'license')}
              onUpload={doc => setDocuments(prev => [...prev.filter(d => d.document_type !== 'license'), doc])} />
            <DocumentUploader label="Pièce d'identité" documentType="id_card"
              value={documents.find(d => d.document_type === 'id_card')}
              onUpload={doc => setDocuments(prev => [...prev.filter(d => d.document_type !== 'id_card'), doc])} />
            <PrimaryButton label="Suivant →" onPress={handleStep2} />
          </GlassCard>
        )}

        {step === 2 && (
          <GlassCard className="gap-4 items-center">
            <Text className="text-4xl">📋</Text>
            <Text className="text-base font-semibold text-on-surface font-manrope text-center">
              Récapitulatif
            </Text>
            <Text className="text-sm text-on-surface-variant font-manrope text-center">
              Votre profil sera examiné sous 48h. En attendant, vous pouvez accéder à l'application en mode limité.
            </Text>
            <View className="w-full gap-2">
              <Text className="text-sm font-manrope text-on-surface">
                ✅ Spécialité : {step1Data?.speciality}
              </Text>
              <Text className="text-sm font-manrope text-on-surface">
                ✅ {documents.length} document(s) uploadé(s)
              </Text>
              <Text className="text-sm font-manrope text-on-surface">
                ✅ Tarif : {step1Data?.session_price} {step1Data?.session_currency}
              </Text>
            </View>
            <PrimaryButton
              label="Soumettre pour vérification"
              onPress={handleSubmit_}
              loading={loading}
            />
          </GlassCard>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
```

**Step 2: Typecheck + commit**

```bash
cd apps/mobile && npx tsc --noEmit
git add apps/mobile/app/(onboarding)/practitioner.tsx
git commit -m "feat(onboarding): add practitioner onboarding stepper (3 steps + document upload)"
```

---

## Task 17 : Vérification finale

**Step 1: Typecheck complet**

```bash
cd apps/mobile && npx tsc --noEmit
```
Expected: 0 erreurs

**Step 2: Tests complets**

```bash
cd apps/mobile && pnpm test -- --coverage
```
Expected: authStore (3 tests PASS), authService (2 tests PASS)

**Step 3: Lancer l'app en dev**

```bash
cd apps/mobile && npx expo start
```
Tester sur simulateur iOS/Android ou Expo Go :
- [ ] Welcome s'affiche sans être connecté
- [ ] Login fonctionne avec email/password
- [ ] Signup patient redirige vers onboarding patient
- [ ] Signup praticien redirige vers onboarding praticien (stepper)
- [ ] Onboarding patient complété → redirige vers `/(patient)/home`
- [ ] Onboarding praticien complété → redirige vers `/(practitioner)/home` avec badge "En attente"
- [ ] Google OAuth ouvre le navigateur

**Step 4: Commit final**

```bash
git add -A
git commit -m "feat(p0): complete auth + onboarding + RLS — patient, practitioner, Google OAuth"
```

---

## Récapitulatif des tâches

| # | Tâche | Tests |
|---|-------|-------|
| 1 | Scaffolding monorepo Expo | typecheck |
| 2 | Migrations Supabase + RLS + trigger | supabase db reset |
| 3 | Types TypeScript | typecheck |
| 4 | Client Supabase + SecureStore | typecheck |
| 5 | Zod schemas | typecheck |
| 6 | Zustand authStore | 3 unit tests |
| 7 | AuthService | 2 unit tests |
| 8 | Hooks useAuth + usePractitionerAccess | typecheck |
| 9 | Root layout + route guards | typecheck |
| 10 | Composants UI (5 composants) | typecheck |
| 11 | Écran Welcome | manuel |
| 12 | Écran Login | manuel |
| 13 | Écrans Signup | manuel |
| 14 | Écran Forgot Password | manuel |
| 15 | Onboarding Patient | manuel |
| 16 | Onboarding Praticien (stepper) | manuel |
| 17 | Vérification finale | full |
