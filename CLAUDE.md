# CLAUDE.md — M-SANTÉ SUPER APP HEALTHTECH
> Claude Code Master Configuration · Version 2.0 · AUTOMATISE © 2026
> Design system extrait des sources réelles — 18 écrans documentés

---

## 🧭 VISION PROJET

**M-Santé** est une Super App HealthTech africaine nouvelle génération, fondée sur la santé mentale et l'accompagnement psychologique au Sénégal, avec extension vers l'Afrique francophone et l'Europe.

Ce n'est **pas** un simple agenda de rendez-vous. C'est une infrastructure santé numérique complète :
- Connexion patient ↔ praticien de confiance
- Outils bien-être embarqués (mood, journal, méditation)
- Téléconsultation intégrée
- Workflow automation santé
- Paiements africains natifs (Wave, Orange Money)

### Ambition
> Headspace × Doctolib × n8n × Stripe — adapté à l'Afrique, mobile-first, praticable hors-ligne, cliniquement responsable.

---

## 🏗 ARCHITECTURE GLOBALE

```
m-sante/
├── apps/
│   ├── mobile/          # React Native + Expo Router
│   └── web/             # Next.js 15 (Admin + Praticien + Workflows)
├── packages/
│   ├── backend/         # Supabase Edge Functions + API
│   ├── ui/              # Design system partagé
│   ├── workflows/       # Moteur workflow interne
│   ├── payments/        # Abstraction paiements multi-providers
│   ├── notifications/   # Système multi-canaux
│   └── ai/              # Assistants IA + nodes workflow
├── supabase/
│   ├── migrations/      # Schéma PostgreSQL complet
│   ├── functions/       # Edge Functions
│   └── seed/            # Données de test
├── .github/
│   └── workflows/       # CI/CD GitHub Actions
└── CLAUDE.md
```

---

## 📱 STACK TECHNIQUE OBLIGATOIRE

### Mobile — `apps/mobile/`

| Librairie | Usage |
|-----------|-------|
| React Native + Expo SDK 52 | Framework principal |
| Expo Router v3 | Navigation file-based |
| TypeScript strict | Typage obligatoire |
| NativeWind v4 / Tailwind | Styling |
| Zustand | State management global |
| TanStack Query v5 | Data fetching / cache |
| React Hook Form + Zod | Formulaires + validation |
| Reanimated 3 | Animations fluides |
| Expo Secure Store | Secrets locaux (tokens) |
| Expo Notifications | Push notifications |
| Expo AV | Audio (méditation, respiration) |

**Architecture mobile :** Clean Architecture + Feature-based folders.

```
apps/mobile/
├── app/                    # Expo Router pages
│   ├── (auth)/             # Onboarding, login, signup
│   ├── (patient)/          # Espace patient
│   ├── (practitioner)/     # Espace praticien
│   └── _layout.tsx
├── features/
│   ├── auth/
│   ├── booking/
│   ├── mental-health/      # Mood, journal, méditation
│   ├── consultation/       # Téléconsultation
│   ├── payments/
│   └── notifications/
├── components/
│   ├── ui/                 # Design system atoms
│   └── shared/             # Composants partagés
├── services/               # Appels API / Supabase
├── store/                  # Zustand stores
├── hooks/                  # Custom hooks
├── types/                  # TypeScript interfaces globales
└── utils/                  # Helpers, formatters
```

---

### Web Admin & Portal — `apps/web/`

| Librairie | Usage |
|-----------|-------|
| Next.js 15 (App Router) | Framework web |
| TypeScript strict | Typage obligatoire |
| TailwindCSS v3 | Styling |
| Shadcn UI | Composants admin |
| TanStack Query v5 | Data fetching |
| Zustand | State global |
| React Flow | Workflow builder canvas |
| DnD Kit | Drag & drop nodes |
| Recharts | Analytics dashboards |

```
apps/web/
├── app/
│   ├── admin/              # Dashboard admin
│   ├── practitioner/       # Portal praticien
│   ├── workflows/          # Workflow builder
│   └── analytics/          # Analytics avancés
├── components/
│   ├── workflow/           # Nodes, canvas, minimap
│   ├── admin/
│   └── charts/
└── lib/
```

---

### Backend — `packages/backend/`

| Service | Usage |
|---------|-------|
| Supabase | BaaS principal |
| PostgreSQL | Base de données |
| Supabase Edge Functions | Serverless API (Deno) |
| Supabase Realtime | WebSockets temps réel |
| Supabase Storage | Fichiers (docs, avatars) |
| Row Level Security (RLS) | Sécurité données |
| BullMQ (ou Trigger.dev) | Queue system workflows |

---

## 🗄 SCHÉMA BASE DE DONNÉES

### Tables principales

```sql
-- Utilisateurs (extension auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  role TEXT NOT NULL CHECK (role IN ('patient', 'practitioner', 'admin')),
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  country TEXT DEFAULT 'SN',
  language TEXT DEFAULT 'fr',
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profils praticiens
CREATE TABLE public.practitioners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id),
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

-- Documents de vérification
CREATE TABLE public.verification_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id UUID NOT NULL REFERENCES public.practitioners(id),
  document_type TEXT NOT NULL
    CHECK (document_type IN ('diploma', 'license', 'id_card', 'other')),
  file_url TEXT NOT NULL,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES public.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disponibilités praticiens
CREATE TABLE public.availabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id UUID NOT NULL REFERENCES public.practitioners(id),
  day_of_week INT CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT TRUE
);

-- Rendez-vous
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.users(id),
  practitioner_id UUID NOT NULL REFERENCES public.practitioners(id),
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_min INT DEFAULT 60,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
  type TEXT DEFAULT 'video'
    CHECK (type IN ('video', 'audio', 'chat')),
  payment_id UUID,
  notes TEXT,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Paiements
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES public.appointments(id),
  patient_id UUID NOT NULL REFERENCES public.users(id),
  practitioner_id UUID NOT NULL REFERENCES public.practitioners(id),
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT DEFAULT 'XOF',
  provider TEXT NOT NULL
    CHECK (provider IN ('wave', 'orange_money', 'stripe', 'card')),
  provider_ref TEXT,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
  retry_count INT DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Consultations (session active)
CREATE TABLE public.consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES public.appointments(id),
  room_url TEXT,
  room_token TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_actual_min INT,
  chat_history JSONB DEFAULT '[]',
  shared_files JSONB DEFAULT '[]',
  status TEXT DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'active', 'ended'))
);

-- Mood tracking
CREATE TABLE public.mood_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.users(id),
  score INT NOT NULL CHECK (score BETWEEN 1 AND 10),
  emotions TEXT[] DEFAULT '{}',
  note TEXT,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Journal émotionnel
CREATE TABLE public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.users(id),
  title TEXT,
  content TEXT NOT NULL,
  mood_score INT CHECK (mood_score BETWEEN 1 AND 10),
  tags TEXT[] DEFAULT '{}',
  is_private BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workflows
CREATE TABLE public.workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL,
  trigger_config JSONB DEFAULT '{}',
  nodes JSONB NOT NULL DEFAULT '[]',
  edges JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Exécutions de workflows
CREATE TABLE public.workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflows(id),
  trigger_data JSONB DEFAULT '{}',
  status TEXT DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  error_message TEXT
);

-- Logs d'exécution nœud par nœud
CREATE TABLE public.workflow_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.workflow_runs(id),
  node_id TEXT NOT NULL,
  node_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'success', 'error', 'skipped')),
  input_data JSONB DEFAULT '{}',
  output_data JSONB DEFAULT '{}',
  error_details JSONB,
  duration_ms INT,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  channel TEXT NOT NULL CHECK (channel IN ('push', 'email', 'sms', 'whatsapp')),
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'read')),
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logs (immuable)
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Index essentiels

```sql
CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_appointments_practitioner ON appointments(practitioner_id);
CREATE INDEX idx_appointments_scheduled_at ON appointments(scheduled_at);
CREATE INDEX idx_mood_entries_patient_date ON mood_entries(patient_id, entry_date);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_workflow_runs_workflow ON workflow_runs(workflow_id);
CREATE INDEX idx_workflow_logs_run ON workflow_logs(run_id);
CREATE INDEX idx_notifications_user_status ON notifications(user_id, status);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id, created_at);
```

---

## 🔒 SÉCURITÉ & RLS

### Règles globales RLS

```sql
-- Patients ne voient que leurs propres données
ALTER TABLE mood_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "patients_own_mood" ON mood_entries
  FOR ALL USING (auth.uid() = patient_id);

-- Praticiens ne voient que leurs propres rendez-vous
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "practitioner_own_appointments" ON appointments
  FOR SELECT USING (
    auth.uid() = patient_id OR
    auth.uid() = (SELECT user_id FROM practitioners WHERE id = practitioner_id)
  );

-- Admins voient tout
CREATE POLICY "admins_full_access" ON appointments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );
```

### RBAC Roles

| Role | Permissions |
|------|-------------|
| `patient` | Lire/écrire ses données, réserver, payer, mood/journal |
| `practitioner` | Gérer son agenda, voir ses patients, consulter |
| `admin` | Accès complet, validation, monitoring |
| `super_admin` | Configuration système, workflows globaux |

---

## 🔄 MODULE WORKFLOW INTERNE

### Architecture

Le workflow engine est **inspiré de n8n** mais intégré nativement à M-Santé.

```
packages/workflows/
├── engine/
│   ├── WorkflowEngine.ts       # Orchestrateur principal
│   ├── TriggerRegistry.ts      # Registre des triggers
│   ├── NodeRegistry.ts         # Registre des nodes
│   └── ExecutionQueue.ts       # BullMQ queue
├── nodes/
│   ├── triggers/
│   │   ├── AppointmentTrigger.ts
│   │   ├── PaymentTrigger.ts
│   │   ├── MoodTrigger.ts
│   │   ├── ScheduleTrigger.ts  # Cron
│   │   └── WebhookTrigger.ts
│   ├── actions/
│   │   ├── SendEmailNode.ts
│   │   ├── SendSMSNode.ts
│   │   ├── SendWhatsAppNode.ts
│   │   ├── SendPushNode.ts
│   │   ├── CreateAppointmentNode.ts
│   │   ├── UpdateRecordNode.ts
│   │   ├── APICallNode.ts
│   │   └── DelayNode.ts
│   ├── ai/
│   │   ├── AIAnalysisNode.ts   # Analyse émotionnelle
│   │   ├── AISummaryNode.ts    # Résumé consultation
│   │   ├── AIRecommendNode.ts  # Recommandation contenu
│   │   └── AINotifyGenNode.ts  # Génération message
│   └── logic/
│       ├── ConditionNode.ts
│       ├── SplitNode.ts
│       └── MergeNode.ts
└── templates/
    ├── appointment-reminder.json
    ├── mood-alert.json
    ├── payment-failed.json
    └── welcome-patient.json
```

### Triggers disponibles

| Trigger | Événement | Payload |
|---------|-----------|---------|
| `appointment.booked` | RDV réservé | `{appointmentId, patientId, practitionerId, scheduledAt}` |
| `appointment.cancelled` | RDV annulé | `{appointmentId, reason}` |
| `payment.failed` | Paiement échoué | `{paymentId, amount, provider, retryCount}` |
| `payment.completed` | Paiement réussi | `{paymentId, amount}` |
| `mood.low_streak` | Humeur basse N jours | `{patientId, scores[], streak}` |
| `schedule.cron` | Planificateur | `{cron: "0 9 * * *"}` |
| `webhook.external` | API externe | `{source, data}` |

### Workflows templates pré-configurés

**1. Rappel rendez-vous automatique**
```json
{
  "name": "Rappel RDV 24h avant",
  "trigger": "schedule.cron",
  "nodes": [
    { "type": "query_upcoming_appointments", "delay": "-24h" },
    { "type": "send_push", "template": "appointment_reminder" },
    { "type": "send_sms", "template": "sms_reminder" }
  ]
}
```

**2. Alerte mood bas**
```json
{
  "name": "Alerte bien-être patient",
  "trigger": "mood.low_streak",
  "condition": "streak >= 3 AND avg_score < 4",
  "nodes": [
    { "type": "ai_analysis", "model": "emotional_support" },
    { "type": "send_push", "template": "wellness_check" },
    { "type": "recommend_appointment" }
  ]
}
```

**3. Récupération paiement échoué**
```json
{
  "name": "Retry paiement échoué",
  "trigger": "payment.failed",
  "condition": "retryCount < 3",
  "nodes": [
    { "type": "delay", "duration": "2h" },
    { "type": "send_push", "template": "payment_retry" },
    { "type": "retry_payment" }
  ]
}
```

---

## 💳 PAIEMENTS AFRICAINS

### Architecture modulaire

```typescript
// packages/payments/PaymentProvider.ts
interface PaymentProvider {
  name: string;
  initiate(amount: number, currency: string, metadata: PaymentMetadata): Promise<PaymentIntent>;
  verify(reference: string): Promise<PaymentStatus>;
  refund(paymentId: string, amount?: number): Promise<RefundResult>;
  webhook(payload: unknown): Promise<WebhookEvent>;
}

// Providers
class WaveProvider implements PaymentProvider { ... }
class OrangeMoneyProvider implements PaymentProvider { ... }
class StripeProvider implements PaymentProvider { ... }

// Factory
class PaymentFactory {
  static create(provider: 'wave' | 'orange_money' | 'stripe'): PaymentProvider
}
```

### Flux de paiement

```
Patient → Sélectionne provider → PaymentFactory.create()
→ Initiate() → Redirect / USSD → Webhook reçu
→ verify() → Mise à jour DB → Confirmer RDV → Notification
```

### Retry & Reconciliation

```typescript
// Retry strategy exponentielle
const retryDelays = [2 * 60, 30 * 60, 4 * 60 * 60]; // 2min, 30min, 4h

// Job de réconciliation quotidien
schedule("0 2 * * *", async () => {
  const pendingPayments = await getPendingPayments({ olderThan: "1h" });
  for (const payment of pendingPayments) {
    await reconcileWithProvider(payment);
  }
});
```

---

## 🧠 MODULE SANTÉ MENTALE

### ⚠️ Limites cliniques OBLIGATOIRES

```
❌ JAMAIS : Diagnostic médical autonome par IA
❌ JAMAIS : Promesses de guérison ou de traitement
❌ JAMAIS : Remplacement d'un professionnel de santé
✅ TOUJOURS : Redirection vers praticien humain si score < 3
✅ TOUJOURS : Mention "cet outil ne remplace pas un professionnel"
✅ TOUJOURS : Ligne d'urgence visible si détresse sévère
```

### Features

| Feature | Description |
|---------|-------------|
| Mood Tracker | Score 1-10 + émotions + note quotidienne |
| Journal émotionnel | Entrées privées chiffrées, tags, historique |
| Respiration guidée | Animations box breathing (4-7-8, cohérence cardiaque) |
| Méditation guidée | Audio + timer, séries thématiques |
| Contenus bien-être | Articles, exercices, vidéos validés par praticiens |
| Check-in hebdo | Questionnaire PHQ-2 simplifié (non clinique) |

### Assistant émotionnel IA

```typescript
// packages/ai/EmotionalAssistant.ts
// ⚠️ COMPANION uniquement, pas assistant clinique
const systemPrompt = `
Tu es Ami, l'assistant bien-être de M-Santé.
Tu n'es PAS un médecin ou thérapeute.
Tu offres un espace d'écoute bienveillant.
Si l'utilisateur exprime une détresse sévère ou des pensées suicidaires,
dirige-le IMMÉDIATEMENT vers un praticien ou SOS Amitié (+221 33 823 8020).
Ne diagnostique JAMAIS. Ne prescris JAMAIS.
`;
```

---

## 🎥 TÉLÉCONSULTATION

### Stack

```
Daily.co API → Room création → Token patient + token praticien
→ React Native Daily SDK (mobile)
→ daily-js (web admin)
→ Fallback : Twilio Video si Daily indisponible
```

### Session flow

```
1. RDV confirmé + payé → Create Daily.co room (scheduled)
2. 15min avant : push notification "Votre consultation démarre bientôt"
3. Patient rejoint → Salle d'attente UI
4. Praticien rejoint → Session démarre, timer lancé
5. Fin session → Auto-save chat, fichiers → Bilan généré
6. Post-session → Notation, rebooking proposé
```

### Consultation table features

- Vidéo HD + audio
- Chat in-session
- Partage ordonnance PDF
- Notes praticien (privées)
- Enregistrement optionnel (consentement explicite)

---

## 🎨 DESIGN SYSTEM RÉEL
> Extrait directement des fichiers source du Drive M-Santé — source de vérité absolue

### Stack UI

```
Font        : Manrope (Google Fonts) — UNIQUEMENT cette police, tous weights 400→800
Icons       : Material Symbols Outlined (Google)
CSS         : TailwindCSS avec config Material Design 3 custom
Style       : Glassmorphism premium + fond bleu très doux
```

### Logo officiel

```html
<!-- Logo M-Santé — reproduire EXACTEMENT -->
<span class="material-symbols-outlined text-sky-500 text-3xl">medical_services</span>
<div>
  <h1 class="text-2xl font-black tracking-tighter text-slate-900">M-Santé</h1>
  <p class="text-xs text-slate-500 font-medium">Health Sanctuary</p>
  <!-- Variantes sous-titre selon contexte :
       "Clinical Portal"      → espace praticien
       "Admin Console"        → dashboard admin
       "Health Sanctuary"     → espace patient/wellness
       "Medical Sanctuary"    → admin avancé          -->
</div>
```

### Palette de couleurs exacte (Material Design 3)

```javascript
// tailwind.config — couleurs EXACTES extraites du code source
colors: {
  // Primaire — Bleu médical
  "primary":                    "#006685",
  "primary-container":          "#82d8ff",  // fond bleu pâle
  "primary-fixed":              "#bee9ff",
  "primary-fixed-dim":          "#7bd1f8",
  "on-primary":                 "#ffffff",
  "on-primary-container":       "#005e7a",
  "on-primary-fixed":           "#001f2a",
  "on-primary-fixed-variant":   "#004d65",
  "inverse-primary":            "#7bd1f8",
  "surface-tint":               "#006685",

  // Secondaire — Or/Ambre africain
  "secondary":                  "#705d00",
  "secondary-container":        "#ffde5c",  // jaune or vif
  "secondary-fixed":            "#ffe170",
  "secondary-fixed-dim":        "#e4c546",
  "on-secondary":               "#ffffff",
  "on-secondary-container":     "#756100",
  "on-secondary-fixed":         "#221b00",
  "on-secondary-fixed-variant": "#544600",

  // Tertiaire — Gris neutre
  "tertiary":                   "#5c5f61",
  "tertiary-container":         "#cbcdcf",
  "tertiary-fixed":             "#e0e3e5",
  "tertiary-fixed-dim":         "#c4c7c9",
  "on-tertiary":                "#ffffff",
  "on-tertiary-container":      "#545759",
  "on-tertiary-fixed":          "#191c1e",
  "on-tertiary-fixed-variant":  "#444749",

  // Surface — Fond bleuté très doux
  "background":                 "#f8f9ff",
  "surface":                    "#f8f9ff",
  "surface-bright":             "#f8f9ff",
  "surface-dim":                "#cbdbf5",
  "surface-variant":            "#d3e4fe",
  "surface-container-lowest":   "#ffffff",
  "surface-container-low":      "#eff4ff",
  "surface-container":          "#e5eeff",
  "surface-container-high":     "#dce9ff",
  "surface-container-highest":  "#d3e4fe",

  // On-Surface — Textes
  "on-surface":                 "#0b1c30",  // navy quasi-noir
  "on-surface-variant":         "#3f484d",
  "on-background":              "#0b1c30",

  // Inverse
  "inverse-surface":            "#213145",
  "inverse-on-surface":         "#eaf1ff",

  // Outline / Borders
  "outline":                    "#6f787e",
  "outline-variant":            "#bec8ce",

  // Error
  "error":                      "#ba1a1a",
  "error-container":            "#ffdad6",
  "on-error":                   "#ffffff",
  "on-error-container":         "#930009",
}
```

### Typography exacte

```javascript
fontFamily: {
  "body-base":    ["Manrope"],
  "body-sm":      ["Manrope"],
  "label-caps":   ["Manrope"],
  "headline-md":  ["Manrope"],
  "display-lg":   ["Manrope"],
}

fontSize: {
  "body-base":   ["16px", { lineHeight: "1.6",  fontWeight: "400" }],
  "body-sm":     ["14px", { lineHeight: "1.5",  fontWeight: "400" }],
  "label-caps":  ["12px", { lineHeight: "1.2",  fontWeight: "700", letterSpacing: "0.05em" }],
  "headline-md": ["24px", { lineHeight: "1.3",  fontWeight: "600", letterSpacing: "-0.01em" }],
  "display-lg":  ["48px", { lineHeight: "1.1",  fontWeight: "700", letterSpacing: "-0.02em" }],
}
```

### Border Radius

```javascript
borderRadius: {
  DEFAULT: "0.25rem",   // 4px  — petits éléments
  lg:      "0.5rem",    // 8px  — boutons, inputs
  xl:      "0.75rem",   // 12px — cards
  full:    "9999px",    // pills, avatars
}
```

### Spacing system

```javascript
spacing: {
  unit:           "8px",
  "margin-page":  "24px",
  gutter:         "16px",
  "card-padding": "20px",
  "stack-gap":    "12px",
}
```

### Glassmorphism — Classes CSS globales

```css
/* À définir dans globals.css */
.glass-card {
  background-color: rgba(255, 255, 255, 0.60);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.80);
  box-shadow: 0 10px 30px -10px rgba(0, 102, 133, 0.05);
}

.inner-glow {
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.5);
}
```

### Navigation sidebar (Web Admin)

```
Position     : fixed left, w-64, h-screen
Background   : bg-white/70 backdrop-blur-xl
Border       : border-r border-slate-200/50
Shadow       : shadow-[20px_0_40px_rgba(130,216,255,0.05)]
Font         : font-manrope antialiased tracking-tight

Item actif   : bg-sky-50 text-sky-600 font-semibold
               border-r-4 border-sky-500
Item hover   : hover:translate-x-1 hover:bg-slate-50/50
Transition   : transition-all duration-300 ease-in-out

Top bar      : fixed top-0, h-16, bg-white/40, backdrop-blur-lg
               border-b border-white/10 z-40
```

### Bottom nav (Mobile)

```
Onglets patient : HOME · ASSISTANT · ACTIVITIES · PROVIDERS · SUPPORT
Onglets praticien : Schedule · Patients · Inbox · Profile
```

### Couleurs sémantiques pour le code

```typescript
// À utiliser dans les composants
export const colors = {
  primary:    '#006685',
  secondary:  '#705d00',
  gold:       '#ffde5c',
  background: '#f8f9ff',
  surface:    '#ffffff',
  textPrimary:'#0b1c30',
  textMuted:  '#6f787e',
  success:    '#1d7a3a',
  error:      '#ba1a1a',
  warning:    '#e4c546',
} as const
```

### Composants clés

| Composant | Description |
|-----------|-------------|
| `<GlassCard />` | `glass-card inner-glow rounded-xl p-card-padding` |
| `<KPICard />` | Glass card avec icône Material + badge trend |
| `<PractitionerCard />` | Avatar initiales + nom + spécialité + badge disponibilité |
| `<MoodSlider />` | Score 1-10 avec gradient couleur émotionnel |
| `<WorkflowCanvas />` | React Flow sur fond `surface-container` |
| `<PaymentSheet />` | Bottom sheet Wave/OM/CB avec sélecteur |
| `<AppointmentTimer />` | Compte à rebours session vidéo |
| `<BreathingRing />` | Cercle animé respiration guidée |
| `<VoiceWave />` | Visualisation audio session IA |

---

## 🔔 SYSTÈME DE NOTIFICATIONS

### Architecture event-driven

```typescript
// packages/notifications/NotificationService.ts
class NotificationService {
  async send(event: NotificationEvent): Promise<void> {
    const channels = this.resolveChannels(event.user, event.type);
    await Promise.allSettled(
      channels.map(ch => this.adapters[ch].send(event))
    );
  }
}

// Adapters
class ExpoNotificationAdapter { ... }   // Push mobile
class ResendEmailAdapter { ... }         // Email transactionnel
class TwilioSMSAdapter { ... }          // SMS
class WhatsAppBusinessAdapter { ... }   // WhatsApp API
```

### Templates

```
appointment_reminder    → Push + SMS 24h avant
appointment_confirm     → Push + Email immédiat
payment_success         → Push + Email
payment_failed          → Push + SMS
mood_check_in           → Push quotidien (configurable)
wellness_tip            → Push hebdo
practitioner_approved   → Push + Email
consultation_starting   → Push 15min avant
```

---

## 📊 ANALYTICS

### KPIs par dashboard

**Admin Dashboard**
- MAU / DAU (Mobile Active Users)
- Taux de complétion onboarding
- Revenus par provider paiement
- Taux de no-show RDV
- Praticiens en attente de validation

**Practitioner Dashboard**
- Revenus mensuels
- Taux d'occupation agenda (%)
- Note moyenne patients
- Taux de rebooking

**Mental Health KPIs (anonymisés)**
- Score mood moyen plateforme
- Engagement journal (entrées/semaine)
- Sessions méditation complétées
- Taux de conversion mood-alert → RDV

**Workflow KPIs**
- Workflows actifs / total
- Taux de succès exécution
- Temps moyen exécution
- Erreurs par type de node

---

## 🛡 SÉCURITÉ

### Checklist obligatoire

```
✅ RLS activé sur toutes les tables
✅ JWT validation sur toutes les Edge Functions
✅ Rate limiting : 100 req/min par IP
✅ RBAC vérifié côté serveur (jamais côté client seul)
✅ Données santé chiffrées au repos (Supabase Vault)
✅ Logs d'audit pour toute action sensible
✅ CORS configuré (domaines whitelist uniquement)
✅ Secrets via Supabase Vault / env variables (jamais en dur)
✅ Backups automatiques quotidiens (30 jours de rétention)
✅ HTTPS obligatoire (TLS 1.3)
✅ Content Security Policy (CSP) headers
✅ Sanitisation inputs (XSS, SQL injection)
```

### Données sensibles

Les données médicales et émotionnelles (mood, journal) sont :
1. Chiffrées en base (Supabase Vault)
2. Accessibles uniquement par le patient concerné (RLS strict)
3. Jamais envoyées à des tiers sans consentement explicite
4. Auditées à chaque accès

---

## 🚀 DEVOPS

### CI/CD GitHub Actions

```yaml
# .github/workflows/main.yml
on: [push, pull_request]
jobs:
  test:
    - TypeScript typecheck (tsc --noEmit)
    - ESLint strict
    - Unit tests (Jest / Vitest)
    - Supabase migration dry-run
  
  build:
    - Expo EAS Build (mobile)
    - Next.js build (web)
  
  deploy:
    - Supabase migrations (staging → prod)
    - Next.js → Vercel
    - Edge Functions deploy
```

### Monitoring

| Outil | Usage |
|-------|-------|
| Sentry | Error tracking mobile + web |
| Supabase Dashboard | DB performance, slow queries |
| Uptime Robot | Disponibilité API |
| PostHog | Analytics produit |
| Logflare | Logs centralisés Edge Functions |

---

## 📋 CONVENTIONS DE CODE

### TypeScript

```typescript
// ✅ Toujours typer explicitement les retours de fonction
async function getAppointment(id: string): Promise<Appointment | null> { }

// ✅ Zod pour toute validation d'input
const AppointmentSchema = z.object({
  practitionerId: z.string().uuid(),
  scheduledAt: z.string().datetime(),
  type: z.enum(['video', 'audio', 'chat']),
});

// ❌ JAMAIS de any
const data: any = response.data; // INTERDIT

// ✅ Types stricts
const data: AppointmentResponse = response.data;
```

### Nommage

```
Components     : PascalCase     → PractitionerCard.tsx
Hooks          : camelCase      → useAppointments.ts
Services       : PascalCase     → PaymentService.ts
Types          : PascalCase     → Appointment, MoodEntry
Variables      : camelCase      → appointmentId
Constants      : SCREAMING_SNAKE → MAX_RETRY_COUNT
DB Tables      : snake_case     → mood_entries
```

### Commits (Conventional Commits)

```
feat(booking): add practitioner availability calendar
fix(payment): handle Wave webhook timeout
chore(db): add indexes for appointment queries
docs(workflow): update node type documentation
```

---

## 📱 INVENTAIRE COMPLET DES ÉCRANS
> Extrait des 18 écrans présents dans le Drive M-Santé — source de vérité UI

### Espace Patient (Mobile)

| Écran | Description | Éléments clés |
|-------|-------------|---------------|
| **AI Companion Chat** | "How are you feeling?" — Companion non-clinique, boutons respiration / praticien / crise | Nav: HOME · ASSISTANT · ACTIVITIES · PROVIDERS · SUPPORT |
| **AI Voice Session** | Session vocale avec analyse en temps réel — Vocal Stress Level / Cognitive Load / Sentiment | Visualisation onde, bouton END SESSION |
| **AI Voice Deep** | "Encrypted Voice Link" — Insights session, stress patterns, copings mécanismes | Session insights panneau droit |
| **Booking Confirmation** | "You're all set!" — Récapitulatif RDV confirmé, bouton Add to Calendar | Icône succès, détails RDV complets |
| **Session Pre-Payment** | Confirm your session — Résumé + Video vs In-Person toggle + Total | Proceed to Payment → chiffré |

### Espace Praticien (Web + Mobile)

| Écran | Description | Éléments clés |
|-------|-------------|---------------|
| **Pending Approvals (mobile)** | Liste requêtes patients — Approve / Reschedule / Decline | Badges "3 Requests", "4 Urgent" |
| **Pending Approvals (web)** | Vue agenda + requêtes côte à côte — calendrier octobre 2023 | Today's Snapshot barre droite |
| **Availability Settings** | Config horaires, formats, tarifs — Weekly Recurring Schedule | Toggle Telehealth $120 / In-Clinic $150 / Home Visit |
| **Dispute Response** | Détail cas #DPT-2023-8841 — Timeline + zone réponse praticien | Upload evidence PDF/JPG/PNG |

### Espace Admin (Web Dashboard)

| Écran | Description | Éléments clés |
|-------|-------------|---------------|
| **Admin KPI Overview** | Platform Health LIVE v2.4 — 4 KPIs + Verification Queue + Disputes | KPIs: 14,208 practitioners / $2.4M revenue / 98.4% verification |
| **Clinical Portal Dashboard** | Platform Overview — 4 KPI cards + Growth Trends chart + Verification Queue + Activity Logs | Chart SVG area, glass-cards |
| **User Management** | Medical Sanctuary — User Directory, filtres ALL/PRACTITIONERS/STAFF | Slide-out profil Dr. Jenkins, verification documents |
| **Payment Reconciliation** | Tableau transactions XOF — Wave / Orange Money / Card — Success / Pending / Failed | Filtres multi-colonnes, Export CSV |
| **Dispute Resolution Center** | Active Disputes 24 · Pending 8 Urgent · Resolved 142 — Urgent Queue | Actions: Suspend / Warning / Reverse Decision |

### Espace Workflow & Finance (Web)

| Écran | Description | Éléments clés |
|-------|-------------|---------------|
| **Workflow Builder** | Automation Command Center — n8n-like canvas avec nodes TRIGGER → ACTION → END | Execution Log temps réel, Properties panel droit |
| **Wellness Journey** | Automated Wellness Journey patient — milestones dynamiques IA | URGENT ACTION today, 12 Tasks Completed, 85% Adherence |
| **Financial Reconciliation** | Live Ledger — Revenue Distribution (80% praticien / 20% plateforme) | Auto-Payout Wave/OM en temps réel, goal target en or |
| **Patient Analytics** | AI Clinical Synthesis — Sleep Quality / Mood vs Activity correlation | Graphiques longitudinaux, r=0.78 correlation, Deep Sleep 2h15m |

### Patterns UI récurrents

```
✅ Sidebar glassmorphique fixe (w-64) sur toutes les vues web
✅ Top bar semi-transparente avec search + notifications + profil
✅ Glass cards (bg-white/60 backdrop-blur-16) pour tous les modules
✅ Badges trend +12% en emerald-50/emerald-600
✅ Avatars initiales (2 lettres) dans cercles/carrés colorés
✅ Montants en XOF (West African Franc) pour le marché sénégalais
✅ Material Symbols Outlined pour toutes les icônes
✅ Boutons Approve / Reschedule / Decline sur toutes les vues praticien
✅ Timeline verticale (border-l-2) pour logs et historiques
✅ Tableaux avec pagination "Showing 1-10 of N · < 1 2 3 >"
```

---

## 🗺 ROADMAP TECHNIQUE

### Phase 1 — MVP (M1-M3)
- [ ] Auth + onboarding patient/praticien
- [ ] Recherche & profil praticiens
- [ ] Réservation + paiement Wave/Orange Money
- [ ] Mood tracker basique
- [ ] Téléconsultation vidéo (Daily.co)
- [ ] Notifications push
- [ ] Dashboard admin basique

### Phase 2 — Enrichissement (M4-M6)
- [ ] Journal émotionnel + méditation
- [ ] Workflow builder V1 (templates pré-configurés)
- [ ] Analytics avancés
- [ ] Stripe + paiement CB international
- [ ] Assistant IA émotionnel (Ami)

### Phase 3 — Scale (M7-M12)
- [ ] Workflow builder V2 (canvas drag & drop)
- [ ] Multi-pays (CI, CM, FR)
- [ ] Abonnements praticiens (SaaS B2B)
- [ ] API publique partenaires
- [ ] Programme assureurs

---

## ⚡ COMMANDES UTILES

```bash
# Setup initial
pnpm install
supabase start
supabase db reset

# Développement
pnpm dev:mobile      # Expo dev server
pnpm dev:web         # Next.js dev server
pnpm dev:functions   # Supabase Edge Functions local

# Tests
pnpm test
pnpm test:coverage
pnpm typecheck

# Base de données
supabase db diff     # Voir les changements
supabase migration new <name>
supabase db push     # Appliquer en prod

# Build
pnpm build:web
eas build --platform ios
eas build --platform android
```

---

## 🧑‍💻 POUR CLAUDE CODE

### À chaque session, Claude Code doit :

1. **Lire ce fichier** avant toute action
2. **Respecter le stack** — ne pas introduire de librairies non listées sans justification
3. **Sécurité d'abord** — RLS, validation, audit log sur toute feature sensible
4. **Limites cliniques** — ne jamais générer de feature qui contourne les garde-fous IA médicaux
5. **Modulaire** — chaque feature dans son dossier `features/`, réutilisable
6. **TypeScript strict** — `noImplicitAny: true`, pas de `any`
7. **Tests** — tout service critique a des tests unitaires
8. **Documenté** — JSDoc sur fonctions publiques complexes

### Priorités de développement

```
P0 → Sécurité, RLS, auth
P1 → Core flows patient (réservation, paiement, consultation)
P2 → Core flows praticien (agenda, disponibilités, revenus)
P3 → Mental health features (mood, journal, méditation)
P4 → Workflow builder
P5 → Analytics, admin avancé
```

---

*CLAUDE.md v2.0 — M-Santé Super App · AUTOMATISE · Design system réel extrait du Drive*
*18 écrans documentés · Manrope + Material Design 3 + Glassmorphism · XOF + Wave + Orange Money*
*Ce fichier est la source de vérité pour Claude Code. Mettre à jour après chaque décision d'architecture majeure.*
