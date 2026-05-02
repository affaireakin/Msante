# Téléconsultation Vidéo — Design Document

**Date :** 2026-05-02  
**Statut :** Approuvé  
**Périmètre :** Patient mobile (React Native) + Praticien web (Next.js)

---

## Objectif

Implémenter le flow complet de téléconsultation vidéo : salle d'attente → session Daily.co → chat Supabase Realtime → bilan IA (Claude Haiku) + ordonnance PDF.

---

## Architecture

### Approche retenue : Room-on-demand

La room Daily.co est créée au moment où le patient clique "Rejoindre" (~30 min avant le RDV). Pas de rooms orphelines, délai de création ~300ms imperceptible sur l'écran de salle d'attente.

### Flow complet

```
RDV confirmé + payé (booking-success)
    ↓
[Patient] Bouton "Rejoindre" (30min avant)
    → Edge Function create-consultation-room
    → Daily.co REST API → room_name + room_url + patient_token + practitioner_token
    → INSERT consultations (status: waiting)
    ↓
[Patient Mobile]   waiting.tsx → session.tsx (DailyMediaView)
[Praticien Web]    waiting/page.tsx → session/page.tsx (@daily-co/react-daily)
    ↓
Praticien rejoint → join-consultation Edge Function → status: active → timer démarre
Chat : Supabase Realtime broadcast (canal consultation:{id})
    ↓
End session → end-consultation Edge Function:
  1. status: ended, ended_at, duration_actual_min
  2. Sauvegarde chat_history final
  3. Claude Haiku → ai_summary (3-4 phrases, jamais de diagnostic)
    ↓
Bilan : summary.tsx (mobile) + summary/page.tsx (web)
Praticien upload ordonnance PDF → Supabase Storage prescriptions/{id}.pdf
→ Notification push patient "Ordonnance disponible"
```

---

## Base de données

### Migration : table `consultations`

```sql
CREATE TABLE public.consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  room_name TEXT,
  room_url TEXT,
  patient_token TEXT,
  practitioner_token TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_actual_min INT,
  chat_history JSONB DEFAULT '[]',
  ai_summary TEXT,
  prescription_url TEXT,
  status TEXT DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'active', 'ended')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_consultations_appointment ON consultations(appointment_id);
CREATE INDEX idx_consultations_status ON consultations(status);
```

### RLS

```sql
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;

-- Patient voit ses consultations
CREATE POLICY "patient_own_consultations" ON consultations
  FOR ALL USING (
    appointment_id IN (
      SELECT id FROM appointments WHERE patient_id = auth.uid()
    )
  );

-- Praticien voit ses consultations
CREATE POLICY "practitioner_own_consultations" ON consultations
  FOR ALL USING (
    appointment_id IN (
      SELECT a.id FROM appointments a
      JOIN practitioners p ON p.id = a.practitioner_id
      WHERE p.user_id = auth.uid()
    )
  );

-- Admin voit tout
CREATE POLICY "admin_all_consultations" ON consultations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );
```

### Migration : bucket prescriptions

```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('prescriptions', 'prescriptions', false);

CREATE POLICY "practitioner_upload_prescription" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'prescriptions' AND
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'practitioner')
  );

CREATE POLICY "patient_read_own_prescription" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'prescriptions' AND
    name = (
      SELECT consultation_id::text || '.pdf'
      FROM consultations c
      JOIN appointments a ON a.id = c.appointment_id
      WHERE a.patient_id = auth.uid()
      LIMIT 1
    )
  );
```

---

## Edge Functions (Supabase / Deno)

### 1. `create-consultation-room`

**Déclencheur :** Patient clique "Rejoindre" (POST avec `{ appointmentId }`)

```typescript
// 1. Vérifie appointment confirmed + payé + patient = auth.uid()
// 2. Vérifie qu'il n'y a pas déjà une consultation active
// 3. Daily.co REST API POST /rooms
const room = await fetch('https://api.daily.co/v1/rooms', {
  method: 'POST',
  headers: { Authorization: `Bearer ${Deno.env.get('DAILY_API_KEY')}` },
  body: JSON.stringify({
    name: `msante-${appointmentId}`,
    properties: {
      exp: Math.floor(Date.now() / 1000) + 3600 * 2, // 2h
      max_participants: 2,
      enable_chat: false, // chat via Supabase Realtime
      enable_screenshare: false,
    }
  })
})
// 4. Génère patient_token + practitioner_token (Daily.co meeting tokens)
// 5. INSERT consultations
// 6. Return { consultationId, roomUrl, patientToken }
```

### 2. `join-consultation`

**Déclencheur :** Praticien clique "Démarrer" (POST avec `{ consultationId }`)

```typescript
// 1. Vérifie praticien = auth.uid() sur l'appointment lié
// 2. Récupère practitioner_token de la consultation
// 3. UPDATE consultations SET started_at = NOW(), status = 'active'
// 4. Return { practitionerToken, roomUrl }
```

### 3. `end-consultation`

**Déclencheur :** L'un ou l'autre termine (POST avec `{ consultationId, chatHistory, notes? }`)

```typescript
// 1. UPDATE status = 'ended', ended_at, chat_history, duration_actual_min
// 2. Claude Haiku → ai_summary
const summary = await anthropic.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 400,
  system: `Tu es un assistant médical. Génère un compte-rendu factuel
           et bienveillant de la session de téléconsultation.
           JAMAIS de diagnostic. JAMAIS de prescription médicale.
           Format: 3-4 phrases, ton professionnel et rassurant.`,
  messages: [{ role: 'user', content: JSON.stringify({ chat: chatHistory, notes }) }]
})
// 3. UPDATE consultations SET ai_summary
// 4. DELETE Daily.co room (cleanup)
```

---

## Packages

### Mobile (`apps/mobile/`)

```bash
pnpm --filter mobile add @daily-co/react-native-daily-js
pnpm --filter mobile add expo-web-browser  # pour ouvrir PDF ordonnance
```

### Web (`apps/web/`)

```bash
pnpm --filter web add @daily-co/react-daily
```

---

## Écrans patient mobile

### 1. `app/(patient)/consultation/waiting.tsx`

**Design :** Fidèle à `video_consultation_1/code.html` — salle d'attente glassmorphique.

- Avatar praticien + nom + spécialité
- Compte à rebours animé jusqu'au RDV
- Indicateur statut Supabase Realtime : "En attente du praticien…" → passe à "Le praticien est prêt !" quand `status = active`
- Bouton "Rejoindre la session" (appelle `create-consultation-room` si pas encore créée, sinon join direct)
- Bouton "Annuler" (avec confirmation)

### 2. `app/(patient)/consultation/session.tsx`

**Design :** Fidèle à `video_consultation_1/code.html` (plein écran vidéo + contrôles bas).

- `DailyProvider` + `useDaily` hooks de `@daily-co/react-native-daily-js`
- `DailyVideo` praticien plein écran
- Self-view miniature draggable (coin haut droit)
- Timer session (MM:SS) en haut
- Barre contrôles bas : Mute · Camera · Chat · End Session (rouge)
- Panel chat slide-in (bottom sheet) : FlatList + TextInput + Supabase Realtime
- Alert confirmation avant "End Session"

### 3. `app/(patient)/consultation/summary.tsx`

**Design :** GlassCards M-Santé.

- Icône ✅ + "Consultation terminée"
- Card : Praticien, Durée réelle (Xmin), Date
- Card IA : résumé `ai_summary` (Claude Haiku)
- Card ordonnance (si `prescription_url`) : bouton "Télécharger" → `expo-web-browser`
- Bouton "Rebooker" → `/(patient)/booking/[practitionerId]`
- Bouton "Retour accueil"

---

## Écrans praticien web (Next.js)

### 1. `app/practitioner/consultation/[appointmentId]/waiting/page.tsx`

**Design :** Fidèle à `video_consultation_1` (vue desktop).

- Résumé RDV (patient, heure, durée, type)
- Badge "Patient connecté" / "Patient en attente" (Supabase Realtime)
- Bouton "Démarrer la consultation" → `join-consultation` → redirect session

### 2. `app/practitioner/consultation/[appointmentId]/session/page.tsx`

**Design :** Fidèle à `video_consultation_1/code.html` exactement.

- `DailyProvider` + `DailyVideo` (`@daily-co/react-daily`)
- Vidéo patient zone centrale
- Self-view praticien coin haut droit
- Sidebar droite : onglets Chat / Notes (notes privées, non envoyées au patient)
- Contrôles : Mute · Camera · Terminer (rouge)
- Timer HH:MM:SS

### 3. `app/practitioner/consultation/[appointmentId]/summary/page.tsx`

**Design :** Fidèle à `video_consultation_2/code.html`.

- Durée réelle, transcript chat
- Résumé IA affiché
- Upload ordonnance PDF (drag & drop + bouton) → Supabase Storage
- Bouton "Voir dossier patient"

---

## Composant partagé

```
apps/mobile/features/consultation/components/ConsultationTimer.tsx
```
- `useEffect` + `setInterval` 1s
- Calcule MM:SS depuis `startedAt`
- Reanimated 3 pour légère animation de couleur quand > 45min

---

## Sécurité

- Tokens Daily.co jamais exposés côté client avant join — retournés uniquement par les Edge Functions après vérification auth
- `DAILY_API_KEY` dans Supabase Vault uniquement
- RLS strict sur `consultations` + bucket `prescriptions`
- URLs signées pour le PDF (expiration 1h via `createSignedUrl`)
- Audit log sur `end-consultation` (action: `consultation.ended`, resource: consultationId)

---

## Variables d'environnement

```bash
# Supabase Edge Functions (Vault)
DAILY_API_KEY=...
ANTHROPIC_API_KEY=...  # déjà utilisé par ami-chat
```

---

## Garde-fous cliniques IA

```
❌ JAMAIS : Diagnostic médical dans ai_summary
❌ JAMAIS : Prescription de médicament dans ai_summary
✅ TOUJOURS : "Ce résumé ne remplace pas les conseils de votre médecin"
✅ TOUJOURS : Mentionner durée réelle et date
```
