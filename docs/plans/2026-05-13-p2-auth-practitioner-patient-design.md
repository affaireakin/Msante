# P2 — Auth, Praticien & Patient Features Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implémenter 6 features transversales : reset mot de passe web, invitation collaborateur, refus patient, créneaux × prestations, médecin traitant, gestion praticiens par admin.

**Architecture:** Approche hybride — Supabase Auth pour les credentials (invite + reset natifs), DB custom pour toute la logique métier (statuts, blacklists, prestations, médecin traitant). Chaque feature a sa migration SQL + Edge Function si nécessaire + UI mobile (Expo Router) + UI web (Next.js App Router).

**Tech Stack:** Supabase Auth, PostgreSQL RLS, Edge Functions (Deno), React Native + Expo Router, Next.js 15 App Router, Zustand, TanStack Query, Resend (email), Expo Push Notifications.

---

## Section 1 — Mot de passe oublié (complétion web + deep link mobile)

### État actuel
- Mobile : `app/(auth)/forgot-password.tsx` + `authService.resetPassword()` existent
- Manque : deep link redirect mobile + écran reset + pages web

### Design

**Mobile — deep link :**
- `authService.resetPassword(email)` → ajouter `redirectTo: 'msante://reset-password'`
- Nouvel écran `app/(auth)/reset-password.tsx` : intercepte `msante://reset-password#access_token=...`, affiche formulaire nouveau MDP (confirmé ×2)
- Validation Zod : min 8 chars, 1 majuscule, 1 chiffre, 1 caractère spécial

**Web :**
- `/auth/forgot-password` : formulaire email → `supabase.auth.resetPasswordForEmail(email, { redirectTo: 'https://app.msante.sn/auth/reset-password' })`
- `/auth/reset-password` : intercepte le hash Supabase, formulaire nouveau MDP + confirmation
- Supabase Dashboard : URL de redirect autorisées → ajouter `msante://` et domaine web

---

## Section 2 — Invitation collaborateur par l'admin

### Schéma DB

```sql
CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'moderator', 'accountant', 'practitioner')),
  token UUID UNIQUE DEFAULT gen_random_uuid(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '48 hours',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  invited_by UUID NOT NULL REFERENCES public.users(id),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Flow

1. Admin : page `/admin/collaborators` → formulaire email + rôle (checkboxes) → bouton "Inviter"
2. Edge Function `invite-collaborator` :
   - Insère dans `invitations`
   - Envoie email Resend avec lien `msante://invite?token=xxx` (mobile) ou `https://app.msante.sn/invite?token=xxx` (web)
3. Invité clique lien → écran/page "Créer votre compte" :
   - Vérifie token valide + non expiré
   - Saisit MDP (min 8 + maj + chiffre + spécial) + confirmation
   - `supabase.auth.admin.createUser({ email, password, email_confirm: true })`
   - Crée `public.users` avec le rôle défini
   - Marque token `accepted`
4. Si rôle = `practitioner` → redirect vers onboarding praticien obligatoire
5. Si rôle = staff → redirect vers dashboard avec permissions du rôle

### UI Admin

- Page `/admin/collaborators` :
  - Tableau invitations (pending / acceptées / expirées) avec bouton "Renvoyer"
  - Tableau collaborateurs actifs avec checkboxes rôles modifiables en live
- Bouton "Inviter un collaborateur" → modal formulaire

### Sécurité
- Token UUID v4 non-devinable, expire 48h
- RLS : seul un admin peut créer des invitations
- Edge Function protégée par JWT admin

---

## Section 3 — Praticien : refus patient multi-absences + délai de carence

### Schéma DB

```sql
CREATE TABLE public.practitioner_patient_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id UUID NOT NULL REFERENCES public.practitioners(id) UNIQUE,
  alert_threshold INT DEFAULT 2,
  auto_block_threshold INT DEFAULT 3,
  default_cooldown_days INT DEFAULT 30
);

CREATE TABLE public.practitioner_patient_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id UUID NOT NULL REFERENCES public.practitioners(id),
  patient_id UUID NOT NULL REFERENCES public.users(id),
  reason TEXT,
  cooldown_until DATE, -- NULL = bloqué définitivement
  created_at TIMESTAMPTZ DEFAULT NOW(),
  unblocked_at TIMESTAMPTZ,
  UNIQUE(practitioner_id, patient_id)
);
```

### Flow

1. RDV marqué `no_show` → Edge Function `on-appointment-status-change` :
   - Compte les no_shows du patient chez ce praticien
   - Si count ≥ `alert_threshold` → push au praticien : *"[Patient] a manqué N RDV. Voulez-vous le restreindre ?"*
2. Dashboard praticien — section **"Patients à surveiller"** :
   - Actions par patient : **Ignorer** / **Délai de carence** (saisir durée en jours) / **Bloquer définitivement**
3. À la réservation : vérification `practitioner_patient_blocks` → si bloqué/carence active → erreur *"Ce praticien n'accepte plus de nouvelles réservations pour le moment"*
4. Praticien peut débloquer à tout moment

### Disponible sur mobile + web praticien

---

## Section 4 — Configuration créneaux × prestations × types

### Schéma DB

```sql
CREATE TABLE public.practitioner_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id UUID NOT NULL REFERENCES public.practitioners(id),
  name TEXT NOT NULL,
  duration_min INT NOT NULL DEFAULT 60,
  price NUMERIC(10,2),
  session_types TEXT[] NOT NULL DEFAULT ARRAY['video'],
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.availability_day_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id UUID NOT NULL REFERENCES public.practitioners(id),
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  allowed_types TEXT[] NOT NULL DEFAULT ARRAY['video','audio','presentiel'],
  UNIQUE(practitioner_id, day_of_week)
);

ALTER TABLE public.availabilities
  ADD COLUMN IF NOT EXISTS override_types TEXT[],
  ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES public.practitioner_services(id);
```

### Hiérarchie de résolution (général → précis)

1. `practitioners.session_types` — types globaux du praticien
2. `availability_day_rules.allowed_types` — règle du jour de la semaine
3. `availabilities.override_types` — override ponctuel du créneau (nullable)
4. `practitioner_services.session_types` — types de la prestation assignée

### UX Praticien

- Onglet "Prestations" : CRUD prestations (nom, durée, prix, types)
- Planning hebdo : règles par jour (toggles vidéo/audio/présentiel)
- Sur chaque créneau : option "Personnaliser" → override types + assigner prestation

### UX Patient

- Filtre "Type de consultation" sur la liste des créneaux
- Badge par créneau : icônes vidéo / casque audio / localisation présentiel

---

## Section 5 — Médecin traitant

### Schéma DB

```sql
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS referring_doctor_id UUID REFERENCES public.practitioners(id);

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS referring_doctor_status TEXT DEFAULT 'none'
    CHECK (referring_doctor_status IN ('none', 'pending', 'accepted', 'refused'));
```

### Flow

1. Patient : profil → "Mon médecin traitant" → liste filtrée `speciality ILIKE '%generaliste%' AND is_verified = true`
2. Patient sélectionne → `referring_doctor_status = 'pending'` + notification push/email au médecin
3. Médecin : dashboard onglet "Patients" → **Accepter / Refuser** la désignation
4. Si accepté :
   - `referring_doctor_status = 'accepted'`
   - RLS étendue : médecin accède à `patient_medical_profiles` + mood history agrégé du patient
   - Notification au patient : *"Dr. [Nom] a accepté votre désignation"*
5. À chaque consultation du patient chez un autre praticien → notification au médecin traitant (sans détails cliniques)
6. Patient peut changer → ancien médecin perd l'accès dossier immédiatement

### RLS
```sql
-- Médecin traitant voit le dossier médical de ses patients
CREATE POLICY "referring_doctor_access" ON patient_medical_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM practitioners p
      JOIN users u ON u.referring_doctor_id = p.id
      WHERE p.user_id = auth.uid()
      AND u.id = patient_medical_profiles.patient_id
      AND u.referring_doctor_status = 'accepted'
    )
  );
```

---

## Section 6 — Admin : gestion praticiens (5 états + appel)

### Schéma DB

```sql
ALTER TABLE public.practitioners
  ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'active'
    CHECK (account_status IN ('active', 'suspended', 'blocked')),
  ADD COLUMN IF NOT EXISTS status_reason TEXT,
  ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_changed_by UUID REFERENCES public.users(id);

CREATE TABLE public.practitioner_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id UUID NOT NULL REFERENCES public.practitioners(id),
  old_status TEXT,
  new_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  changed_by UUID NOT NULL REFERENCES public.users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.practitioner_appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id UUID NOT NULL REFERENCES public.practitioners(id),
  message TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'accepted', 'rejected')),
  admin_response TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.users(id)
);
```

### États et conséquences

| État | Peut recevoir RDV | RDV existants | Paiements |
|------|:-----------------:|:-------------:|:---------:|
| `pending` | ✗ | — | — |
| `under_review` | ✗ | — | — |
| `approved` + `active` | ✓ | maintenus | actifs |
| `suspended` | ✗ | maintenus | gelés |
| `blocked` | ✗ | annulés + remboursés | stoppés |

### UX Admin

- Page `/admin/practitioners` : boutons **Approuver / Suspendre / Bloquer** → modal motif obligatoire
- Chaque action → notification email + push au praticien avec motif
- Onglet **"Appels en cours"** : liste contestations + champ réponse + Accepter/Rejeter

### UX Praticien

- Si suspendu/bloqué : bannière rouge avec motif + bouton **"Contester cette décision"**
- Formulaire texte libre → soumis à l'admin
- Historique des statuts visible dans profil (mobile + web)

---

## Ordre d'implémentation recommandé

1. Migrations SQL (toutes les tables en une fois)
2. Section 1 — Reset MDP web + deep link mobile
3. Section 2 — Invitation collaborateur (Edge Function + UI admin + écran onboarding)
4. Section 6 — Gestion statuts praticiens (admin UI + notifications)
5. Section 3 — Refus patient (Edge Function no_show + UI praticien)
6. Section 4 — Créneaux × prestations (UI praticien + filtre patient)
7. Section 5 — Médecin traitant (UI patient + RLS + notifications)
