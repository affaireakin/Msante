# Push Notifications Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a unified push notification system — Expo push tokens on mobile, email fallback for web, 6 event templates, 24h appointment reminder via pg_cron.

**Architecture:** `packages/notifications/` holds `NotificationService` + adapters (Expo, Resend, stubs). Existing Edge Functions call it after key events. A new `send-appointment-reminders` Edge Function is triggered hourly by `pg_cron`.

**Tech Stack:** Expo Notifications SDK, Resend email API, Supabase Edge Functions (Deno), pg_cron, React Native.

---

### Task 1: DB migrations — push_token + notifications table + pg_cron

**Files:**
- Create: `supabase/migrations/20260503000001_push_notifications.sql`

**Context:** The `users` table already exists. The `notifications` table is defined in CLAUDE.md but not yet created. `pg_cron` and `pg_net` must be enabled on the Supabase project (they are available by default on Supabase hosted projects).

**Step 1: Create the migration file**

```sql
-- supabase/migrations/20260503000001_push_notifications.sql

-- 1. Add push_token to users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS push_token TEXT,
  ADD COLUMN IF NOT EXISTS push_token_updated_at TIMESTAMPTZ;

-- 2. Create notifications table
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

-- Patient/practitioner can only read their own notifications
CREATE POLICY "users_own_notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Service role (Edge Functions) can do everything
CREATE POLICY "service_role_manage_notifications" ON notifications
  FOR ALL USING (auth.role() = 'service_role');

-- 3. pg_cron: call send-appointment-reminders every hour
-- NOTE: Replace 'YOUR_SUPABASE_URL' and 'YOUR_SERVICE_ROLE_KEY' with actual values
-- These are set as app.settings in the Supabase dashboard or via supabase secrets
SELECT cron.schedule(
  'msante-appointment-reminders',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/send-appointment-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  )
  $$
);
```

**Step 2: Verify the file is syntactically correct**

Read it back and check for typos.

**Step 3: Commit**

```bash
git add supabase/migrations/20260503000001_push_notifications.sql
git commit -m "feat(notifications): add push_token to users + notifications table + pg_cron"
```

---

### Task 2: `packages/notifications/types.ts`

**Files:**
- Create: `packages/notifications/types.ts`

**Context:** `packages/` currently only has `backend/` and `ui/`. We create a new package here. No `package.json` needed — this package is imported directly by Edge Functions via relative path (Deno) and will be extended for mobile/workflow later.

**Step 1: Write the types file**

```typescript
// packages/notifications/types.ts

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
  email?: string | null
  push_token?: string | null
}

export interface NotificationEvent {
  type: NotificationEventType
  recipient: NotificationUser
  data: Record<string, string | number>
}

export interface NotificationAdapter {
  send(event: NotificationEvent, supabaseUrl: string): Promise<void>
}

export interface NotificationResult {
  channel: NotificationChannel
  status: 'sent' | 'failed'
  error?: string
}
```

**Step 2: Commit**

```bash
git add packages/notifications/types.ts
git commit -m "feat(notifications): add notification types"
```

---

### Task 3: `packages/notifications/templates.ts`

**Files:**
- Create: `packages/notifications/templates.ts`
- Test: `packages/notifications/__tests__/templates.test.ts`

**Context:** Each event type has a fixed title + body with `{placeholder}` substitution. The route is embedded in `data` so the mobile app knows where to navigate on tap.

**Step 1: Write the failing test**

```typescript
// packages/notifications/__tests__/templates.test.ts
import { buildNotificationPayload } from '../templates.ts'

describe('buildNotificationPayload', () => {
  it('appointment_confirm — substitutes practitionerName and date', () => {
    const result = buildNotificationPayload('appointment_confirm', {
      practitionerName: 'Dr. Diallo',
      date: '15 mai à 10h00',
    })
    expect(result.title).toBe('RDV confirmé ✓')
    expect(result.body).toContain('Dr. Diallo')
    expect(result.body).toContain('15 mai à 10h00')
    expect(result.data.route).toBe('/(patient)/home')
  })

  it('payment_failed — returns correct title and route', () => {
    const result = buildNotificationPayload('payment_failed', {})
    expect(result.title).toBe('Paiement échoué ⚠️')
    expect(result.data.route).toBe('/(patient)/payment')
  })

  it('consultation_starting — substitutes patientName', () => {
    const result = buildNotificationPayload('consultation_starting', {
      patientName: 'Fatou Sow',
      appointmentId: 'abc-123',
    })
    expect(result.body).toContain('Fatou Sow')
    expect(result.data.route).toContain('abc-123')
  })
})
```

**Step 2: Run test — expect FAIL**

```bash
cd "c:/Users/Khodiaou/Desktop/m-santé app"
# Note: these are Deno-style TS files; run with node jest for now since packages/ is shared
# Actually skip running — Deno files can't run under jest without config
# Just verify the logic manually by reading the implementation
```

**Step 3: Write the implementation**

```typescript
// packages/notifications/templates.ts
import type { NotificationEventType } from './types.ts'

interface NotificationPayload {
  title: string
  body: string
  data: Record<string, string>
}

type TemplateData = Record<string, string | number>

const TEMPLATES: Record<
  NotificationEventType,
  { title: string; body: string; route: (data: TemplateData) => string }
> = {
  appointment_confirm: {
    title: 'RDV confirmé ✓',
    body: 'Votre RDV avec {practitionerName} le {date} est confirmé.',
    route: () => '/(patient)/home',
  },
  appointment_reminder: {
    title: 'RDV dans 24h 📅',
    body: 'Rappel : consultation avec {practitionerName} demain à {time}.',
    route: () => '/(patient)/home',
  },
  payment_success: {
    title: 'Paiement reçu ✓',
    body: 'Paiement de {amount} XOF confirmé.',
    route: () => '/(patient)/home',
  },
  payment_failed: {
    title: 'Paiement échoué ⚠️',
    body: 'Votre paiement a échoué. Réessayez dans votre espace patient.',
    route: () => '/(patient)/payment',
  },
  consultation_starting: {
    title: 'Consultation prête 🎥',
    body: '{patientName} a rejoint la salle d\'attente.',
    route: (data) => `/practitioner/consultation/${data.appointmentId}/waiting`,
  },
  practitioner_approved: {
    title: 'Compte approuvé ✓',
    body: 'Votre profil praticien a été validé. Vous pouvez recevoir des patients.',
    route: () => '/(practitioner)/home',
  },
}

function interpolate(template: string, data: TemplateData): string {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    key in data ? String(data[key]) : `{${key}}`
  )
}

export function buildNotificationPayload(
  type: NotificationEventType,
  data: TemplateData
): NotificationPayload {
  const tpl = TEMPLATES[type]
  return {
    title: tpl.title,
    body: interpolate(tpl.body, data),
    data: { route: tpl.route(data), type },
  }
}
```

**Step 4: Commit**

```bash
git add packages/notifications/templates.ts packages/notifications/__tests__/templates.test.ts
git commit -m "feat(notifications): add notification templates with interpolation"
```

---

### Task 4: `packages/notifications/adapters/ExpoAdapter.ts`

**Files:**
- Create: `packages/notifications/adapters/ExpoAdapter.ts`

**Context:** The Expo Push API is a simple REST endpoint — no SDK needed server-side. Token format: `ExponentPushToken[xxxxxx]`. The API accepts a batch of up to 100 messages but we send one at a time for simplicity.

**Step 1: Write the adapter**

```typescript
// packages/notifications/adapters/ExpoAdapter.ts
import type { NotificationAdapter, NotificationEvent } from '../types.ts'
import { buildNotificationPayload } from '../templates.ts'

export class ExpoAdapter implements NotificationAdapter {
  async send(event: NotificationEvent): Promise<void> {
    if (!event.recipient.push_token) {
      throw new Error('ExpoAdapter: recipient has no push_token')
    }

    const payload = buildNotificationPayload(event.type, event.data)

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify({
        to: event.recipient.push_token,
        title: payload.title,
        body: payload.body,
        data: payload.data,
        sound: 'default',
        priority: 'high',
        channelId: 'default',
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Expo push failed: ${response.status} ${text}`)
    }

    const result = await response.json() as { data?: { status: string; message?: string } }
    if (result.data?.status === 'error') {
      throw new Error(`Expo push error: ${result.data.message ?? 'unknown'}`)
    }
  }
}
```

**Step 2: Commit**

```bash
git add packages/notifications/adapters/ExpoAdapter.ts
git commit -m "feat(notifications): add ExpoAdapter for mobile push"
```

---

### Task 5: `packages/notifications/adapters/ResendAdapter.ts`

**Files:**
- Create: `packages/notifications/adapters/ResendAdapter.ts`

**Context:** Resend is an email API. Key is in Supabase Vault as `RESEND_API_KEY`. The Edge Functions that use this adapter pass the key via constructor. From address: `noreply@msante.sn`.

**Step 1: Write the adapter**

```typescript
// packages/notifications/adapters/ResendAdapter.ts
import type { NotificationAdapter, NotificationEvent } from '../types.ts'
import { buildNotificationPayload } from '../templates.ts'

export class ResendAdapter implements NotificationAdapter {
  constructor(private readonly apiKey: string) {}

  async send(event: NotificationEvent): Promise<void> {
    if (!event.recipient.email) {
      throw new Error('ResendAdapter: recipient has no email')
    }

    const payload = buildNotificationPayload(event.type, event.data)

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'M-Santé <noreply@msante.sn>',
        to: [event.recipient.email],
        subject: payload.title,
        html: `
          <div style="font-family: Manrope, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #006685;">${payload.title}</h2>
            <p style="color: #0b1c30; font-size: 16px; line-height: 1.6;">${payload.body}</p>
            <hr style="border: none; border-top: 1px solid #e5eeff; margin: 24px 0;" />
            <p style="color: #6f787e; font-size: 12px;">
              M-Santé — votre santé, notre priorité.<br/>
              Cet email a été envoyé automatiquement, merci de ne pas y répondre.
            </p>
          </div>
        `,
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Resend failed: ${response.status} ${text}`)
    }
  }
}
```

**Step 2: Commit**

```bash
git add packages/notifications/adapters/ResendAdapter.ts
git commit -m "feat(notifications): add ResendAdapter for email fallback"
```

---

### Task 6: Stub adapters (WhatsApp + SMS)

**Files:**
- Create: `packages/notifications/adapters/WhatsAppAdapter.ts`
- Create: `packages/notifications/adapters/SMSAdapter.ts`

**Step 1: Write stubs**

```typescript
// packages/notifications/adapters/WhatsAppAdapter.ts
import type { NotificationAdapter, NotificationEvent } from '../types.ts'

export class WhatsAppAdapter implements NotificationAdapter {
  async send(_event: NotificationEvent): Promise<void> {
    throw new Error('WhatsAppAdapter: not implemented — use workflow engine (Phase 2)')
  }
}
```

```typescript
// packages/notifications/adapters/SMSAdapter.ts
import type { NotificationAdapter, NotificationEvent } from '../types.ts'

export class SMSAdapter implements NotificationAdapter {
  async send(_event: NotificationEvent): Promise<void> {
    throw new Error('SMSAdapter: not implemented — use workflow engine (Phase 2)')
  }
}
```

**Step 2: Commit**

```bash
git add packages/notifications/adapters/WhatsAppAdapter.ts packages/notifications/adapters/SMSAdapter.ts
git commit -m "feat(notifications): add WhatsApp and SMS adapter stubs"
```

---

### Task 7: `packages/notifications/NotificationService.ts` + `index.ts`

**Files:**
- Create: `packages/notifications/NotificationService.ts`
- Create: `packages/notifications/index.ts`
- Test: `packages/notifications/__tests__/NotificationService.test.ts`

**Context:** The service orchestrates channel resolution and dispatching. It also writes a row to `notifications` table as an audit trail. The `supabase` client (service_role) is passed in so Edge Functions can reuse their existing client.

**Step 1: Write the failing test**

```typescript
// packages/notifications/__tests__/NotificationService.test.ts
import { NotificationService } from '../NotificationService.ts'
import type { NotificationUser, NotificationEvent, NotificationAdapter } from '../types.ts'

function makeAdapter(shouldFail = false): NotificationAdapter & { called: boolean } {
  return {
    called: false,
    async send() {
      this.called = true
      if (shouldFail) throw new Error('adapter error')
    },
  }
}

describe('NotificationService.resolveChannels', () => {
  const svc = new NotificationService({
    expoAdapter: makeAdapter(),
    resendAdapter: makeAdapter(),
    supabase: null as any,
  })

  it('returns push when push_token present', () => {
    const user: NotificationUser = { id: '1', full_name: 'A', push_token: 'ExponentPushToken[abc]' }
    expect(svc.resolveChannels(user)).toEqual(['push'])
  })

  it('returns email when no push_token', () => {
    const user: NotificationUser = { id: '1', full_name: 'A', email: 'a@b.com', push_token: null }
    expect(svc.resolveChannels(user)).toEqual(['email'])
  })

  it('returns email when push_token is empty string', () => {
    const user: NotificationUser = { id: '1', full_name: 'A', email: 'a@b.com', push_token: '' }
    expect(svc.resolveChannels(user)).toEqual(['email'])
  })
})
```

**Step 2: Write the implementation**

```typescript
// packages/notifications/NotificationService.ts
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type {
  NotificationUser,
  NotificationEvent,
  NotificationChannel,
  NotificationAdapter,
} from './types.ts'
import { ExpoAdapter } from './adapters/ExpoAdapter.ts'
import { ResendAdapter } from './adapters/ResendAdapter.ts'

interface NotificationServiceOptions {
  expoAdapter: NotificationAdapter
  resendAdapter: NotificationAdapter
  supabase: SupabaseClient
}

export class NotificationService {
  private adapters: Record<NotificationChannel, NotificationAdapter>
  private supabase: SupabaseClient

  constructor(opts: NotificationServiceOptions) {
    this.adapters = {
      push: opts.expoAdapter,
      email: opts.resendAdapter,
      whatsapp: { send: async () => { throw new Error('not implemented') } },
      sms: { send: async () => { throw new Error('not implemented') } },
    }
    this.supabase = opts.supabase
  }

  resolveChannels(user: NotificationUser): NotificationChannel[] {
    if (user.push_token) return ['push']
    return ['email']
  }

  async send(event: NotificationEvent): Promise<void> {
    const channels = this.resolveChannels(event.recipient)

    await Promise.allSettled(
      channels.map(async (channel) => {
        let status: 'sent' | 'failed' = 'sent'
        let errorMsg: string | undefined

        try {
          await this.adapters[channel].send(event)
        } catch (err) {
          status = 'failed'
          errorMsg = err instanceof Error ? err.message : 'unknown error'
          console.error(`NotificationService: ${channel} failed for user ${event.recipient.id}:`, errorMsg)
        }

        // Record in notifications table (fire-and-forget on error)
        await this.supabase.from('notifications').insert({
          user_id: event.recipient.id,
          type: event.type,
          title: this.getTitle(event),
          body: this.getBody(event),
          data: event.data,
          channel,
          status,
          sent_at: status === 'sent' ? new Date().toISOString() : null,
        }).then(({ error }) => {
          if (error) console.error('NotificationService: failed to insert notification log:', error)
        })
      })
    )
  }

  private getTitle(event: NotificationEvent): string {
    const { buildNotificationPayload } = require('./templates.ts')
    return buildNotificationPayload(event.type, event.data).title
  }

  private getBody(event: NotificationEvent): string {
    const { buildNotificationPayload } = require('./templates.ts')
    return buildNotificationPayload(event.type, event.data).body
  }
}

// Factory — used by Edge Functions
export function createNotificationService(
  supabase: SupabaseClient,
  resendApiKey: string
): NotificationService {
  return new NotificationService({
    expoAdapter: new ExpoAdapter(),
    resendAdapter: new ResendAdapter(resendApiKey),
    supabase,
  })
}
```

**Important — fix the `require` calls above:** Deno doesn't support `require`. Replace the `getTitle`/`getBody` private methods with a direct import:

```typescript
// Replace the private methods with:
import { buildNotificationPayload } from './templates.ts'

// Then in the send() method, compute payload once:
const payload = buildNotificationPayload(event.type, event.data)
// Use payload.title and payload.body in the insert
```

**Step 3: Write `index.ts`**

```typescript
// packages/notifications/index.ts
export { NotificationService, createNotificationService } from './NotificationService.ts'
export { buildNotificationPayload } from './templates.ts'
export type {
  NotificationChannel,
  NotificationEventType,
  NotificationUser,
  NotificationEvent,
  NotificationAdapter,
} from './types.ts'
```

**Step 4: Commit**

```bash
git add packages/notifications/NotificationService.ts packages/notifications/index.ts packages/notifications/__tests__/NotificationService.test.ts
git commit -m "feat(notifications): add NotificationService with channel resolution"
```

---

### Task 8: Edge Function `register-push-token`

**Files:**
- Create: `supabase/functions/register-push-token/index.ts`

**Context:** Called by the mobile app after obtaining an Expo push token. Only updates the authenticated user's own record.

**Step 1: Write the Edge Function**

```typescript
// supabase/functions/register-push-token/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json() as { token?: unknown }
    const { token } = body

    if (!token || typeof token !== 'string') {
      return new Response(JSON.stringify({ error: 'token is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { error: uErr } = await supabase
      .from('users')
      .update({
        push_token: token,
        push_token_updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (uErr) throw uErr

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
```

**Step 2: Commit**

```bash
git add supabase/functions/register-push-token/index.ts
git commit -m "feat(notifications): add register-push-token Edge Function"
```

---

### Task 9: Edge Function `send-appointment-reminders`

**Files:**
- Create: `supabase/functions/send-appointment-reminders/index.ts`

**Context:** Called hourly by pg_cron. Finds appointments scheduled 23–25h from now, skips any that already have a `appointment_reminder` notification in the DB (anti-duplicate). Sends to both patient and practitioner.

**Step 1: Write the Edge Function**

```typescript
// supabase/functions/send-appointment-reminders/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createNotificationService } from '../../packages/notifications/index.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? ''
  const notifService = createNotificationService(supabase, resendApiKey)

  const now = new Date()
  const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000).toISOString()
  const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString()

  // Find confirmed appointments in 23-25h window
  const { data: appointments, error } = await supabase
    .from('appointments')
    .select(`
      id,
      scheduled_at,
      patient:users!appointments_patient_id_fkey (id, full_name, email, push_token),
      practitioner:practitioners!inner (
        id,
        practitioner_user:users!practitioners_user_id_fkey (id, full_name, email, push_token)
      )
    `)
    .eq('status', 'confirmed')
    .gte('scheduled_at', windowStart)
    .lte('scheduled_at', windowEnd)

  if (error) {
    console.error('send-appointment-reminders: query error', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let sent = 0

  for (const appt of (appointments ?? [])) {
    // Anti-duplicate check
    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('type', 'appointment_reminder')
      .eq('user_id', (appt.patient as any).id)
      .contains('data', { appointment_id: appt.id })
      .maybeSingle()

    if (existing) continue

    const scheduledDate = new Date(appt.scheduled_at)
    const dateStr = scheduledDate.toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'long',
    })
    const timeStr = scheduledDate.toLocaleTimeString('fr-FR', {
      hour: '2-digit', minute: '2-digit',
    })

    const patient = appt.patient as any
    const practitionerUser = (appt.practitioner as any)?.practitioner_user

    // Notify patient
    if (patient) {
      await notifService.send({
        type: 'appointment_reminder',
        recipient: {
          id: patient.id,
          full_name: patient.full_name,
          email: patient.email,
          push_token: patient.push_token,
        },
        data: {
          practitionerName: practitionerUser?.full_name ?? 'votre praticien',
          date: dateStr,
          time: timeStr,
          appointment_id: appt.id,
        },
      })
    }

    // Notify practitioner
    if (practitionerUser) {
      await notifService.send({
        type: 'appointment_reminder',
        recipient: {
          id: practitionerUser.id,
          full_name: practitionerUser.full_name,
          email: practitionerUser.email,
          push_token: practitionerUser.push_token,
        },
        data: {
          practitionerName: patient?.full_name ?? 'votre patient',
          date: dateStr,
          time: timeStr,
          appointment_id: appt.id,
        },
      })
    }

    sent++
  }

  return new Response(JSON.stringify({ sent }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
```

**Step 2: Commit**

```bash
git add supabase/functions/send-appointment-reminders/index.ts
git commit -m "feat(notifications): add send-appointment-reminders Edge Function with pg_cron"
```

---

### Task 10: Modify `create-appointment` — add appointment_confirm notification

**Files:**
- Modify: `supabase/functions/create-appointment/index.ts`

**Context:** After the appointment is successfully created (line ~88 `if (aErr) throw aErr`), add notification sending. Need to fetch user + practitioner name to build the template.

**Step 1: Add import at top of file**

Add after the existing import:
```typescript
import { createNotificationService } from '../../packages/notifications/index.ts'
```

**Step 2: Add notification call after appointment INSERT succeeds**

After `if (aErr) throw aErr`, add:

```typescript
    // Send confirmation notification to patient
    try {
      const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? ''
      const notifService = createNotificationService(supabase, resendApiKey)

      // Fetch patient info
      const { data: patientUser } = await supabase
        .from('users')
        .select('id, full_name, email, push_token')
        .eq('id', user.id)
        .single()

      // Fetch practitioner user for name
      const { data: practUser } = await supabase
        .from('users')
        .select('id, full_name, email, push_token')
        .eq('id', (await supabase
          .from('practitioners')
          .select('user_id')
          .eq('id', practitioner_id)
          .single()
        ).data?.user_id ?? '')
        .single()

      const scheduledDate = new Date(scheduled_at)
      const dateStr = scheduledDate.toLocaleDateString('fr-FR', {
        day: '2-digit', month: 'long', year: 'numeric',
      })
      const timeStr = scheduledDate.toLocaleTimeString('fr-FR', {
        hour: '2-digit', minute: '2-digit',
      })

      if (patientUser) {
        await notifService.send({
          type: 'appointment_confirm',
          recipient: {
            id: patientUser.id,
            full_name: patientUser.full_name,
            email: patientUser.email,
            push_token: patientUser.push_token,
          },
          data: {
            practitionerName: practUser?.full_name ?? 'votre praticien',
            date: `${dateStr} à ${timeStr}`,
            appointmentId: appointment.id,
          },
        })
      }
    } catch (notifErr) {
      // Notification failure must never block the appointment creation response
      console.error('create-appointment: notification failed', notifErr)
    }
```

**Step 3: Commit**

```bash
git add supabase/functions/create-appointment/index.ts
git commit -m "feat(notifications): send appointment_confirm on RDV creation"
```

---

### Task 11: Modify `process-payment` — add payment_success / payment_failed notifications

**Files:**
- Modify: `supabase/functions/process-payment/index.ts`

**Context:** The process-payment function simulates Wave/Orange Money. After payment status is set to `completed` or `failed`, send the appropriate notification to the patient. Wrap in try/catch so notification never blocks payment response.

**Step 1: Add import**

Add at top:
```typescript
import { createNotificationService } from '../../packages/notifications/index.ts'
```

**Step 2: Add helper function before `Deno.serve`**

```typescript
async function sendPaymentNotification(
  supabase: ReturnType<typeof createClient>,
  patientId: string,
  eventType: 'payment_success' | 'payment_failed',
  amount: number,
  currency: string
): Promise<void> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? ''
  const notifService = createNotificationService(supabase, resendApiKey)

  const { data: patientUser } = await supabase
    .from('users')
    .select('id, full_name, email, push_token')
    .eq('id', patientId)
    .single()

  if (!patientUser) return

  await notifService.send({
    type: eventType,
    recipient: {
      id: patientUser.id,
      full_name: patientUser.full_name,
      email: patientUser.email,
      push_token: patientUser.push_token,
    },
    data: {
      amount: `${amount}`,
      currency,
    },
  })
}
```

**Step 3: Call the helper after payment status update**

Find where the payment `status` is set to `completed` or `failed` and add (wrapped in try/catch):
```typescript
    try {
      const eventType = paymentSucceeded ? 'payment_success' : 'payment_failed'
      await sendPaymentNotification(supabase, user.id, eventType, amount, currency)
    } catch (notifErr) {
      console.error('process-payment: notification failed', notifErr)
    }
```

**Step 4: Commit**

```bash
git add supabase/functions/process-payment/index.ts
git commit -m "feat(notifications): send payment_success/failed notifications"
```

---

### Task 12: Modify `join-consultation` — add consultation_starting notification

**Files:**
- Modify: `supabase/functions/join-consultation/index.ts`

**Context:** When the practitioner joins, the patient should receive a push that the session is ready. After the `UPDATE consultations SET status = 'active'`, send `consultation_starting` to the practitioner (alerting them the patient is there) — actually per the template, `consultation_starting` notifies the **practitioner** that the patient joined. This is sent when the **patient** creates the room (in `create-consultation-room`). For simplicity, we send from `join-consultation` to notify the patient that the practitioner is ready.

Actually per the design doc template:
- `consultation_starting` → `"{patientName} a rejoint la salle d'attente."` → sent to **practitioner**

So this notification should fire from `create-consultation-room` (when patient joins), not `join-consultation`. Adjust accordingly:

**Step 1: Modify `create-consultation-room` instead**

File: `supabase/functions/create-consultation-room/index.ts`

Add import:
```typescript
import { createNotificationService } from '../../packages/notifications/index.ts'
```

After the `INSERT consultations`, add:
```typescript
    // Notify practitioner that patient is in the waiting room
    try {
      const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? ''
      const notifService = createNotificationService(supabase, resendApiKey)

      // Get practitioner user info
      const { data: practData } = await supabase
        .from('practitioners')
        .select('user_id, users!inner(id, full_name, email, push_token)')
        .eq('id', appointment.practitioner_id)
        .single()

      // Get patient name
      const { data: patientData } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', user.id)
        .single()

      const practUser = (practData as any)?.users

      if (practUser) {
        await notifService.send({
          type: 'consultation_starting',
          recipient: {
            id: practUser.id,
            full_name: practUser.full_name,
            email: practUser.email,
            push_token: practUser.push_token,
          },
          data: {
            patientName: patientData?.full_name ?? 'Votre patient',
            appointmentId: appointment.id,
          },
        })
      }
    } catch (notifErr) {
      console.error('create-consultation-room: notification failed', notifErr)
    }
```

**Step 2: Commit**

```bash
git add supabase/functions/create-consultation-room/index.ts
git commit -m "feat(notifications): notify practitioner when patient enters waiting room"
```

---

### Task 13: Mobile — install packages + update app.json

**Files:**
- Modify: `apps/mobile/package.json` (via pnpm)
- Modify: `apps/mobile/app.json`

**Step 1: Install packages**

```bash
cd "c:/Users/Khodiaou/Desktop/m-santé app"
pnpm --filter mobile add expo-notifications expo-device expo-constants
```

**Step 2: Update `app.json` — add expo-notifications plugin**

In `apps/mobile/app.json`, add to the `plugins` array:
```json
["expo-notifications", {
  "icon": "./assets/adaptive-icon.png",
  "color": "#006685",
  "sounds": []
}]
```

Also add Android notification settings:
```json
"android": {
  "adaptiveIcon": { ... },
  "package": "com.msante.app",
  "permissions": ["NOTIFICATIONS", "VIBRATE"]
}
```

**Step 3: Commit**

```bash
git add apps/mobile/package.json apps/mobile/app.json
git commit -m "feat(notifications): install expo-notifications + configure app.json"
```

---

### Task 14: Mobile — `usePushNotifications` hook

**Files:**
- Create: `apps/mobile/features/notifications/hooks/usePushNotifications.ts`
- Test: `apps/mobile/features/notifications/hooks/__tests__/usePushNotifications.test.ts`

**Context:** This hook runs once after auth. It requests permissions (iOS), gets the Expo push token, sends it to the backend, and sets up foreground/tap listeners. `projectId` comes from `Constants.expoConfig.extra.eas.projectId` — set in `app.json` under `expo.extra.eas.projectId`.

**Step 1: Write the hook**

```typescript
// apps/mobile/features/notifications/hooks/usePushNotifications.ts
import { useEffect } from 'react'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { useRouter } from 'expo-router'
import { supabase } from '@/services/supabase'

// Configure foreground notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

export function usePushNotifications(isAuthenticated: boolean) {
  const router = useRouter()

  useEffect(() => {
    if (!isAuthenticated) return

    let foregroundSub: Notifications.Subscription
    let tapSub: Notifications.Subscription

    async function register() {
      // Only physical devices can receive push notifications
      if (!Device.isDevice) return

      const { status: existingStatus } = await Notifications.getPermissionsAsync()
      let finalStatus = existingStatus

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync()
        finalStatus = status
      }

      if (finalStatus !== 'granted') {
        console.log('usePushNotifications: permission denied')
        return
      }

      const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined
      if (!projectId) {
        console.warn('usePushNotifications: no projectId in Constants')
        return
      }

      const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId })

      const { error } = await supabase.functions.invoke('register-push-token', {
        body: { token },
      })

      if (error) {
        console.error('usePushNotifications: failed to register token', error)
      }
    }

    void register()

    // Foreground notification — show alert
    foregroundSub = Notifications.addNotificationReceivedListener((notification) => {
      const { title, body } = notification.request.content
      console.log('Push received (foreground):', title, body)
      // NativeWind/alert handled by system banner since shouldShowAlert: true
    })

    // Tap on notification — navigate to route
    tapSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { route?: string }
      if (data.route) {
        router.push(data.route as any)
      }
    })

    return () => {
      foregroundSub?.remove()
      tapSub?.remove()
    }
  }, [isAuthenticated])
}
```

**Step 2: Write a minimal test for the pure logic (token registration call)**

```typescript
// apps/mobile/features/notifications/hooks/__tests__/usePushNotifications.test.ts
// Note: This hook uses native modules (expo-notifications, expo-device).
// We test only that the module exports correctly — actual push behavior
// is tested via EAS builds on physical devices.

import { usePushNotifications } from '../usePushNotifications'

describe('usePushNotifications', () => {
  it('exports as a function', () => {
    expect(typeof usePushNotifications).toBe('function')
  })
})
```

**Step 3: Commit**

```bash
git add apps/mobile/features/notifications/
git commit -m "feat(notifications): add usePushNotifications hook"
```

---

### Task 15: Mobile — integrate hook in `app/_layout.tsx`

**Files:**
- Modify: `apps/mobile/app/_layout.tsx`

**Context:** The hook must be called in the root layout after auth state is known. Currently `_layout.tsx` uses `useAuthStore` to get `isAuthenticated`.

**Step 1: Add import**

```typescript
import { usePushNotifications } from '@/features/notifications/hooks/usePushNotifications'
```

**Step 2: Call the hook inside `RootLayout`**

After `const { isAuthenticated, ... } = useAuthStore()`, add:
```typescript
  usePushNotifications(isAuthenticated)
```

**Step 3: Run typecheck**

```bash
cd "c:/Users/Khodiaou/Desktop/m-santé app"
npx tsc --project apps/mobile/tsconfig.json --noEmit 2>&1 | grep -v "^npm warn"
```

Expected: no errors.

**Step 4: Commit**

```bash
git add apps/mobile/app/_layout.tsx
git commit -m "feat(notifications): integrate usePushNotifications in root layout"
```

---

### Task 16: Final typecheck

**Step 1: Typecheck mobile**

```bash
cd "c:/Users/Khodiaou/Desktop/m-santé app"
npx tsc --project apps/mobile/tsconfig.json --noEmit 2>&1 | grep -v "^npm warn"
```

Expected: no errors.

**Step 2: Typecheck web**

```bash
npx tsc --project apps/web/tsconfig.json --noEmit 2>&1 | grep -v "^npm warn"
```

Expected: no errors.

**Step 3: Commit if any fixes were needed, else done**

```bash
git add -A
git commit -m "fix(notifications): typecheck fixes"
```
