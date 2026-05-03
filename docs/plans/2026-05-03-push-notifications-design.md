# Push Notifications — Design Document

**Date :** 2026-05-03
**Statut :** Approuvé
**Périmètre :** Mobile (Expo push) + fallback email (Resend) + stubs WhatsApp/SMS pour workflow Phase 2

---

## Objectif

Implémenter le système de notifications push M-Santé : enregistrement du token Expo, 6 templates d'événements, rappel automatique 24h avant RDV via `pg_cron`, et un `NotificationService` unifié réutilisable par le moteur workflow Phase 2.

---

## Architecture

### Approche retenue : NotificationService dans `packages/notifications/`

Un package partagé avec adapters. Les Edge Functions existantes l'importent pour émettre des notifications. `pg_cron` déclenche un Edge Function dédié pour les rappels planifiés.

### Flow

```
Action utilisateur (RDV confirmé, paiement, etc.)
    ↓
Edge Function existante (create-appointment, process-payment, join-consultation…)
    → NotificationService.send(event)
        → resolveChannels(user) : push si push_token, email sinon
        → ExpoAdapter ou ResendAdapter
        → INSERT notifications (historique)

pg_cron (toutes les heures)
    → Edge Function send-appointment-reminders
        → appointments WHERE scheduled_at BETWEEN NOW()+23h AND NOW()+25h
        → anti-doublon (table notifications)
        → NotificationService.send() → patient + praticien
```

---

## Base de données

### Migration 1 — `push_token` sur `users`

```sql
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS push_token TEXT,
  ADD COLUMN IF NOT EXISTS push_token_updated_at TIMESTAMPTZ;
```

### Migration 2 — Table `notifications`

```sql
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
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

CREATE INDEX idx_notifications_user_status ON notifications(user_id, status);
CREATE INDEX idx_notifications_type_created ON notifications(type, created_at);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "service_role_manage_notifications" ON notifications
  FOR ALL USING (auth.role() = 'service_role');
```

---

## Package `packages/notifications/`

```
packages/notifications/
├── index.ts
├── types.ts
├── NotificationService.ts
└── adapters/
    ├── ExpoAdapter.ts
    ├── ResendAdapter.ts
    ├── WhatsAppAdapter.stub.ts
    └── SMSAdapter.stub.ts
```

### `types.ts`

```typescript
export type NotificationChannel = 'push' | 'email' | 'whatsapp' | 'sms'

export type NotificationEventType =
  | 'appointment_confirm'
  | 'appointment_reminder'
  | 'payment_success'
  | 'payment_failed'
  | 'consultation_starting'
  | 'practitioner_approved'

export interface NotificationUser {
  id: string
  full_name: string
  email?: string
  push_token?: string | null
}

export interface NotificationEvent {
  type: NotificationEventType
  recipient: NotificationUser
  data: Record<string, string | number>
}

export interface NotificationAdapter {
  send(event: NotificationEvent): Promise<void>
}
```

### `NotificationService.ts`

```typescript
resolveChannels(user: NotificationUser): NotificationChannel[] {
  if (user.push_token) return ['push']
  return ['email']
}
// send() → resolveChannels → adapters → INSERT notifications row
```

### `ExpoAdapter.ts`

Appel direct `POST https://exp.host/--/api/v2/push/send` — pas de SDK serveur, juste `fetch`. Payload :
```json
{
  "to": "<ExponentPushToken>",
  "title": "...",
  "body": "...",
  "data": { "route": "/..." },
  "sound": "default",
  "priority": "high"
}
```

### `ResendAdapter.ts`

`POST https://api.resend.com/emails` avec template HTML minimal par type d'événement. Clé `RESEND_API_KEY` dans Supabase Vault.

### Stubs

`WhatsAppAdapter` et `SMSAdapter` lèvent `new Error('not implemented — use workflow engine')`. Câblés en Phase 2.

---

## Templates de notifications

| Type | Titre | Corps | Route mobile |
|------|-------|-------|-------------|
| `appointment_confirm` | "RDV confirmé ✓" | "Votre RDV avec {practitionerName} le {date} est confirmé." | `/(patient)/booking-success` |
| `appointment_reminder` | "RDV dans 24h 📅" | "Rappel : consultation avec {practitionerName} demain à {time}." | `/(patient)/home` |
| `payment_success` | "Paiement reçu ✓" | "Paiement de {amount} XOF confirmé." | `/(patient)/home` |
| `payment_failed` | "Paiement échoué ⚠️" | "Votre paiement a échoué. Réessayez." | `/(patient)/payment` |
| `consultation_starting` | "Consultation prête 🎥" | "{patientName} a rejoint la salle d'attente." | `/practitioner/consultation/{appointmentId}/waiting` |
| `practitioner_approved` | "Compte approuvé ✓" | "Votre profil praticien a été validé. Vous pouvez recevoir des patients." | `/(practitioner)/home` |

---

## Edge Functions

### Nouvelles

**`register-push-token`** (POST `{ token: string }`)
- Vérifie auth
- `UPDATE users SET push_token = token, push_token_updated_at = NOW() WHERE id = user.id`

**`send-appointment-reminders`** (appelé par pg_cron)
- `SELECT appointments WHERE scheduled_at BETWEEN NOW() + INTERVAL '23 hours' AND NOW() + INTERVAL '25 hours' AND status = 'confirmed'`
- Anti-doublon : `NOT EXISTS (SELECT 1 FROM notifications WHERE type = 'appointment_reminder' AND data->>'appointment_id' = appointment.id)`
- `NotificationService.send()` → patient + praticien

### Modifiées

| Edge Function | Ajout |
|---------------|-------|
| `create-appointment` | `NotificationService.send(appointment_confirm)` → patient + praticien |
| `process-payment` | `NotificationService.send(payment_success ou payment_failed)` → patient |
| `join-consultation` | `NotificationService.send(consultation_starting)` → praticien |

### pg_cron

```sql
SELECT cron.schedule(
  'msante-appointment-reminders',
  '0 * * * *',
  $$SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/send-appointment-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  )$$
);
```

---

## Mobile (`apps/mobile/`)

### Packages

```bash
pnpm --filter mobile add expo-notifications expo-device
```

### `app.json` — plugin

```json
{
  "expo": {
    "plugins": [
      ["expo-notifications", {
        "icon": "./assets/notification-icon.png",
        "color": "#006685",
        "sounds": []
      }]
    ]
  }
}
```

### `features/notifications/hooks/usePushNotifications.ts`

1. `Device.isDevice` check (pas d'émulateur)
2. `Notifications.requestPermissionsAsync()` — iOS
3. `Notifications.getExpoPushTokenAsync({ projectId })` → token
4. `supabase.functions.invoke('register-push-token', { body: { token } })`
5. `addNotificationReceivedListener` → foreground handler
6. `addNotificationResponseReceivedListener` → tap → `router.push(data.route)`

### Intégration

`usePushNotifications()` appelé dans `app/_layout.tsx` après que `isAuthenticated = true`.

---

## Variables d'environnement (Supabase Vault)

```
RESEND_API_KEY=...
EXPO_ACCESS_TOKEN=...   # optionnel — pour Expo Push API authentifiée
```

---

## Sécurité

- `register-push-token` : JWT vérifié, UPDATE limité au `user.id` authentifié
- `send-appointment-reminders` : appelé uniquement par `pg_cron` avec service_role
- RLS `notifications` : SELECT uniquement par le propriétaire, INSERT/UPDATE par service_role
- Tokens Expo jamais loggués, jamais exposés dans les réponses API
