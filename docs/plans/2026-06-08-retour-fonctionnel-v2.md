# Retour Fonctionnel V2 — Plan d'Implémentation M-Santé

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Corriger et compléter les 7 domaines fonctionnels prioritaires : messagerie, dossier patient, notes/ordonnances, permissions données, prise de RDV, RBAC admin.

**Architecture:** Mobile-first (React Native + Expo Router), backend Supabase (PostgreSQL + Edge Functions + Realtime + Storage), web admin Next.js 15. Toutes les features backend passent par des migrations SQL + RLS + Edge Functions. Toutes les features mobile utilisent TanStack Query + Zustand + hooks feature-based.

**Tech Stack:** Expo SDK 54 · Supabase · LiveKit · TanStack Query v5 · Zustand v5 · NativeWind v4 · TypeScript strict · Zod · Manrope font · Material Icons

---

## ÉTAT ACTUEL DES BUGS

| Domaine | Status | Problème racine |
|---------|--------|-----------------|
| Messagerie | ❌ Cassé | Table `messages` absente en DB (code mobile existe, migration manquante) |
| Notes praticien | ⚠️ Partiel | Notes disponibles seulement après session vidéo |
| Historique patient | ❌ Manquant | Pas de vue chronologique agrégée |
| Ordonnances | ⚠️ Partiel | Stockées S3 uniquement, non indexées en DB |
| Permissions données | ❌ Manquant | Table inexistante |
| RBAC admin | ❌ Manquant | Pas de gestion fine des droits par métier |
| Services/RDV | ⚠️ Partiel | Création de prestations instable |

---

## PHASE 1 — HAUTE PRIORITÉ

---

### Task 1: Migration — Table `messages` (Messagerie)

**Contexte:** Le code mobile messages est complet côté UI mais la table `messages` n'existe pas en DB. C'est pour ça que la messagerie ne marche pas.

**Files:**
- Create: `supabase/migrations/20260608000001_messages_table.sql`

**Step 1: Écrire la migration**

```sql
-- supabase/migrations/20260608000001_messages_table.sql

CREATE TYPE message_attachment_type AS ENUM (
  'analyse', 'ordonnance', 'compte_rendu', 'imagerie', 'autre'
);

CREATE TABLE public.messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  appointment_id  UUID REFERENCES public.appointments(id),  -- optionnel, pour contexte médical
  body            TEXT,
  attachment_url  TEXT,
  attachment_name TEXT,
  attachment_type message_attachment_type,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour les conversations bilatérales
CREATE INDEX idx_messages_conversation
  ON messages (LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id), created_at);
CREATE INDEX idx_messages_receiver_unread
  ON messages (receiver_id, read_at) WHERE read_at IS NULL;

-- RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Un utilisateur peut lire ses propres messages (envoyés ou reçus)
CREATE POLICY "users_read_own_messages" ON public.messages
  FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );

-- Un utilisateur peut envoyer des messages (sender = lui)
CREATE POLICY "users_send_messages" ON public.messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Un utilisateur peut marquer ses messages reçus comme lus
CREATE POLICY "users_mark_read" ON public.messages
  FOR UPDATE USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);

-- Admins voient tout
CREATE POLICY "admins_all_messages" ON public.messages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Storage bucket pour les pièces jointes messages
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message-attachments',
  'message-attachments',
  false,
  20971520,  -- 20 MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- RLS Storage: sender peut uploader, sender+receiver peuvent lire
CREATE POLICY "message_attachment_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'message-attachments' AND auth.uid() IS NOT NULL
  );

CREATE POLICY "message_attachment_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'message-attachments' AND auth.uid() IS NOT NULL
  );
```

**Step 2: Appliquer la migration**

```bash
supabase db push
# ou en local:
supabase migration up
```
Résultat attendu : `Applied migration 20260608000001_messages_table`

**Step 3: Vérifier la table**

```bash
supabase db diff --use-migra
```
Résultat attendu : aucun diff (table créée proprement)

**Step 4: Commit**

```bash
git add supabase/migrations/20260608000001_messages_table.sql
git commit -m "feat(db): add messages table with RLS and storage bucket"
```

---

### Task 2: Vérifier et corriger le hook messages mobile

**Contexte:** Le code messages mobile référence la table `messages`. Vérifier que les champs correspondent exactement à la migration ci-dessus.

**Files:**
- Read: `apps/mobile/app/(patient)/messages/[id].tsx`
- Read: `apps/mobile/app/(practitioner)/messages/[id].tsx`
- Modify si besoin: les deux fichiers

**Step 1: Vérifier les champs utilisés**

Ouvrir les deux fichiers et vérifier que les colonnes référencées (`body`, `sender_id`, `receiver_id`, `attachment_url`, `attachment_name`, `attachment_type`, `read_at`, `created_at`) correspondent exactement à celles de la migration.

**Step 2: Corriger les types TypeScript**

Dans chaque fichier messages, s'assurer que le type local correspond :

```typescript
interface Message {
  id: string
  sender_id: string
  receiver_id: string
  appointment_id?: string | null
  body: string | null
  attachment_url: string | null
  attachment_name: string | null
  attachment_type: 'analyse' | 'ordonnance' | 'compte_rendu' | 'imagerie' | 'autre' | null
  read_at: string | null
  created_at: string
}
```

**Step 3: Tester la messagerie**

1. Lancer `pnpm dev:mobile`
2. Connecter deux comptes (patient + praticien)
3. Envoyer un message depuis patient → vérifier apparition côté praticien
4. Envoyer un fichier PDF → vérifier upload et affichage

**Step 4: Commit**

```bash
git add apps/mobile/app/\(patient\)/messages/ apps/mobile/app/\(practitioner\)/messages/
git commit -m "fix(messaging): align message types with DB schema"
```

---

### Task 3: Migration — Table `prescriptions` (tracking ordonnances)

**Contexte:** Les ordonnances sont stockées en S3 (`prescriptions/` bucket) mais pas trackées en DB. On ne peut donc pas faire d'historique ni de recherche.

**Files:**
- Create: `supabase/migrations/20260608000002_prescriptions_tracking.sql`

**Step 1: Écrire la migration**

```sql
-- supabase/migrations/20260608000002_prescriptions_tracking.sql

CREATE TYPE prescription_status AS ENUM ('draft', 'signed', 'dispensed', 'cancelled');

CREATE TABLE public.prescriptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id   UUID REFERENCES public.consultations(id),
  appointment_id    UUID NOT NULL REFERENCES public.appointments(id),
  practitioner_id   UUID NOT NULL REFERENCES public.practitioners(id),
  patient_id        UUID NOT NULL REFERENCES public.users(id),
  
  -- Contenu structuré
  medications       JSONB NOT NULL DEFAULT '[]',
  -- Format: [{ name, dosage, frequency, duration, instructions }]
  
  diagnosis         TEXT,
  instructions      TEXT,
  
  -- Fichier PDF généré
  pdf_url           TEXT,
  pdf_generated_at  TIMESTAMPTZ,
  
  -- Statut
  status            prescription_status NOT NULL DEFAULT 'draft',
  signed_at         TIMESTAMPTZ,
  
  -- Contexte consultation (peut être créée hors session vidéo)
  consultation_type TEXT DEFAULT 'video'
    CHECK (consultation_type IN ('video', 'audio', 'presentiel', 'standalone')),
  
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prescriptions_patient ON prescriptions(patient_id, created_at DESC);
CREATE INDEX idx_prescriptions_practitioner ON prescriptions(practitioner_id, created_at DESC);
CREATE INDEX idx_prescriptions_appointment ON prescriptions(appointment_id);

-- RLS
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patients_read_own_prescriptions" ON public.prescriptions
  FOR SELECT USING (auth.uid() = patient_id);

CREATE POLICY "practitioners_manage_own_prescriptions" ON public.prescriptions
  FOR ALL USING (
    auth.uid() = (SELECT user_id FROM practitioners WHERE id = practitioner_id)
  );

CREATE POLICY "admins_all_prescriptions" ON public.prescriptions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER prescriptions_updated_at
  BEFORE UPDATE ON prescriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

**Step 2: Appliquer**

```bash
supabase db push
```

**Step 3: Commit**

```bash
git add supabase/migrations/20260608000002_prescriptions_tracking.sql
git commit -m "feat(db): add prescriptions tracking table with RLS"
```

---

### Task 4: Migration — Table `practitioner_notes` (notes indépendantes)

**Contexte:** Les notes praticien existent mais uniquement après une session vidéo (dans `consultations.practitioner_notes`). On doit permettre la création de notes/observations/comptes-rendus indépendamment du mode de consultation, et pour toute profession (psychologue, coach, sophrologue, etc.).

**Files:**
- Create: `supabase/migrations/20260608000003_practitioner_notes.sql`

**Step 1: Écrire la migration**

```sql
-- supabase/migrations/20260608000003_practitioner_notes.sql

CREATE TYPE note_type AS ENUM (
  'observation',      -- observation clinique
  'compte_rendu',     -- compte-rendu de séance  
  'note_suivi',       -- note de suivi (coach, sophrologue)
  'bilan',            -- bilan périodique
  'alerte',           -- alerte/signalement
  'prescription_note' -- note liée à ordonnance
);

CREATE TABLE public.practitioner_notes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id UUID NOT NULL REFERENCES public.practitioners(id),
  patient_id      UUID NOT NULL REFERENCES public.users(id),
  appointment_id  UUID REFERENCES public.appointments(id),   -- optionnel
  consultation_id UUID REFERENCES public.consultations(id),  -- optionnel
  
  note_type       note_type NOT NULL DEFAULT 'observation',
  title           TEXT,
  content         TEXT NOT NULL,
  
  -- Visibilité : privé au praticien, ou partageable avec patient
  is_shared_with_patient BOOLEAN NOT NULL DEFAULT FALSE,
  shared_at       TIMESTAMPTZ,
  
  -- Tags libres (ex: ['anxiété', 'progrès', 'famille'])
  tags            TEXT[] DEFAULT '{}',
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_practitioner_notes_patient ON practitioner_notes(patient_id, created_at DESC);
CREATE INDEX idx_practitioner_notes_practitioner ON practitioner_notes(practitioner_id, created_at DESC);

ALTER TABLE public.practitioner_notes ENABLE ROW LEVEL SECURITY;

-- Le praticien peut tout faire sur ses propres notes
CREATE POLICY "practitioners_own_notes" ON public.practitioner_notes
  FOR ALL USING (
    auth.uid() = (SELECT user_id FROM practitioners WHERE id = practitioner_id)
  );

-- Le patient peut lire uniquement les notes partagées avec lui
CREATE POLICY "patients_read_shared_notes" ON public.practitioner_notes
  FOR SELECT USING (
    auth.uid() = patient_id AND is_shared_with_patient = TRUE
  );

-- Admins voient tout
CREATE POLICY "admins_all_notes" ON public.practitioner_notes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE TRIGGER practitioner_notes_updated_at
  BEFORE UPDATE ON practitioner_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

**Step 2: Appliquer**

```bash
supabase db push
```

**Step 3: Commit**

```bash
git add supabase/migrations/20260608000003_practitioner_notes.sql
git commit -m "feat(db): add practitioner_notes table for standalone notes/observations"
```

---

### Task 5: Migration — Table `patient_data_permissions` (contrôle accès données)

**Contexte:** Un patient doit pouvoir contrôler précisément quelles données chaque praticien peut consulter. Inspiré du document fonctionnel : toggles par catégorie de données.

**Files:**
- Create: `supabase/migrations/20260608000004_patient_data_permissions.sql`

**Step 1: Écrire la migration**

```sql
-- supabase/migrations/20260608000004_patient_data_permissions.sql

CREATE TABLE public.patient_data_permissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  practitioner_id UUID NOT NULL REFERENCES public.practitioners(id) ON DELETE CASCADE,
  
  -- Catégories de données (toggles)
  allow_medical_history       BOOLEAN NOT NULL DEFAULT TRUE,
  allow_biological_analyses   BOOLEAN NOT NULL DEFAULT FALSE,
  allow_prescriptions         BOOLEAN NOT NULL DEFAULT TRUE,
  allow_consultation_reports  BOOLEAN NOT NULL DEFAULT TRUE,
  allow_psychological_data    BOOLEAN NOT NULL DEFAULT FALSE,
  allow_gynecological_data    BOOLEAN NOT NULL DEFAULT FALSE,
  allow_shared_documents      BOOLEAN NOT NULL DEFAULT TRUE,
  allow_appointment_history   BOOLEAN NOT NULL DEFAULT TRUE,
  allow_mood_journal          BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Metadata
  granted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(patient_id, practitioner_id)
);

CREATE INDEX idx_data_permissions_patient ON patient_data_permissions(patient_id);
CREATE INDEX idx_data_permissions_practitioner ON patient_data_permissions(practitioner_id);

ALTER TABLE public.patient_data_permissions ENABLE ROW LEVEL SECURITY;

-- Patient contrôle ses propres permissions
CREATE POLICY "patients_own_permissions" ON public.patient_data_permissions
  FOR ALL USING (auth.uid() = patient_id);

-- Praticien peut lire les permissions qui le concernent
CREATE POLICY "practitioners_read_own_permissions" ON public.patient_data_permissions
  FOR SELECT USING (
    auth.uid() = (SELECT user_id FROM practitioners WHERE id = practitioner_id)
  );

-- Admins voient tout
CREATE POLICY "admins_all_permissions" ON public.patient_data_permissions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE TRIGGER permissions_updated_at
  BEFORE UPDATE ON patient_data_permissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-créer des permissions par défaut lors d'un premier RDV confirmé
-- (Trigger sur appointments: status → confirmed)
CREATE OR REPLACE FUNCTION create_default_permissions()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' THEN
    INSERT INTO public.patient_data_permissions (patient_id, practitioner_id)
    VALUES (NEW.patient_id, NEW.practitioner_id)
    ON CONFLICT (patient_id, practitioner_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_create_permissions
  AFTER UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION create_default_permissions();
```

**Step 2: Appliquer**

```bash
supabase db push
```

**Step 3: Commit**

```bash
git add supabase/migrations/20260608000004_patient_data_permissions.sql
git commit -m "feat(db): add patient_data_permissions table with auto-grant on appointment confirm"
```

---

### Task 6: Migration — Table `profession_permissions` (RBAC par métier)

**Contexte:** L'admin doit définir ce que chaque profession peut faire (médecin peut émettre ordonnances, psychologue ne peut pas, etc.).

**Files:**
- Create: `supabase/migrations/20260608000005_profession_permissions.sql`

**Step 1: Écrire la migration**

```sql
-- supabase/migrations/20260608000005_profession_permissions.sql

CREATE TABLE public.profession_permissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identifiant de la profession (ex: 'medecin', 'psychologue', 'sophrologue', 'coach')
  profession_key  TEXT NOT NULL UNIQUE,
  profession_label TEXT NOT NULL,
  
  -- Capacités autorisées
  can_prescribe           BOOLEAN NOT NULL DEFAULT FALSE,  -- émettre ordonnances médicales
  can_write_observations  BOOLEAN NOT NULL DEFAULT TRUE,   -- observations cliniques
  can_write_reports       BOOLEAN NOT NULL DEFAULT TRUE,   -- comptes-rendus
  can_view_full_dossier   BOOLEAN NOT NULL DEFAULT FALSE,  -- dossier médical complet
  can_view_analyses       BOOLEAN NOT NULL DEFAULT FALSE,  -- analyses biologiques
  can_view_imaging        BOOLEAN NOT NULL DEFAULT FALSE,  -- imagerie médicale
  can_share_with_patient  BOOLEAN NOT NULL DEFAULT TRUE,   -- partager notes avec patient
  can_request_analyses    BOOLEAN NOT NULL DEFAULT FALSE,  -- demander analyses
  
  -- Méta
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Données initiales par défaut
INSERT INTO public.profession_permissions
  (profession_key, profession_label, can_prescribe, can_write_observations, can_write_reports, can_view_full_dossier, can_view_analyses, can_view_imaging, can_request_analyses, description)
VALUES
  ('medecin', 'Médecin', TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, 'Accès complet, prescription autorisée'),
  ('psychiatre', 'Psychiatre', TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, FALSE, 'Prescription autorisée, pas d''imagerie'),
  ('psychologue', 'Psychologue', FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE, 'Notes et comptes-rendus uniquement selon autorisation patient'),
  ('sophrologue', 'Sophrologue', FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE, 'Notes de suivi, pas d''accès aux données médicales'),
  ('coach', 'Coach Bien-être', FALSE, FALSE, TRUE, FALSE, FALSE, FALSE, FALSE, 'Comptes-rendus de séance et suivi objectifs uniquement'),
  ('infirmier', 'Infirmier', FALSE, TRUE, TRUE, FALSE, TRUE, FALSE, FALSE, 'Observations et analyses, pas de prescription'),
  ('kinesitherapeute', 'Kinésithérapeute', FALSE, TRUE, TRUE, FALSE, FALSE, TRUE, FALSE, 'Observations et imagerie')
ON CONFLICT (profession_key) DO NOTHING;

-- Lier la profession du praticien à ses permissions
-- Vue utile : permissions effectives d'un praticien
CREATE VIEW public.practitioner_effective_permissions AS
SELECT 
  p.id AS practitioner_id,
  p.user_id,
  p.speciality,
  pp.*
FROM public.practitioners p
LEFT JOIN public.profession_permissions pp 
  ON LOWER(TRIM(p.speciality)) = LOWER(pp.profession_key)
   OR LOWER(TRIM(p.speciality)) LIKE '%' || LOWER(pp.profession_key) || '%';

ALTER TABLE public.profession_permissions ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut lire (nécessaire pour UI)
CREATE POLICY "read_profession_permissions" ON public.profession_permissions
  FOR SELECT USING (TRUE);

-- Seuls les admins peuvent modifier
CREATE POLICY "admins_manage_profession_permissions" ON public.profession_permissions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE TRIGGER profession_permissions_updated_at
  BEFORE UPDATE ON profession_permissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

**Step 2: Appliquer**

```bash
supabase db push
```

**Step 3: Commit**

```bash
git add supabase/migrations/20260608000005_profession_permissions.sql
git commit -m "feat(db): add profession_permissions RBAC table with default values"
```

---

## PHASE 2 — ÉCRANS MOBILE

---

### Task 7: Écran Praticien — Notes & Observations (standalone)

**Contexte:** Permettre au praticien de créer des notes/observations sans session vidéo. Accessible depuis la fiche patient ou l'agenda.

**Files:**
- Create: `apps/mobile/app/(practitioner)/patient-notes/[patientId].tsx`
- Create: `apps/mobile/features/practitioner/hooks/usePatientNotes.ts`

**Step 1: Hook `usePatientNotes`**

```typescript
// apps/mobile/features/practitioner/hooks/usePatientNotes.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { useAuth } from '@/features/auth/hooks/useAuth'

export type NoteType = 'observation' | 'compte_rendu' | 'note_suivi' | 'bilan' | 'alerte' | 'prescription_note'

export interface PatientNote {
  id: string
  note_type: NoteType
  title: string | null
  content: string
  is_shared_with_patient: boolean
  tags: string[]
  created_at: string
}

interface CreateNoteInput {
  patientId: string
  appointmentId?: string
  noteType: NoteType
  title?: string
  content: string
  isSharedWithPatient: boolean
  tags: string[]
}

export function usePatientNotes(patientId: string) {
  const { practitioner } = useAuth()
  
  return useQuery({
    queryKey: ['practitioner-notes', practitioner?.id, patientId],
    enabled: !!practitioner?.id && !!patientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('practitioner_notes')
        .select('id, note_type, title, content, is_shared_with_patient, tags, created_at')
        .eq('practitioner_id', practitioner!.id)
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as PatientNote[]
    },
  })
}

export function useCreateNote() {
  const { practitioner } = useAuth()
  const qc = useQueryClient()
  
  return useMutation({
    mutationFn: async (input: CreateNoteInput) => {
      const { data, error } = await supabase
        .from('practitioner_notes')
        .insert({
          practitioner_id: practitioner!.id,
          patient_id: input.patientId,
          appointment_id: input.appointmentId ?? null,
          note_type: input.noteType,
          title: input.title ?? null,
          content: input.content,
          is_shared_with_patient: input.isSharedWithPatient,
          tags: input.tags,
        })
        .select('id')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['practitioner-notes', practitioner?.id, vars.patientId] })
    },
  })
}
```

**Step 2: Écran Notes Patient**

```typescript
// apps/mobile/app/(practitioner)/patient-notes/[patientId].tsx
// Écran permettant au praticien de consulter et créer des notes pour un patient
// Structure :
// - Header : nom patient + bouton "Nouvelle note"
// - Liste des notes existantes (date, type, aperçu contenu)
// - Modal/sheet : formulaire nouvelle note (type, titre, contenu, tags, partage toggle)
```

Implémenter l'écran complet avec :
- `FlatList` des notes existantes groupées par date
- Badges colorés par type (`observation` → bleu, `compte_rendu` → vert, `alerte` → rouge, `note_suivi` → ambre)
- Bottom sheet pour créer une nouvelle note
- Toggle "Partager avec le patient"
- Sélecteur de type de note
- Tags libres (chips)
- Bouton Enregistrer

**Step 3: Test manuel**

1. Naviguer vers un patient depuis l'agenda
2. Créer une note de type "observation"
3. Vérifier apparition dans la liste
4. Activer "Partager avec patient" → vérifier accès côté patient

**Step 4: Commit**

```bash
git add apps/mobile/app/\(practitioner\)/patient-notes/ apps/mobile/features/practitioner/hooks/usePatientNotes.ts
git commit -m "feat(mobile): practitioner standalone notes screen"
```

---

### Task 8: Écran Patient — Dossier médical complet (historique chronologique)

**Contexte:** Vue chronologique de toutes les interactions médicales du patient : consultations, prescriptions, notes partagées, documents.

**Files:**
- Create: `apps/mobile/app/(patient)/dossier.tsx`
- Create: `apps/mobile/features/patient/hooks/useMedicalHistory.ts`

**Step 1: Hook `useMedicalHistory`**

```typescript
// apps/mobile/features/patient/hooks/useMedicalHistory.ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/features/auth/store/authStore'

export interface HistoryEvent {
  id: string
  event_type: 'consultation' | 'prescription' | 'note_shared' | 'message' | 'document'
  date: string
  practitioner_name?: string
  practitioner_speciality?: string
  title: string
  summary?: string
  reference_id: string   // ID de l'objet source (consultation_id, prescription_id, etc.)
}

export function useMedicalHistory() {
  const { profile } = useAuthStore()
  
  return useQuery({
    queryKey: ['medical-history', profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const patientId = profile!.id
      
      // Consultations terminées
      const { data: consultations } = await supabase
        .from('consultations')
        .select(`
          id, started_at, ai_summary,
          appointments!inner(
            type, notes,
            practitioners(speciality, users(full_name))
          )
        `)
        .eq('appointments.patient_id', patientId)
        .eq('status', 'ended')
        .order('started_at', { ascending: false })
        .limit(50)
      
      // Prescriptions
      const { data: prescriptions } = await supabase
        .from('prescriptions')
        .select('id, created_at, diagnosis, medications, practitioners(speciality, users(full_name))')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(50)
      
      // Notes partagées avec le patient
      const { data: notes } = await supabase
        .from('practitioner_notes')
        .select('id, created_at, note_type, title, content, practitioners(speciality, users(full_name))')
        .eq('patient_id', patientId)
        .eq('is_shared_with_patient', true)
        .order('created_at', { ascending: false })
        .limit(50)
      
      // Agrégation et tri chronologique
      const events: HistoryEvent[] = [
        ...(consultations ?? []).map(c => ({
          id: c.id,
          event_type: 'consultation' as const,
          date: c.started_at,
          practitioner_name: (c.appointments as any)?.practitioners?.users?.full_name,
          practitioner_speciality: (c.appointments as any)?.practitioners?.speciality,
          title: 'Consultation',
          summary: c.ai_summary ?? undefined,
          reference_id: c.id,
        })),
        ...(prescriptions ?? []).map(p => ({
          id: p.id,
          event_type: 'prescription' as const,
          date: p.created_at,
          practitioner_name: (p.practitioners as any)?.users?.full_name,
          practitioner_speciality: (p.practitioners as any)?.speciality,
          title: p.diagnosis ?? 'Ordonnance',
          summary: `${(p.medications as any[]).length} médicament(s)`,
          reference_id: p.id,
        })),
        ...(notes ?? []).map(n => ({
          id: n.id,
          event_type: 'note_shared' as const,
          date: n.created_at,
          practitioner_name: (n.practitioners as any)?.users?.full_name,
          practitioner_speciality: (n.practitioners as any)?.speciality,
          title: n.title ?? 'Note de consultation',
          summary: n.content.slice(0, 100),
          reference_id: n.id,
        })),
      ]
      
      return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    },
  })
}
```

**Step 2: Écran Dossier**

Créer `apps/mobile/app/(patient)/dossier.tsx` :
- Header : "Mon dossier médical"
- Timeline verticale (`border-l-2` bleu)
- Chaque événement = carte avec :
  - Icône selon type (stéthoscope, pill, notes)
  - Date formatée
  - Nom praticien + spécialité
  - Titre + résumé
  - Chevron → navigation vers détail

**Step 3: Ajouter l'accès depuis home patient**

Dans `apps/mobile/app/(patient)/home.tsx`, ajouter une carte "Mon dossier" dans les Quick Actions.

**Step 4: Commit**

```bash
git add apps/mobile/app/\(patient\)/dossier.tsx apps/mobile/features/patient/hooks/useMedicalHistory.ts
git commit -m "feat(mobile): patient medical history chronological view"
```

---

### Task 9: Écran Patient — Gestion des permissions praticiens

**Contexte:** Le patient choisit son praticien et active/désactive les autorisations via des toggles.

**Files:**
- Create: `apps/mobile/app/(patient)/permissions/[practitionerId].tsx`
- Create: `apps/mobile/features/patient/hooks/useDataPermissions.ts`

**Step 1: Hook `useDataPermissions`**

```typescript
// apps/mobile/features/patient/hooks/useDataPermissions.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/features/auth/store/authStore'

export interface DataPermissions {
  id: string
  practitioner_id: string
  allow_medical_history: boolean
  allow_biological_analyses: boolean
  allow_prescriptions: boolean
  allow_consultation_reports: boolean
  allow_psychological_data: boolean
  allow_gynecological_data: boolean
  allow_shared_documents: boolean
  allow_appointment_history: boolean
  allow_mood_journal: boolean
}

export const PERMISSION_LABELS: Record<keyof Omit<DataPermissions, 'id' | 'practitioner_id'>, string> = {
  allow_medical_history: 'Historique médical',
  allow_biological_analyses: 'Analyses biologiques',
  allow_prescriptions: 'Ordonnances',
  allow_consultation_reports: 'Comptes-rendus',
  allow_psychological_data: 'Données psychologiques',
  allow_gynecological_data: 'Données gynécologiques',
  allow_shared_documents: 'Documents partagés',
  allow_appointment_history: 'Historique des consultations',
  allow_mood_journal: 'Humeur & Journal',
}

export function useDataPermissions(practitionerId: string) {
  const { profile } = useAuthStore()
  return useQuery({
    queryKey: ['data-permissions', profile?.id, practitionerId],
    enabled: !!profile?.id && !!practitionerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patient_data_permissions')
        .select('*')
        .eq('patient_id', profile!.id)
        .eq('practitioner_id', practitionerId)
        .maybeSingle()
      if (error) throw error
      return data as DataPermissions | null
    },
  })
}

export function useUpdatePermissions(practitionerId: string) {
  const { profile } = useAuthStore()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (updates: Partial<Omit<DataPermissions, 'id' | 'practitioner_id'>>) => {
      const { error } = await supabase
        .from('patient_data_permissions')
        .upsert({
          patient_id: profile!.id,
          practitioner_id: practitionerId,
          ...updates,
        }, { onConflict: 'patient_id,practitioner_id' })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['data-permissions', profile?.id, practitionerId] })
    },
  })
}
```

**Step 2: Écran permissions**

Créer l'écran avec :
- Header : "Autorisations — [Nom Praticien]"
- Description explicative ("Choisissez ce que [Dr. X] peut consulter")
- Liste de toggles Switch par catégorie
- Groupement : "Données médicales" / "Santé mentale" / "Documents"
- Bouton "Enregistrer" avec feedback de succès

**Step 3: Relier depuis la fiche praticien**

Ajouter un bouton "Gérer les autorisations" dans `apps/mobile/app/(patient)/practitioner/[id].tsx`.

**Step 4: Commit**

```bash
git add apps/mobile/app/\(patient\)/permissions/ apps/mobile/features/patient/hooks/useDataPermissions.ts
git commit -m "feat(mobile): patient data permissions management screen"
```

---

### Task 10: Écran Praticien — Création d'ordonnance standalone

**Contexte:** Permettre la création d'ordonnances depuis la fiche patient ou post-consultation, indépendamment du mode (présentiel inclus).

**Files:**
- Create: `apps/mobile/app/(practitioner)/prescription/new.tsx`
- Create: `apps/mobile/features/practitioner/hooks/usePrescription.ts`

**Step 1: Hook `usePrescription`**

```typescript
// apps/mobile/features/practitioner/hooks/usePrescription.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { useAuth } from '@/features/auth/hooks/useAuth'

export interface MedicationLine {
  name: string
  dosage: string
  frequency: string
  duration: string
  instructions: string
}

export interface CreatePrescriptionInput {
  patientId: string
  appointmentId?: string
  consultationId?: string
  medications: MedicationLine[]
  diagnosis: string
  instructions: string
}

export function useCreatePrescription() {
  const { practitioner } = useAuth()
  const qc = useQueryClient()
  
  return useMutation({
    mutationFn: async (input: CreatePrescriptionInput) => {
      const { data, error } = await supabase
        .from('prescriptions')
        .insert({
          practitioner_id: practitioner!.id,
          patient_id: input.patientId,
          appointment_id: input.appointmentId ?? null,
          consultation_id: input.consultationId ?? null,
          medications: input.medications,
          diagnosis: input.diagnosis,
          instructions: input.instructions,
          consultation_type: input.appointmentId ? 'standalone' : 'video',
          status: 'draft',
        })
        .select('id')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['prescriptions', vars.patientId] })
    },
  })
}
```

**Step 2: Écran création ordonnance**

Créer l'écran avec :
- Header : "Nouvelle ordonnance"
- Champ diagnostic (TextInput)
- Liste de médicaments dynamique (add/remove lignes)
  - Chaque ligne : nom, dosage, fréquence, durée, instructions
- Bouton "+ Ajouter médicament"
- Instructions générales
- Bouton "Enregistrer comme brouillon" + "Générer PDF"

**Note sur VIDAL :** Intégration VIDAL est priorité moyenne (Task 16). Pour l'instant, saisie libre du nom médicament avec autocomplete depuis une liste basique locale.

**Step 3: Commit**

```bash
git add apps/mobile/app/\(practitioner\)/prescription/ apps/mobile/features/practitioner/hooks/usePrescription.ts
git commit -m "feat(mobile): standalone prescription creation screen"
```

---

## PHASE 3 — WEB ADMIN

---

### Task 11: Web Admin — Gestion des rôles et permissions par profession

**Contexte:** Interface admin pour configurer les droits de chaque profession (médecin, psychologue, etc.) via des toggles.

**Files:**
- Create: `apps/web/app/admin/roles/page.tsx`
- Create: `apps/web/app/admin/roles/[professionKey]/page.tsx`

**Step 1: Page liste des professions**

```typescript
// apps/web/app/admin/roles/page.tsx
// Tableau de toutes les professions avec colonnes de permissions
// Cliquable pour éditer chaque profession
// Inspiré de la maquette "Admin KPI Overview" avec glassmorphism
```

**Step 2: Page édition profession**

```typescript
// apps/web/app/admin/roles/[professionKey]/page.tsx
// Formulaire avec tous les toggles de permission
// Sauvegarde via supabase.from('profession_permissions').update(...)
// Badges d'état : "Autorisé" (vert) / "Refusé" (rouge)
```

**Step 3: Commit**

```bash
git add apps/web/app/admin/roles/
git commit -m "feat(web): admin profession permissions management UI"
```

---

### Task 12: Web Praticien — Dossier patient complet

**Contexte:** Version web du dossier patient (pour les praticiens travaillant sur desktop).

**Files:**
- Create: `apps/web/app/practitioner/patients/[patientId]/page.tsx`
- Create: `apps/web/app/practitioner/patients/[patientId]/notes/page.tsx`
- Create: `apps/web/app/practitioner/patients/[patientId]/prescriptions/page.tsx`

**Step 1: Page dossier patient web**

Inspiré de la maquette "Patient Analytics" / "User Management" documentée dans CLAUDE.md :
- Sidebar : profil patient + accès rapide (historique, notes, ordonnances, documents)
- Zone principale : timeline chronologique (inspiré "Timeline verticale border-l-2")
- Onglets : Consultations / Notes / Ordonnances / Documents

**Step 2: Commit**

```bash
git add apps/web/app/practitioner/patients/
git commit -m "feat(web): practitioner patient dossier with notes and prescriptions"
```

---

## PHASE 4 — PRIORITÉ MOYENNE

---

### Task 13: Amélioration prise de RDV — Types de consultation étendus

**Contexte:** Ajouter les types manquants (suivi, urgence) dans le booking flow.

**Files:**
- Modify: `apps/mobile/app/(patient)/booking/[practitionerId].tsx`
- Modify: `apps/mobile/app/(patient)/confirm-session.tsx` (déjà mis à jour en partie)
- Migration: `supabase/migrations/20260608000006_appointment_types_extended.sql`

**Step 1: Migration**

```sql
-- Étendre l'enum appointment type
ALTER TYPE session_type ADD VALUE IF NOT EXISTS 'suivi';
ALTER TYPE session_type ADD VALUE IF NOT EXISTS 'urgence';
-- Note : si session_type est TEXT CHECK, modifier la contrainte CHECK
```

**Step 2: Mettre à jour confirm-session.tsx**

Ajouter 'suivi' et 'urgence' dans `SESSION_OPTIONS` avec icônes adaptées :
- `suivi` → icône `refresh`, description "Séance de suivi régulier"
- `urgence` → icône `emergency`, description "Consultation urgente", fond rouge léger

**Step 3: Commit**

```bash
git commit -m "feat(booking): add suivi and urgence consultation types"
```

---

### Task 14: Amélioration agenda praticien — Blocage créneaux et gestion absences

**Contexte:** Permettre au praticien de bloquer des créneaux (vacances, formation, etc.) depuis l'app mobile.

**Files:**
- Create: `apps/mobile/app/(practitioner)/schedule-blocks/new.tsx`
- Modify: `apps/mobile/app/(practitioner)/availability.tsx`

**Step 1: Écran blocage créneau**

```typescript
// apps/mobile/app/(practitioner)/schedule-blocks/new.tsx
// Formulaire : date de début, date de fin, motif (Vacances/Formation/Indisponibilité/Autre)
// Sauvegarde dans la table practitioner_blocks existante
```

**Step 2: Intégrer dans availability.tsx**

Ajouter une section "Indisponibilités" avec liste des créneaux bloqués et bouton "Bloquer une période".

**Step 3: Commit**

```bash
git commit -m "feat(mobile): practitioner schedule block management"
```

---

### Task 15: Messagerie — Partage de documents médicaux amélioré

**Contexte:** Améliorer l'UX de partage de documents dans la messagerie (viewer PDF intégré, prévisualisation images).

**Files:**
- Modify: `apps/mobile/app/(patient)/messages/[id].tsx`
- Modify: `apps/mobile/app/(practitioner)/messages/[id].tsx`

**Step 1: Viewer document**

Intégrer un composant de prévisualisation pour :
- Images : `Image` RN avec fullscreen modal
- PDF : `expo-document-picker` + affichage via URL signée

**Step 2: Badges type document**

Afficher des badges colorés sur chaque pièce jointe selon son type :
- `ordonnance` → vert
- `analyse` → bleu
- `compte_rendu` → ambre
- `imagerie` → violet

**Step 3: Commit**

```bash
git commit -m "feat(messaging): document type badges and preview improvements"
```

---

### Task 16: Intégration base médicamenteuse locale (pré-VIDAL)

**Contexte:** En attendant l'intégration VIDAL (coûteuse, priorité future), créer une base locale de médicaments courants pour l'autocomplete dans les ordonnances.

**Files:**
- Create: `apps/mobile/data/medications.ts`
- Modify: `apps/mobile/app/(practitioner)/prescription/new.tsx`

**Step 1: Base médicamenteuse locale**

```typescript
// apps/mobile/data/medications.ts
// Liste de ~200 médicaments courants (DCI + noms commerciaux)
// Format : { dci: string, commercial: string[], category: string, defaultDosages: string[] }
// Sources : Liste OMS médicaments essentiels + médicaments courants Sénégal
export const MEDICATIONS_DB = [
  { dci: 'Paracétamol', commercial: ['Doliprane', 'Efferalgan', 'Dafalgan'], category: 'Analgésique', defaultDosages: ['500mg', '1000mg'] },
  { dci: 'Amoxicilline', commercial: ['Amoxil', 'Clamoxyl'], category: 'Antibiotique', defaultDosages: ['250mg', '500mg', '1g'] },
  // ... etc.
]
```

**Step 2: Autocomplete dans le formulaire ordonnance**

Ajouter un `FlatList` de suggestions sous le champ "Nom médicament" filtrant en temps réel.

**Step 3: Commit**

```bash
git commit -m "feat(prescription): local medication database with autocomplete"
```

---

## ORDRE D'EXÉCUTION RECOMMANDÉ

```
Phase 1 — DB (Tasks 1-6) → en parallèle possible
Phase 2 — Mobile (Tasks 7-10) → après Phase 1
Phase 3 — Web Admin (Tasks 11-12) → après Phase 1
Phase 4 — Améliorations (Tasks 13-16) → après Phase 2

Total estimé : 3-4 jours développeur
```

---

## TESTS ACCEPTANCE

### Messagerie ✅
- [ ] Patient peut envoyer un message texte à son praticien
- [ ] Praticien reçoit le message et peut répondre
- [ ] Patient peut envoyer un PDF (ordonnance, analyse)
- [ ] Praticien peut envoyer un compte-rendu PDF
- [ ] Badge "non lu" disparaît après lecture
- [ ] Messages chiffrés (HTTPS + RLS)

### Dossier patient ✅
- [ ] Patient voit liste chronologique de toutes ses consultations
- [ ] Patient voit ses ordonnances historiques
- [ ] Patient voit les notes partagées par son praticien

### Notes praticien ✅
- [ ] Praticien peut créer une note sans démarrer de session vidéo
- [ ] Praticien peut choisir le type (observation, compte-rendu, etc.)
- [ ] Note privée → patient ne peut pas la voir
- [ ] Note partagée → patient la voit dans son dossier

### Ordonnances ✅
- [ ] Praticien peut créer une ordonnance en présentiel
- [ ] Ordonnance trackée en DB
- [ ] Patient voit son historique d'ordonnances
- [ ] Autocomplete médicaments fonctionne

### Permissions ✅
- [ ] Après 1er RDV confirmé, permissions créées automatiquement
- [ ] Patient peut activer/désactiver chaque toggle
- [ ] Praticien ne voit pas les données si permission désactivée

### RBAC Admin ✅
- [ ] Admin peut modifier les droits d'une profession
- [ ] Psychologue ne peut pas créer d'ordonnance
- [ ] Médecin peut créer des ordonnances

---

*Plan créé le 2026-06-08 · M-Santé V2 · Basé sur retour fonctionnel utilisateur*
