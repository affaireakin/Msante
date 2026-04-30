# Design — P0 Auth + Onboarding + RLS Supabase
> M-Santé Super App · 2026-04-30

## Contexte

Module fondateur de la Super App. Aucune autre feature ne peut être livrée sans lui. Couvre l'authentification complète, l'onboarding différencié patient/praticien, et la sécurité base de données (RLS).

---

## Décisions de design

| Sujet | Décision |
|-------|----------|
| Auth methods | Email + password + Google OAuth |
| OTP / WhatsApp | Via moteur de workflow interne M-Santé (WhatsAppBusinessAdapter) |
| Architecture mobile | Supabase Auth natif + Zustand authStore + Expo Router guards |
| Validation praticien | Manuelle (admin) + accès provisoire immédiat |
| Onboarding patient | Standard — 5 champs (nom, téléphone, pays, DDN, langue) |
| Source de vérité UI | Maquettes HTML dans les dossiers du projet |

---

## Structure de fichiers

```
apps/mobile/
├── app/
│   ├── _layout.tsx                     # Root layout — onAuthStateChange + routing
│   ├── (auth)/
│   │   ├── _layout.tsx                 # Redirect si déjà connecté
│   │   ├── welcome.tsx                 # Splash + choix rôle
│   │   ├── login.tsx                   # Email/password + Google OAuth
│   │   ├── signup.tsx                  # Choix rôle
│   │   ├── signup-patient.tsx
│   │   ├── signup-practitioner.tsx
│   │   └── forgot-password.tsx
│   ├── (onboarding)/
│   │   ├── patient.tsx                 # 5 champs + CTA
│   │   └── practitioner.tsx            # Stepper 3 étapes
│   ├── (patient)/
│   │   └── _layout.tsx                 # Guard : role=patient + onboarding_completed
│   └── (practitioner)/
│       └── _layout.tsx                 # Guard : role=practitioner (provisoire OK)
│
├── features/auth/
│   ├── hooks/useAuth.ts                # useSession, useAuthRedirect
│   ├── services/authService.ts         # signIn, signUp, googleOAuth, resetPassword
│   ├── store/authStore.ts              # Zustand store
│   └── schemas/authSchemas.ts          # Zod schemas
│
└── services/supabase.ts                # Client Supabase singleton
```

---

## Routing Logic

```
Non connecté                          → /(auth)/welcome
Connecté + onboarding incomplet       → /(onboarding)/patient ou practitioner
Connecté + patient complet            → /(patient)/home
Connecté + praticien (pending)        → /(practitioner)/home [accès limité]
Connecté + praticien (approved)       → /(practitioner)/home [accès complet]
```

---

## Schéma base de données

### Tables

- `public.users` — extension auth.users (role, full_name, phone, country, language, date_of_birth, onboarding_completed)
- `public.practitioners` — profil praticien (speciality, bio, session_price, verification_status)
- `public.verification_documents` — upload documents praticien

### Trigger Supabase

`handle_new_user()` — crée automatiquement `public.users` après INSERT sur `auth.users`, lit `role` et `full_name` depuis `raw_user_meta_data`.

### RLS

| Table | Politique |
|-------|-----------|
| `users` | Lecture/écriture sur son propre row uniquement. Admin : accès complet. |
| `practitioners` | Lecture publique si `is_verified=true` ou propriétaire. Écriture : propriétaire uniquement. |
| `verification_documents` | Praticien voit les siens. Admin voit tout. |

---

## Zustand AuthStore

```typescript
interface AuthState {
  user: User | null
  profile: UserProfile | null
  practitioner: Practitioner | null
  isLoading: boolean
  isAuthenticated: boolean
  setSession: (user: User | null) => void
  setProfile: (profile: UserProfile | null) => void
  signOut: () => Promise<void>
}
```

## AuthService — opérations P0

```typescript
signInWithEmail(email, password): Promise<AuthResult>
signUpWithEmail(email, password, role, fullName): Promise<AuthResult>
signInWithGoogle(): Promise<AuthResult>
resetPassword(email): Promise<void>
completePatientOnboarding(data: PatientOnboardingData): Promise<void>
completePractitionerOnboarding(data: PractitionerOnboardingData): Promise<void>
```

## Hook accès provisoire praticien

```typescript
function usePractitionerAccess() {
  return {
    canAcceptPayments: practitioner?.verification_status === 'approved',
    canStartConsultation: practitioner?.verification_status === 'approved',
    isPending: practitioner?.verification_status === 'pending',
  }
}
```

---

## Écrans (7 écrans)

| Écran | Route | Notes |
|-------|-------|-------|
| Welcome | `/(auth)/welcome` | Logo M-Santé + choix patient/praticien |
| Login | `/(auth)/login` | Email + password + Google OAuth |
| Signup Patient | `/(auth)/signup-patient` | Email + password + confirmation |
| Signup Praticien | `/(auth)/signup-practitioner` | + numéro de licence visible |
| Onboarding Patient | `/(onboarding)/patient` | 5 champs, 1 écran |
| Onboarding Praticien | `/(onboarding)/practitioner` | Stepper 3 étapes + upload docs |
| Forgot Password | `/(auth)/forgot-password` | Email → confirmation envoi |

## Composants partagés

- `<GlassCard />` — wrapper glassmorphism
- `<PrimaryButton />` — bg-primary, rounded-lg
- `<TextInput />` — border outline-variant, focus ring primary
- `<StepIndicator />` — progression onboarding praticien
- `<DocumentUploader />` — picker + preview + Supabase Storage

---

## Workflow WhatsApp post-signup

```
Trigger  : user.created (webhook Supabase → Edge Function)
Workflow : welcome-patient.json / welcome-practitioner.json
Action   : WhatsAppBusinessAdapter → message de bienvenue
```

---

## Source de vérité UI

Les maquettes HTML dans les dossiers du projet sont la référence absolue pour chaque écran. L'implémentation doit coller aux designs existants :
- `patient_onboarding_practitioner_mobile/`
- `patient_onboarding_practitioner_desktop/`
- `practitioner_onboarding_verification/`
- `security_privacy_mobile/`
