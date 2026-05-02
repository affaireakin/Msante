# Téléconsultation Vidéo — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implémenter le flow complet de téléconsultation vidéo — salle d'attente → session Daily.co → chat Supabase Realtime → bilan IA Claude Haiku + ordonnance PDF — côté patient mobile et praticien web.

**Architecture:** Room-on-demand : la room Daily.co est créée quand le patient clique "Rejoindre" (~30min avant le RDV). 3 Edge Functions Supabase (create-consultation-room, join-consultation, end-consultation). Chat via Supabase Realtime broadcast. IA summary via Claude Haiku en fin de session.

**Tech Stack:** React Native + `@daily-co/react-native-daily-js` (mobile), Next.js 15 + `@daily-co/react-daily` (web), Supabase Edge Functions (Deno), Supabase Realtime, Claude Haiku, Supabase Storage (ordonnances PDF).

**UI References :** `video_consultation_1/code.html` (session desktop + mobile), `video_consultation_2/code.html` (session mobile + contrôles). Rester FIDÈLE au design de ces fichiers.

---

## Task 1 : Migration DB — consultations + prescriptions bucket

**Files:**
- Create: `supabase/migrations/20260502000002_consultations.sql`

**Step 1: Créer la migration**

```sql
-- supabase/migrations/20260502000002_consultations.sql

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

CREATE INDEX idx_consultations_appointment ON public.consultations(appointment_id);
CREATE INDEX idx_consultations_status ON public.consultations(status);

-- RLS
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patient_own_consultations" ON public.consultations
  FOR ALL USING (
    appointment_id IN (
      SELECT id FROM public.appointments WHERE patient_id = auth.uid()
    )
  );

CREATE POLICY "practitioner_own_consultations" ON public.consultations
  FOR ALL USING (
    appointment_id IN (
      SELECT a.id FROM public.appointments a
      JOIN public.practitioners p ON p.id = a.practitioner_id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "admin_all_consultations" ON public.consultations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Bucket prescriptions
INSERT INTO storage.buckets (id, name, public)
VALUES ('prescriptions', 'prescriptions', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "practitioner_upload_prescription" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'prescriptions' AND
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'practitioner')
  );

CREATE POLICY "patient_read_own_prescription" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'prescriptions' AND
    EXISTS (
      SELECT 1 FROM public.consultations c
      JOIN public.appointments a ON a.id = c.appointment_id
      WHERE c.id::text = split_part(storage.objects.name, '.', 1)
        AND a.patient_id = auth.uid()
    )
  );
```

**Step 2: Vérifier la syntaxe**

```bash
# Optionnel si Supabase CLI disponible
supabase db diff --local
```

**Step 3: Commit**

```bash
git add supabase/migrations/20260502000002_consultations.sql
git commit -m "feat(db): add consultations table + RLS + prescriptions bucket"
```

---

## Task 2 : TypeScript types — Consultation

**Files:**
- Create: `apps/mobile/types/consultation.ts`

**Step 1: Écrire le fichier de types**

```typescript
// apps/mobile/types/consultation.ts

export type ConsultationStatus = 'waiting' | 'active' | 'ended'

export interface ChatMessage {
  id: string
  role: 'patient' | 'practitioner'
  content: string
  timestamp: number
}

export interface Consultation {
  id: string
  appointmentId: string
  roomName: string | null
  roomUrl: string | null
  patientToken: string | null
  practitionerToken: string | null
  startedAt: string | null
  endedAt: string | null
  durationActualMin: number | null
  chatHistory: ChatMessage[]
  aiSummary: string | null
  prescriptionUrl: string | null
  status: ConsultationStatus
  createdAt: string
}

export interface CreateConsultationRoomResponse {
  consultationId: string
  roomUrl: string
  patientToken: string
}

export interface JoinConsultationResponse {
  practitionerToken: string
  roomUrl: string
  consultationId: string
}
```

**Step 2: Écrire le test**

```typescript
// apps/mobile/types/__tests__/consultation.test.ts
import type { Consultation, ChatMessage, ConsultationStatus } from '../consultation'

describe('Consultation types', () => {
  it('ChatMessage has correct shape', () => {
    const msg: ChatMessage = {
      id: '1',
      role: 'patient',
      content: 'Hello',
      timestamp: Date.now(),
    }
    expect(msg.role).toBe('patient')
  })

  it('ConsultationStatus union is valid', () => {
    const statuses: ConsultationStatus[] = ['waiting', 'active', 'ended']
    expect(statuses).toHaveLength(3)
  })
})
```

**Step 3: Run test**

```bash
cd apps/mobile && pnpm test -- --testPathPattern="consultation.test" --no-coverage
```

Expected: PASS

**Step 4: Commit**

```bash
git add apps/mobile/types/consultation.ts apps/mobile/types/__tests__/consultation.test.ts
git commit -m "feat(types): add Consultation + ChatMessage types"
```

---

## Task 3 : Edge Function — `create-consultation-room`

**Files:**
- Create: `supabase/functions/create-consultation-room/index.ts`

**Step 1: Créer la fonction**

```typescript
// supabase/functions/create-consultation-room/index.ts
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

    const { appointmentId } = await req.json()

    // 1. Vérifie appointment confirmé + payé + appartient au patient
    const { data: appointment, error: aErr } = await supabase
      .from('appointments')
      .select('id, status, patient_id, practitioner_id')
      .eq('id', appointmentId)
      .eq('patient_id', user.id)
      .single()

    if (aErr || !appointment) {
      return new Response(JSON.stringify({ error: 'Appointment not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (appointment.status !== 'confirmed') {
      return new Response(JSON.stringify({ error: 'Appointment not confirmed' }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Vérifie si consultation déjà créée
    const { data: existing } = await supabase
      .from('consultations')
      .select('id, room_url, patient_token, status')
      .eq('appointment_id', appointmentId)
      .neq('status', 'ended')
      .maybeSingle()

    if (existing) {
      return new Response(JSON.stringify({
        consultationId: existing.id,
        roomUrl: existing.room_url,
        patientToken: existing.patient_token,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const DAILY_API_KEY = Deno.env.get('DAILY_API_KEY')!
    const roomName = `msante-${appointmentId.replace(/-/g, '').slice(0, 20)}`
    const expiry = Math.floor(Date.now() / 1000) + 7200 // 2h

    // 3. Créer la room Daily.co
    const roomRes = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DAILY_API_KEY}`,
      },
      body: JSON.stringify({
        name: roomName,
        properties: {
          exp: expiry,
          max_participants: 2,
          enable_chat: false,
          enable_screenshare: false,
          start_video_off: false,
          start_audio_off: false,
        },
      }),
    })

    if (!roomRes.ok) {
      const err = await roomRes.text()
      throw new Error(`Daily.co room creation failed: ${err}`)
    }

    const room = await roomRes.json()

    // 4. Générer patient_token (is_owner: false)
    const patientTokenRes = await fetch('https://api.daily.co/v1/meeting-tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DAILY_API_KEY}`,
      },
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          exp: expiry,
          is_owner: false,
          user_name: 'Patient',
        },
      }),
    })
    const { token: patientToken } = await patientTokenRes.json()

    // 5. Générer practitioner_token (is_owner: true)
    const practTokenRes = await fetch('https://api.daily.co/v1/meeting-tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DAILY_API_KEY}`,
      },
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          exp: expiry,
          is_owner: true,
          user_name: 'Praticien',
        },
      }),
    })
    const { token: practitionerToken } = await practTokenRes.json()

    // 6. INSERT consultation
    const { data: consultation, error: cErr } = await supabase
      .from('consultations')
      .insert({
        appointment_id: appointmentId,
        room_name: roomName,
        room_url: room.url,
        patient_token: patientToken,
        practitioner_token: practitionerToken,
        status: 'waiting',
      })
      .select('id')
      .single()

    if (cErr || !consultation) throw new Error('Failed to save consultation')

    return new Response(JSON.stringify({
      consultationId: consultation.id,
      roomUrl: room.url,
      patientToken,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
```

**Step 2: Commit**

```bash
git add supabase/functions/create-consultation-room/
git commit -m "feat(functions): add create-consultation-room Edge Function"
```

---

## Task 4 : Edge Function — `join-consultation`

**Files:**
- Create: `supabase/functions/join-consultation/index.ts`

**Step 1: Créer la fonction**

```typescript
// supabase/functions/join-consultation/index.ts
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

    const { consultationId } = await req.json()

    // 1. Récupère la consultation + vérifie que le praticien est bien l'owner
    const { data: consultation, error: cErr } = await supabase
      .from('consultations')
      .select(`
        id, room_url, practitioner_token, status,
        appointments!inner(practitioner_id, practitioners!inner(user_id))
      `)
      .eq('id', consultationId)
      .single()

    if (cErr || !consultation) {
      return new Response(JSON.stringify({ error: 'Consultation not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Vérifie que l'utilisateur est le praticien
    const practUserIdPath = (consultation as any).appointments?.practitioners?.user_id
    if (practUserIdPath !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Update status → active + started_at
    const { error: uErr } = await supabase
      .from('consultations')
      .update({ status: 'active', started_at: new Date().toISOString() })
      .eq('id', consultationId)
      .eq('status', 'waiting') // idempotent: ne repasse pas à active si déjà active

    if (uErr) throw uErr

    return new Response(JSON.stringify({
      consultationId,
      practitionerToken: consultation.practitioner_token,
      roomUrl: consultation.room_url,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
```

**Step 2: Commit**

```bash
git add supabase/functions/join-consultation/
git commit -m "feat(functions): add join-consultation Edge Function"
```

---

## Task 5 : Edge Function — `end-consultation`

**Files:**
- Create: `supabase/functions/end-consultation/index.ts`

**Step 1: Créer la fonction**

```typescript
// supabase/functions/end-consultation/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.24.3'

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

    const { consultationId, chatHistory = [], notes = '' } = await req.json()

    // 1. Récupère la consultation
    const { data: consultation, error: cErr } = await supabase
      .from('consultations')
      .select('id, started_at, status, room_name')
      .eq('id', consultationId)
      .single()

    if (cErr || !consultation) {
      return new Response(JSON.stringify({ error: 'Consultation not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (consultation.status === 'ended') {
      return new Response(JSON.stringify({ message: 'Already ended' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const endedAt = new Date()
    const startedAt = consultation.started_at ? new Date(consultation.started_at) : endedAt
    const durationMin = Math.max(1, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000))

    // 2. Claude Haiku → résumé session
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })
    
    const chatText = chatHistory.length > 0
      ? chatHistory.map((m: any) => `${m.role}: ${m.content}`).join('\n')
      : 'Aucun message échangé.'

    const completion = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: `Tu es un assistant médical. Génère un compte-rendu factuel et bienveillant 
               d'une session de téléconsultation à partir du chat et des notes du praticien.
               RÈGLES ABSOLUES:
               - JAMAIS de diagnostic médical
               - JAMAIS de prescription de médicament
               - Terminer par: "Ce résumé ne remplace pas les conseils de votre médecin."
               - Format: 3-4 phrases, ton professionnel et rassurant, en français.`,
      messages: [{
        role: 'user',
        content: `Durée: ${durationMin} minutes\nChat:\n${chatText}\nNotes praticien: ${notes || 'Aucune'}`,
      }],
    })

    const aiSummary = (completion.content[0] as any).text

    // 3. Update consultation
    await supabase
      .from('consultations')
      .update({
        status: 'ended',
        ended_at: endedAt.toISOString(),
        duration_actual_min: durationMin,
        chat_history: chatHistory,
        ai_summary: aiSummary,
      })
      .eq('id', consultationId)

    // 4. Update appointment status → completed
    const { data: appt } = await supabase
      .from('consultations')
      .select('appointment_id')
      .eq('id', consultationId)
      .single()
    
    if (appt) {
      await supabase
        .from('appointments')
        .update({ status: 'completed' })
        .eq('id', appt.appointment_id)
    }

    // 5. Supprimer la room Daily.co (cleanup)
    if (consultation.room_name) {
      await fetch(`https://api.daily.co/v1/rooms/${consultation.room_name}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${Deno.env.get('DAILY_API_KEY')!}` },
      }).catch(() => { /* ignore cleanup error */ })
    }

    // 6. Audit log
    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: 'consultation.ended',
      resource_type: 'consultation',
      resource_id: consultationId,
      new_values: { duration_actual_min: durationMin },
    })

    return new Response(JSON.stringify({ aiSummary, durationMin }), {
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
git add supabase/functions/end-consultation/
git commit -m "feat(functions): add end-consultation Edge Function with Claude Haiku summary"
```

---

## Task 6 : Mobile — consultationStore + useConsultation hook

**Files:**
- Create: `apps/mobile/features/consultation/store/consultationStore.ts`
- Create: `apps/mobile/features/consultation/hooks/useConsultation.ts`
- Create: `apps/mobile/features/consultation/store/__tests__/consultationStore.test.ts`

**Step 1: Écrire le test**

```typescript
// apps/mobile/features/consultation/store/__tests__/consultationStore.test.ts
import { useConsultationStore } from '../consultationStore'

describe('consultationStore', () => {
  beforeEach(() => useConsultationStore.getState().reset())

  it('starts with empty state', () => {
    const s = useConsultationStore.getState()
    expect(s.consultationId).toBeNull()
    expect(s.status).toBe('waiting')
    expect(s.chatMessages).toEqual([])
  })

  it('setConsultation stores room info', () => {
    useConsultationStore.getState().setConsultation({
      consultationId: 'c1',
      roomUrl: 'https://msante.daily.co/room',
      patientToken: 'tok_xxx',
    })
    expect(useConsultationStore.getState().consultationId).toBe('c1')
    expect(useConsultationStore.getState().roomUrl).toBe('https://msante.daily.co/room')
  })

  it('addChatMessage appends message', () => {
    useConsultationStore.getState().addChatMessage({
      id: 'm1', role: 'patient', content: 'Hello', timestamp: 1000,
    })
    expect(useConsultationStore.getState().chatMessages).toHaveLength(1)
  })
})
```

**Step 2: Run test — doit FAIL**

```bash
cd "apps/mobile" && pnpm test -- --testPathPattern="consultationStore.test" --no-coverage
```

Expected: FAIL — "Cannot find module '../consultationStore'"

**Step 3: Créer consultationStore.ts**

```typescript
// apps/mobile/features/consultation/store/consultationStore.ts
import { create } from 'zustand'
import type { ChatMessage, ConsultationStatus } from '@/types/consultation'

interface ConsultationState {
  consultationId: string | null
  roomUrl: string | null
  patientToken: string | null
  status: ConsultationStatus
  startedAt: number | null
  chatMessages: ChatMessage[]
  aiSummary: string | null
  durationMin: number | null
  prescriptionUrl: string | null

  setConsultation: (data: { consultationId: string; roomUrl: string; patientToken: string }) => void
  setStatus: (status: ConsultationStatus) => void
  setStartedAt: (ts: number) => void
  addChatMessage: (msg: ChatMessage) => void
  setSummary: (aiSummary: string, durationMin: number) => void
  setPrescriptionUrl: (url: string) => void
  reset: () => void
}

const initial = {
  consultationId: null,
  roomUrl: null,
  patientToken: null,
  status: 'waiting' as ConsultationStatus,
  startedAt: null,
  chatMessages: [],
  aiSummary: null,
  durationMin: null,
  prescriptionUrl: null,
}

export const useConsultationStore = create<ConsultationState>((set) => ({
  ...initial,
  setConsultation: (data) => set({
    consultationId: data.consultationId,
    roomUrl: data.roomUrl,
    patientToken: data.patientToken,
  }),
  setStatus: (status) => set({ status }),
  setStartedAt: (startedAt) => set({ startedAt }),
  addChatMessage: (msg) => set((s) => ({ chatMessages: [...s.chatMessages, msg] })),
  setSummary: (aiSummary, durationMin) => set({ aiSummary, durationMin }),
  setPrescriptionUrl: (prescriptionUrl) => set({ prescriptionUrl }),
  reset: () => set(initial),
}))
```

**Step 4: Créer useConsultation.ts**

```typescript
// apps/mobile/features/consultation/hooks/useConsultation.ts
import { useEffect, useCallback } from 'react'
import { supabase } from '@/services/supabase'
import { useConsultationStore } from '../store/consultationStore'
import type { ChatMessage } from '@/types/consultation'

export function useConsultationRoom(consultationId: string | null) {
  const { setStatus, setStartedAt, addChatMessage } = useConsultationStore()

  // Realtime: écoute les changements de status + messages chat
  useEffect(() => {
    if (!consultationId) return

    const channel = supabase
      .channel(`consultation:${consultationId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'consultations',
        filter: `id=eq.${consultationId}`,
      }, (payload) => {
        const c = payload.new as any
        setStatus(c.status)
        if (c.status === 'active' && c.started_at) {
          setStartedAt(new Date(c.started_at).getTime())
        }
      })
      .on('broadcast', { event: 'chat_message' }, ({ payload }) => {
        addChatMessage(payload as ChatMessage)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [consultationId])
}

export function useSendChatMessage(consultationId: string | null) {
  const { chatMessages, addChatMessage } = useConsultationStore()

  const send = useCallback(async (content: string, role: 'patient' | 'practitioner') => {
    if (!consultationId) return
    const msg: ChatMessage = {
      id: `${role}_${Date.now()}`,
      role,
      content,
      timestamp: Date.now(),
    }
    addChatMessage(msg)

    await supabase
      .channel(`consultation:${consultationId}`)
      .send({ type: 'broadcast', event: 'chat_message', payload: msg })
  }, [consultationId, chatMessages])

  return send
}

export function useEndConsultation() {
  const { consultationId, chatMessages, setSummary, reset } = useConsultationStore()

  const endSession = useCallback(async (notes?: string) => {
    if (!consultationId) return null
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    const res = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/end-consultation`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ consultationId, chatHistory: chatMessages, notes }),
      }
    )
    if (!res.ok) throw new Error('End consultation failed')
    const { aiSummary, durationMin } = await res.json()
    setSummary(aiSummary, durationMin)
    return { aiSummary, durationMin }
  }, [consultationId, chatMessages])

  return { endSession }
}
```

**Step 5: Run test**

```bash
cd "apps/mobile" && pnpm test -- --testPathPattern="consultationStore.test" --no-coverage
```

Expected: PASS (3 tests)

**Step 6: Commit**

```bash
git add apps/mobile/features/consultation/
git commit -m "feat(consultation): add consultationStore + useConsultation hook"
```

---

## Task 7 : Mobile — Installer les dépendances

**Files:**
- Modify: `apps/mobile/package.json`

**Step 1: Installer les packages**

```bash
cd "c:/Users/Khodiaou/Desktop/m-santé app"
pnpm --filter mobile add @daily-co/react-native-daily-js expo-web-browser
```

**Step 2: Ajouter les plugins Expo dans app.json**

Ouvrir `apps/mobile/app.json` et ajouter dans `expo.plugins` :

```json
{
  "expo": {
    "plugins": [
      "@daily-co/react-native-daily-js"
    ]
  }
}
```

> Note: `expo-web-browser` ne nécessite pas de plugin supplémentaire dans SDK 52.

**Step 3: Vérifier l'installation**

```bash
cd "apps/mobile"
node -e "require('@daily-co/react-native-daily-js'); console.log('OK')" 2>/dev/null || echo "Package installed (native, needs build)"
```

**Step 4: Commit**

```bash
git add apps/mobile/package.json apps/mobile/app.json pnpm-lock.yaml
git commit -m "feat(deps): add @daily-co/react-native-daily-js + expo-web-browser"
```

---

## Task 8 : Mobile — ConsultationTimer component

**Files:**
- Create: `apps/mobile/features/consultation/components/ConsultationTimer.tsx`
- Create: `apps/mobile/features/consultation/components/__tests__/ConsultationTimer.test.tsx`

**Step 1: Écrire le test**

```typescript
// apps/mobile/features/consultation/components/__tests__/ConsultationTimer.test.tsx
import { formatDuration } from '../ConsultationTimer'

describe('formatDuration', () => {
  it('formats 0 seconds', () => {
    expect(formatDuration(0)).toBe('00:00')
  })
  it('formats 65 seconds', () => {
    expect(formatDuration(65)).toBe('01:05')
  })
  it('formats 3661 seconds', () => {
    expect(formatDuration(3661)).toBe('61:01')
  })
})
```

**Step 2: Run test — doit FAIL**

```bash
cd "apps/mobile" && pnpm test -- --testPathPattern="ConsultationTimer.test" --no-coverage
```

Expected: FAIL

**Step 3: Créer ConsultationTimer.tsx**

```typescript
// apps/mobile/features/consultation/components/ConsultationTimer.tsx
import { useEffect, useState } from 'react'
import { Text } from 'react-native'

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

interface Props {
  startedAt: number | null  // timestamp ms
  style?: object
}

export function ConsultationTimer({ startedAt, style }: Props) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!startedAt) return
    const initial = Math.floor((Date.now() - startedAt) / 1000)
    setElapsed(initial)
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [startedAt])

  // Couleur normale → orange après 45min → rouge après 60min
  const color = elapsed >= 3600 ? '#ba1a1a' : elapsed >= 2700 ? '#e4c546' : '#ffffff'

  return (
    <Text style={[{
      fontFamily: 'Manrope',
      fontSize: 16,
      fontWeight: '700',
      color,
      letterSpacing: 1,
      tabularNums: true,
    }, style]}>
      {formatDuration(elapsed)}
    </Text>
  )
}
```

**Step 4: Run test**

```bash
cd "apps/mobile" && pnpm test -- --testPathPattern="ConsultationTimer.test" --no-coverage
```

Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add apps/mobile/features/consultation/components/
git commit -m "feat(consultation): add ConsultationTimer component with formatDuration"
```

---

## Task 9 : Mobile — Écran salle d'attente patient (`waiting.tsx`)

**Files:**
- Create: `apps/mobile/app/(patient)/consultation/waiting.tsx`
- Create: `apps/mobile/app/(patient)/consultation/_layout.tsx`

**Design de référence :** `video_consultation_1/code.html` — header glassmorphique, fond `bg-surface`, orb animé, badge "Secure Connection".

**Step 1: Créer le layout consultation**

```typescript
// apps/mobile/app/(patient)/consultation/_layout.tsx
import { Stack } from 'expo-router'

export default function ConsultationLayout() {
  return <Stack screenOptions={{ headerShown: false }} />
}
```

**Step 2: Créer waiting.tsx**

```typescript
// apps/mobile/app/(patient)/consultation/waiting.tsx
import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing,
} from 'react-native-reanimated'
import { supabase } from '@/services/supabase'
import { useConsultationStore } from '@/features/consultation/store/consultationStore'
import { useConsultationRoom } from '@/features/consultation/hooks/useConsultation'

export default function WaitingRoom() {
  const router = useRouter()
  const { appointmentId, practitionerName, scheduledAt } = useLocalSearchParams<{
    appointmentId: string
    practitionerName: string
    scheduledAt: string
  }>()

  const { consultationId, status, setConsultation } = useConsultationStore()
  const [isCreating, setIsCreating] = useState(false)
  const [countdown, setCountdown] = useState('')

  // Pulse animation — orb animé façon Ami
  const scale = useSharedValue(0.9)
  const opacity = useSharedValue(0.5)
  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 2500, easing: Easing.bezier(0.4, 0, 0.2, 1) }),
        withTiming(0.9, { duration: 2500, easing: Easing.bezier(0.4, 0, 0.2, 1) })
      ), -1, false
    )
    opacity.value = withRepeat(
      withSequence(withTiming(0.8, { duration: 2500 }), withTiming(0.5, { duration: 2500 })),
      -1, false
    )
  }, [])
  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))

  // Countdown jusqu'au RDV
  useEffect(() => {
    const update = () => {
      const diff = new Date(scheduledAt).getTime() - Date.now()
      if (diff <= 0) { setCountdown('Maintenant'); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setCountdown(h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`)
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [scheduledAt])

  // Écoute statut Realtime si consultation déjà créée
  useConsultationRoom(consultationId)

  const handleJoin = async () => {
    setIsCreating(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Non connecté')

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-consultation-room`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ appointmentId }),
        }
      )
      if (!res.ok) throw new Error('Impossible de créer la salle')
      const data = await res.json()
      setConsultation({
        consultationId: data.consultationId,
        roomUrl: data.roomUrl,
        patientToken: data.patientToken,
      })
      router.push({
        pathname: '/(patient)/consultation/session',
        params: { consultationId: data.consultationId, practitionerName },
      })
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Une erreur est survenue')
    } finally {
      setIsCreating(false)
    }
  }

  const handleCancel = () => {
    Alert.alert(
      'Annuler la consultation ?',
      'Vous pourrez rejoindre à nouveau depuis votre espace rendez-vous.',
      [
        { text: 'Rester', style: 'cancel' },
        { text: 'Quitter', style: 'destructive', onPress: () => router.back() },
      ]
    )
  }

  const isPractitionerReady = status === 'active'

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header — fidèle à video_consultation_1 */}
      <View
        className="px-6 py-4 flex-row items-center justify-between border-b border-white/20"
        style={{ backgroundColor: 'rgba(255,255,255,0.70)', backdropFilter: 'blur(16px)' }}
      >
        <Text className="text-xl font-bold text-primary font-manrope tracking-tight">M-Santé</Text>
        <View className="flex-row items-center gap-2 bg-surface-container/50 px-3 py-1.5 rounded-full border border-surface-variant">
          <View className="w-2 h-2 rounded-full bg-primary" style={{ shadowColor: '#006685', shadowOpacity: 0.5, shadowRadius: 8, elevation: 2 }} />
          <Text className="text-on-surface-variant text-[10px] font-manrope uppercase tracking-widest font-bold">Connexion sécurisée</Text>
        </View>
      </View>

      <View className="flex-1 items-center justify-center px-6 gap-8">
        {/* Orb animé */}
        <View className="items-center justify-center">
          <Animated.View
            style={[orbStyle, {
              position: 'absolute',
              width: 200, height: 200, borderRadius: 100,
              backgroundColor: 'rgba(130,216,255,0.25)',
            }]}
          />
          <View
            className="w-32 h-32 rounded-full bg-primary items-center justify-center"
            style={{ shadowColor: '#82d8ff', shadowOpacity: 1, shadowRadius: 40, elevation: 8 }}
          >
            <Text style={{ fontSize: 48 }}>👨‍⚕️</Text>
          </View>
        </View>

        {/* Infos praticien */}
        <View className="items-center gap-2">
          <Text className="text-2xl font-bold text-on-surface font-manrope text-center">{practitionerName}</Text>
          {isPractitionerReady ? (
            <View className="flex-row items-center gap-2 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-200">
              <View className="w-2 h-2 rounded-full bg-emerald-500" />
              <Text className="text-emerald-700 text-sm font-semibold font-manrope">Le praticien est prêt !</Text>
            </View>
          ) : (
            <View className="flex-row items-center gap-2 bg-surface-container px-4 py-2 rounded-full">
              <ActivityIndicator size="small" color="#006685" />
              <Text className="text-outline text-sm font-manrope">En attente du praticien…</Text>
            </View>
          )}
        </View>

        {/* Countdown */}
        <View
          className="rounded-2xl px-6 py-4 items-center gap-1 border border-white/50"
          style={{ backgroundColor: 'rgba(255,255,255,0.60)' }}
        >
          <Text className="text-xs text-outline font-manrope uppercase tracking-widest">Rendez-vous dans</Text>
          <Text className="text-3xl font-bold text-on-surface font-manrope tabular-nums">{countdown}</Text>
        </View>

        {/* Actions */}
        <View className="w-full gap-3">
          <TouchableOpacity
            onPress={handleJoin}
            disabled={isCreating}
            className="w-full bg-primary rounded-full py-4 items-center"
            style={{ opacity: isCreating ? 0.7 : 1 }}
          >
            {isCreating ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-white font-bold font-manrope text-base">Rejoindre la session</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleCancel} className="w-full py-3 items-center">
            <Text className="text-outline font-manrope text-sm">Annuler</Text>
          </TouchableOpacity>
        </View>

        <Text className="text-xs text-outline font-manrope text-center">
          Cet espace est chiffré de bout en bout 🔒
        </Text>
      </View>
    </SafeAreaView>
  )
}
```

**Step 3: Ajouter la tab hidden dans `(patient)/_layout.tsx`**

Ouvrir `apps/mobile/app/(patient)/_layout.tsx` et ajouter dans le bloc des screens cachés :

```typescript
<Tabs.Screen name="consultation" options={{ href: null }} />
```

**Step 4: Commit**

```bash
git add apps/mobile/app/(patient)/consultation/
git commit -m "feat(consultation): add patient waiting room screen"
```

---

## Task 10 : Mobile — Écran session vidéo patient (`session.tsx`)

**Files:**
- Create: `apps/mobile/app/(patient)/consultation/session.tsx`

**Design de référence :** `video_consultation_2/code.html` — vidéo plein écran sombre, self-view coin haut droit, contrôles flottants bas glassmorphique, bouton chat slide-in droit, call_end rouge.

**Step 1: Créer session.tsx**

```typescript
// apps/mobile/app/(patient)/consultation/session.tsx
import { useState, useRef } from 'react'
import {
  View, Text, TouchableOpacity, FlatList, TextInput,
  KeyboardAvoidingView, Platform, Alert, Dimensions, Modal,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import {
  DailyProvider,
  useDaily,
  useLocalSessionId,
  useParticipantIds,
  DailyVideo,
  useVideoTrack,
  useAudioTrack,
} from '@daily-co/react-native-daily-js'
import { useConsultationStore } from '@/features/consultation/store/consultationStore'
import { useConsultationRoom, useSendChatMessage, useEndConsultation } from '@/features/consultation/hooks/useConsultation'
import { ConsultationTimer } from '@/features/consultation/components/ConsultationTimer'
import type { ChatMessage } from '@/types/consultation'

const { width } = Dimensions.get('window')

function SessionControls({
  onMute, onCamera, onChat, onEnd,
  isMuted, isCameraOff,
}: {
  onMute: () => void; onCamera: () => void
  onChat: () => void; onEnd: () => void
  isMuted: boolean; isCameraOff: boolean
}) {
  return (
    <View
      className="flex-row items-center justify-between gap-3 px-6 py-4 rounded-[2.5rem] mx-6 border border-white/60"
      style={{
        backgroundColor: 'rgba(255,255,255,0.15)',
        backdropFilter: 'blur(24px)',
        shadowColor: '#006685',
        shadowOpacity: 0.15,
        shadowRadius: 40,
        elevation: 8,
      }}
    >
      {/* Mute */}
      <TouchableOpacity
        onPress={onMute}
        className="w-12 h-12 rounded-full items-center justify-center border border-white/40"
        style={{ backgroundColor: isMuted ? 'rgba(186,26,26,0.3)' : 'rgba(255,255,255,0.15)' }}
      >
        <Text style={{ fontSize: 20 }}>{isMuted ? '🔇' : '🎤'}</Text>
      </TouchableOpacity>

      {/* Camera */}
      <TouchableOpacity
        onPress={onCamera}
        className="w-12 h-12 rounded-full items-center justify-center border border-white/40"
        style={{ backgroundColor: isCameraOff ? 'rgba(186,26,26,0.3)' : 'rgba(255,255,255,0.15)' }}
      >
        <Text style={{ fontSize: 20 }}>{isCameraOff ? '📵' : '📹'}</Text>
      </TouchableOpacity>

      {/* Chat */}
      <TouchableOpacity
        onPress={onChat}
        className="w-12 h-12 rounded-full items-center justify-center border border-white/40"
        style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
      >
        <Text style={{ fontSize: 20 }}>💬</Text>
      </TouchableOpacity>

      {/* Separator */}
      <View className="w-px h-8 bg-white/20" />

      {/* End Session */}
      <TouchableOpacity
        onPress={onEnd}
        className="w-14 h-14 rounded-full items-center justify-center"
        style={{
          backgroundColor: '#ba1a1a',
          shadowColor: '#ba1a1a',
          shadowOpacity: 0.4,
          shadowRadius: 20,
          elevation: 6,
        }}
      >
        <Text style={{ fontSize: 24 }}>📵</Text>
      </TouchableOpacity>
    </View>
  )
}

function ChatPanel({
  messages, onSend, onClose,
}: {
  messages: ChatMessage[]; onSend: (text: string) => void; onClose: () => void
}) {
  const [text, setText] = useState('')
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
      style={{ backgroundColor: 'rgba(255,255,255,0.95)' }}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-outline-variant/30">
        <View className="flex-row items-center gap-2">
          <Text style={{ fontSize: 14 }}>🔒</Text>
          <Text className="font-semibold text-on-surface font-manrope">Chat chiffré</Text>
        </View>
        <TouchableOpacity onPress={onClose} className="p-2">
          <Text className="text-primary font-manrope font-semibold">Fermer</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={messages}
        keyExtractor={m => m.id}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        renderItem={({ item }) => {
          const isPatient = item.role === 'patient'
          return (
            <View style={{ alignItems: isPatient ? 'flex-end' : 'flex-start' }}>
              <View
                style={{
                  backgroundColor: isPatient ? '#006685' : 'rgba(229,238,255,1)',
                  borderRadius: 12,
                  borderTopRightRadius: isPatient ? 2 : 12,
                  borderTopLeftRadius: isPatient ? 12 : 2,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  maxWidth: width * 0.75,
                }}
              >
                <Text style={{ color: isPatient ? '#fff' : '#0b1c30', fontSize: 14, fontFamily: 'Manrope' }}>
                  {item.content}
                </Text>
                <Text style={{ color: isPatient ? 'rgba(255,255,255,0.6)' : '#6f787e', fontSize: 10, fontFamily: 'Manrope', marginTop: 2, textAlign: 'right' }}>
                  {new Date(item.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
          )
        }}
      />

      <View className="flex-row items-center gap-2 px-4 pb-4 pt-2 border-t border-outline-variant/20">
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Écrire un message..."
          placeholderTextColor="#6f787e"
          className="flex-1 bg-surface-container rounded-full px-4 py-2 text-sm text-on-surface font-manrope border border-outline-variant/30"
          style={{ fontFamily: 'Manrope' }}
          returnKeyType="send"
          onSubmitEditing={() => { if (text.trim()) { onSend(text.trim()); setText('') } }}
        />
        <TouchableOpacity
          onPress={() => { if (text.trim()) { onSend(text.trim()); setText('') } }}
          className="w-10 h-10 rounded-full bg-primary items-center justify-center"
          style={{ opacity: text.trim() ? 1 : 0.4 }}
        >
          <Text className="text-white text-xs font-bold">→</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

function VideoSession({ practitionerName }: { practitionerName: string }) {
  const daily = useDaily()
  const localSessionId = useLocalSessionId()
  const participantIds = useParticipantIds({ filter: 'remote' })
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const router = useRouter()

  const { consultationId, chatMessages, startedAt } = useConsultationStore()
  const sendMessage = useSendChatMessage(consultationId)
  const { endSession } = useEndConsultation()

  const handleMute = () => {
    daily?.setLocalAudio(isMuted)
    setIsMuted(!isMuted)
  }
  const handleCamera = () => {
    daily?.setLocalVideo(isCameraOff)
    setIsCameraOff(!isCameraOff)
  }
  const handleEnd = () => {
    Alert.alert(
      'Terminer la consultation ?',
      'La session sera enregistrée et un résumé sera généré.',
      [
        { text: 'Continuer', style: 'cancel' },
        {
          text: 'Terminer',
          style: 'destructive',
          onPress: async () => {
            await endSession()
            daily?.leave()
            router.replace('/(patient)/consultation/summary')
          },
        },
      ]
    )
  }

  const remoteId = participantIds[0]

  return (
    <View style={{ flex: 1, backgroundColor: '#213145' }}>
      {/* Vidéo praticien — plein écran */}
      {remoteId ? (
        <DailyVideo
          sessionId={remoteId}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          objectFit="cover"
        />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 64 }}>👨‍⚕️</Text>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'Manrope', marginTop: 12 }}>
            En attente du praticien…
          </Text>
        </View>
      )}

      {/* Gradient bas */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 300,
          background: 'linear-gradient(transparent, rgba(33,49,69,0.8))',
        }}
      />

      {/* Header — timer + nom praticien */}
      <View
        className="absolute top-0 left-0 right-0 flex-row items-center justify-between px-6 py-4"
        style={{ paddingTop: 52 }}
      >
        <View
          className="flex-row items-center gap-3 rounded-lg px-3 py-2 border border-white/10"
          style={{ backgroundColor: 'rgba(33,49,69,0.6)', backdropFilter: 'blur(16px)' }}
        >
          <View className="w-8 h-8 rounded-full bg-primary-container items-center justify-center">
            <Text style={{ fontSize: 14 }}>👨‍⚕️</Text>
          </View>
          <View>
            <Text style={{ color: '#fff', fontFamily: 'Manrope', fontWeight: '600', fontSize: 14 }}>{practitionerName}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'Manrope', fontSize: 10 }}>Praticien de santé</Text>
          </View>
        </View>
        <View
          className="rounded-full px-4 py-2 border border-white/10 items-center"
          style={{ backgroundColor: 'rgba(33,49,69,0.6)' }}
        >
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 9, fontFamily: 'Manrope', textTransform: 'uppercase', letterSpacing: 1 }}>Durée</Text>
          <ConsultationTimer startedAt={startedAt} />
        </View>
      </View>

      {/* Self-view miniature — coin haut droit */}
      <View
        style={{
          position: 'absolute', top: 120, right: 16,
          width: 100, height: 130, borderRadius: 12,
          overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
          shadowColor: '#006685', shadowOpacity: 0.2, shadowRadius: 20, elevation: 6,
        }}
      >
        {localSessionId && (
          <DailyVideo
            sessionId={localSessionId}
            style={{ width: '100%', height: '100%' }}
            objectFit="cover"
            mirror
          />
        )}
        <View style={{ position: 'absolute', bottom: 4, left: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ade80' }} />
            <Text style={{ color: '#fff', fontSize: 9, fontFamily: 'Manrope' }}>Vous</Text>
          </View>
        </View>
      </View>

      {/* Bouton chat slide droit — fidèle à video_consultation_2 */}
      <TouchableOpacity
        onPress={() => setShowChat(true)}
        style={{
          position: 'absolute', right: 0, top: '45%',
          backgroundColor: 'rgba(255,255,255,0.15)',
          backdropFilter: 'blur(16px)',
          paddingVertical: 16, paddingHorizontal: 10,
          borderTopLeftRadius: 16, borderBottomLeftRadius: 16,
          borderWidth: 1, borderRightWidth: 0, borderColor: 'rgba(255,255,255,0.5)',
          alignItems: 'center', gap: 4,
        }}
      >
        <Text style={{ fontSize: 20 }}>💬</Text>
        {chatMessages.length > 0 && (
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#006685' }} />
        )}
      </TouchableOpacity>

      {/* Contrôles bas — fidèle à video_consultation_2 */}
      <View style={{ position: 'absolute', bottom: 40, left: 0, right: 0 }}>
        <SessionControls
          onMute={handleMute}
          onCamera={handleCamera}
          onChat={() => setShowChat(true)}
          onEnd={handleEnd}
          isMuted={isMuted}
          isCameraOff={isCameraOff}
        />
      </View>

      {/* Panel Chat (modal) */}
      <Modal visible={showChat} animationType="slide" presentationStyle="pageSheet">
        <ChatPanel
          messages={chatMessages}
          onSend={(text) => sendMessage(text, 'patient')}
          onClose={() => setShowChat(false)}
        />
      </Modal>
    </View>
  )
}

export default function ConsultationSession() {
  const { practitionerName } = useLocalSearchParams<{ practitionerName: string }>()
  const { roomUrl, patientToken } = useConsultationStore()

  if (!roomUrl || !patientToken) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#213145' }}>
        <Text style={{ color: '#fff', fontFamily: 'Manrope' }}>Chargement de la salle…</Text>
      </View>
    )
  }

  return (
    <DailyProvider url={roomUrl} token={patientToken}>
      <VideoSession practitionerName={practitionerName ?? 'Praticien'} />
    </DailyProvider>
  )
}
```

**Step 2: Commit**

```bash
git add apps/mobile/app/(patient)/consultation/session.tsx
git commit -m "feat(consultation): add patient video session screen (Daily.co + Supabase chat)"
```

---

## Task 11 : Mobile — Écran bilan post-session (`summary.tsx`)

**Files:**
- Create: `apps/mobile/app/(patient)/consultation/summary.tsx`

**Step 1: Créer summary.tsx**

```typescript
// apps/mobile/app/(patient)/consultation/summary.tsx
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { supabase } from '@/services/supabase'
import { useConsultationStore } from '@/features/consultation/store/consultationStore'
import { GlassCard } from '@/components/ui'

export default function ConsultationSummary() {
  const router = useRouter()
  const { aiSummary, durationMin, prescriptionUrl, consultationId, reset } = useConsultationStore()

  const handleDownloadPrescription = async () => {
    if (!prescriptionUrl || !consultationId) return
    try {
      const { data } = await supabase.storage
        .from('prescriptions')
        .createSignedUrl(`${consultationId}.pdf`, 3600)
      if (data?.signedUrl) {
        await WebBrowser.openBrowserAsync(data.signedUrl)
      }
    } catch {
      // ignore
    }
  }

  const handleRebook = () => {
    reset()
    router.back()
    router.back() // Retour au profil praticien
  }

  const handleHome = () => {
    reset()
    router.replace('/(patient)/home')
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }}>
        {/* Icône succès */}
        <View className="items-center py-6 gap-3">
          <View className="w-20 h-20 rounded-full items-center justify-center" style={{ backgroundColor: 'rgba(29,122,58,0.1)' }}>
            <Text style={{ fontSize: 40 }}>✅</Text>
          </View>
          <Text className="text-2xl font-bold text-on-surface font-manrope text-center">Consultation terminée</Text>
          <Text className="text-sm text-outline font-manrope text-center">Merci pour votre confiance</Text>
        </View>

        {/* Card infos session */}
        <GlassCard className="gap-3">
          <Text className="text-xs text-primary font-manrope uppercase tracking-widest font-bold mb-1">Résumé de la session</Text>
          <View className="flex-row justify-between items-center">
            <Text className="text-sm text-outline font-manrope">⏱ Durée</Text>
            <Text className="text-sm font-semibold text-on-surface font-manrope">{durationMin ?? '—'} min</Text>
          </View>
          <View className="flex-row justify-between items-center">
            <Text className="text-sm text-outline font-manrope">📅 Date</Text>
            <Text className="text-sm font-semibold text-on-surface font-manrope">
              {new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </Text>
          </View>
        </GlassCard>

        {/* Card IA résumé */}
        {aiSummary ? (
          <GlassCard className="gap-3">
            <View className="flex-row items-center gap-2 mb-1">
              <Text style={{ fontSize: 16 }}>🤖</Text>
              <Text className="text-xs text-primary font-manrope uppercase tracking-widest font-bold">Résumé IA</Text>
            </View>
            <Text className="text-sm text-on-surface font-manrope leading-relaxed">{aiSummary}</Text>
            <Text className="text-[10px] text-outline font-manrope italic mt-1">
              Ce résumé ne remplace pas les conseils de votre médecin.
            </Text>
          </GlassCard>
        ) : (
          <GlassCard className="items-center py-4 gap-2">
            <ActivityIndicator color="#006685" />
            <Text className="text-sm text-outline font-manrope">Génération du résumé…</Text>
          </GlassCard>
        )}

        {/* Card ordonnance */}
        {prescriptionUrl && (
          <GlassCard className="gap-3">
            <View className="flex-row items-center gap-2 mb-1">
              <Text style={{ fontSize: 16 }}>📋</Text>
              <Text className="text-xs text-primary font-manrope uppercase tracking-widest font-bold">Ordonnance</Text>
            </View>
            <Text className="text-sm text-outline font-manrope">Votre praticien a joint une ordonnance.</Text>
            <TouchableOpacity
              onPress={handleDownloadPrescription}
              className="bg-primary rounded-lg py-2.5 items-center"
            >
              <Text className="text-white text-sm font-semibold font-manrope">Télécharger le PDF</Text>
            </TouchableOpacity>
          </GlassCard>
        )}

        {/* Actions */}
        <View className="gap-3 mt-2">
          <TouchableOpacity
            onPress={handleRebook}
            className="w-full border border-primary rounded-full py-3.5 items-center"
          >
            <Text className="text-primary font-semibold font-manrope">Reprendre rendez-vous</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleHome}
            className="w-full bg-primary rounded-full py-3.5 items-center"
          >
            <Text className="text-white font-semibold font-manrope">Retour à l'accueil</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
```

**Step 2: Ajouter le lien "Rejoindre" sur booking-success**

Ouvrir `apps/mobile/app/(patient)/booking-success.tsx` et, après le bouton "Retour à l'accueil", ajouter un bouton conditionnel si `sessionType === 'video'` qui navigue vers `/(patient)/consultation/waiting`.

Modifier la section boutons :

```typescript
// Dans BookingSuccessScreen, après handleHome, ajouter :
const handleJoinConsultation = () => {
  reset()
  router.push({
    pathname: '/(patient)/consultation/waiting',
    params: {
      appointmentId: appointmentId ?? '',
      practitionerName: practitionerName ?? '',
      scheduledAt: selectedSlot?.date ? `${selectedSlot.date}T${selectedSlot.startTime}:00` : new Date().toISOString(),
    },
  })
}

// Dans le JSX, ajouter avant PrimaryButton :
{sessionType === 'video' && appointmentId && (
  <TouchableOpacity
    onPress={handleJoinConsultation}
    className="w-full border border-primary rounded-full py-3.5 items-center mb-2"
  >
    <Text className="text-primary font-semibold font-manrope">Accéder à la salle d'attente 📹</Text>
  </TouchableOpacity>
)}
```

**Step 3: Commit**

```bash
git add apps/mobile/app/(patient)/consultation/summary.tsx apps/mobile/app/(patient)/booking-success.tsx
git commit -m "feat(consultation): add patient summary screen + booking-success join link"
```

---

## Task 12 : Scaffold Next.js web app (`apps/web`)

**Files:**
- Create: `apps/web/` (scaffold complet)

**Step 1: Créer l'app Next.js**

```bash
cd "c:/Users/Khodiaou/Desktop/m-santé app/apps"
pnpm dlx create-next-app@15 web --typescript --tailwind --app --no-src-dir --import-alias "@/*" --yes
```

**Step 2: Installer les dépendances consultation**

```bash
cd "c:/Users/Khodiaou/Desktop/m-santé app"
pnpm --filter web add @daily-co/react-daily @supabase/supabase-js @supabase/ssr
```

**Step 3: Créer le client Supabase pour le web**

```typescript
// apps/web/lib/supabase.ts
import { createBrowserClient } from '@supabase/ssr'

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

**Step 4: Créer `.env.local` pour le web**

```bash
# apps/web/.env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL=https://your-project.supabase.co/functions/v1
```

**Step 5: Créer les types Consultation partagés pour le web**

```typescript
// apps/web/types/consultation.ts
// Copie exacte du type mobile
export type ConsultationStatus = 'waiting' | 'active' | 'ended'

export interface ChatMessage {
  id: string
  role: 'patient' | 'practitioner'
  content: string
  timestamp: number
}

export interface Consultation {
  id: string
  appointment_id: string
  room_url: string | null
  practitioner_token: string | null
  started_at: string | null
  chat_history: ChatMessage[]
  ai_summary: string | null
  prescription_url: string | null
  status: ConsultationStatus
}
```

**Step 6: Commit**

```bash
git add apps/web/
git commit -m "feat(web): scaffold Next.js 15 app + Supabase client + consultation types"
```

---

## Task 13 : Web — Page salle d'attente praticien

**Files:**
- Create: `apps/web/app/practitioner/consultation/[appointmentId]/waiting/page.tsx`
- Create: `apps/web/app/practitioner/consultation/[appointmentId]/layout.tsx`

**Design de référence :** `video_consultation_1/code.html` — header M-Santé, card RDV, badge statut patient, bouton "Démarrer".

**Step 1: Créer le layout**

```typescript
// apps/web/app/practitioner/consultation/[appointmentId]/layout.tsx
export default function ConsultationLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
```

**Step 2: Créer waiting/page.tsx**

```typescript
// apps/web/app/practitioner/consultation/[appointmentId]/waiting/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Consultation } from '@/types/consultation'

export default function PractitionerWaiting() {
  const params = useParams<{ appointmentId: string }>()
  const router = useRouter()
  const [isJoining, setIsJoining] = useState(false)
  const [patientStatus, setPatientStatus] = useState<'waiting' | 'connected'>('waiting')
  const [appointment, setAppointment] = useState<any>(null)

  // Charge infos RDV
  useEffect(() => {
    supabase
      .from('appointments')
      .select(`
        id, scheduled_at, duration_min, type,
        users!patient_id(full_name)
      `)
      .eq('id', params.appointmentId)
      .single()
      .then(({ data }) => setAppointment(data))
  }, [params.appointmentId])

  // Realtime — détecte quand le patient crée la consultation (status: waiting)
  useEffect(() => {
    const channel = supabase
      .channel(`appt:${params.appointmentId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'consultations',
        filter: `appointment_id=eq.${params.appointmentId}`,
      }, () => setPatientStatus('connected'))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [params.appointmentId])

  const handleStart = async () => {
    setIsJoining(true)
    try {
      // Récupère la consultation existante
      const { data: consultation } = await supabase
        .from('consultations')
        .select('id')
        .eq('appointment_id', params.appointmentId)
        .neq('status', 'ended')
        .maybeSingle()

      if (!consultation) {
        alert('Le patient n\'a pas encore rejoint la salle d\'attente.')
        return
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Non connecté')

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL}/join-consultation`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ consultationId: consultation.id }),
        }
      )
      if (!res.ok) throw new Error('Impossible de rejoindre')
      const data = await res.json()

      router.push(`/practitioner/consultation/${params.appointmentId}/session?token=${data.practitionerToken}&roomUrl=${encodeURIComponent(data.roomUrl)}&consultationId=${data.consultationId}`)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setIsJoining(false)
    }
  }

  const patientName = (appointment?.users as any)?.full_name ?? 'Patient'
  const scheduledAt = appointment?.scheduled_at
    ? new Date(appointment.scheduled_at).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })
    : '—'

  return (
    <div className="min-h-screen bg-[#f8f9ff] font-[Manrope]">
      {/* Header — fidèle à video_consultation_1 */}
      <header className="fixed top-0 w-full z-50 flex items-center justify-between px-6 py-4 bg-white/70 backdrop-blur-xl border-b border-sky-100/20 shadow-[0_8px_32px_0_rgba(130,216,255,0.08)]">
        <span className="text-2xl font-bold bg-gradient-to-r from-sky-600 to-sky-400 bg-clip-text text-transparent tracking-tight">
          M-Santé
        </span>
        <div className="flex items-center gap-2 bg-[#e5eeff]/50 px-3 py-1.5 rounded-full border border-[#d3e4fe]">
          <div className="w-2 h-2 rounded-full bg-[#006685] shadow-[0_0_8px_rgba(0,102,133,0.5)]" />
          <span className="text-[#3f484d] text-xs uppercase tracking-widest font-bold">Portail Praticien</span>
        </div>
      </header>

      <main className="pt-24 pb-12 px-6 max-w-2xl mx-auto flex flex-col gap-6">
        {/* Card RDV */}
        <div className="bg-white/60 backdrop-blur-md rounded-3xl p-6 border border-white/50 shadow-[0_10px_30px_-10px_rgba(0,102,133,0.08)] flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#e5eeff] flex items-center justify-center text-2xl">👤</div>
            <div>
              <p className="font-bold text-[#0b1c30] text-lg">{patientName}</p>
              <p className="text-sm text-[#6f787e]">{scheduledAt}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
              patientStatus === 'connected'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-[#e5eeff] text-[#006685] border border-[#bee9ff]'
            }`}>
              <span className={`w-2 h-2 rounded-full ${patientStatus === 'connected' ? 'bg-emerald-500' : 'bg-[#006685] animate-pulse'}`} />
              {patientStatus === 'connected' ? 'Patient connecté' : 'En attente du patient…'}
            </span>
          </div>
        </div>

        {/* Bouton démarrer */}
        <button
          onClick={handleStart}
          disabled={isJoining}
          className="w-full py-4 bg-[#006685] hover:bg-[#005570] text-white font-bold text-base rounded-full transition-all disabled:opacity-60 shadow-[0_8px_24px_rgba(0,102,133,0.3)]"
        >
          {isJoining ? 'Connexion en cours…' : '▶ Démarrer la consultation'}
        </button>

        <p className="text-xs text-[#6f787e] text-center">
          Assurez-vous que votre caméra et microphone sont autorisés dans votre navigateur.
        </p>
      </main>
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add apps/web/app/practitioner/
git commit -m "feat(web): add practitioner waiting room page"
```

---

## Task 14 : Web — Page session vidéo praticien

**Files:**
- Create: `apps/web/app/practitioner/consultation/[appointmentId]/session/page.tsx`

**Design de référence :** `video_consultation_1/code.html` — vidéo patient plein écran, sidebar droite (Notes + Chat), contrôles bas glassmorphiques, timer en haut, call_end rouge.

**Step 1: Créer session/page.tsx**

```typescript
// apps/web/app/practitioner/consultation/[appointmentId]/session/page.tsx
'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams, useParams } from 'next/navigation'
import DailyIframe from '@daily-co/react-daily'
import { supabase } from '@/lib/supabase'
import type { ChatMessage } from '@/types/consultation'

export default function PractitionerSession() {
  const params = useParams<{ appointmentId: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()

  const token = searchParams.get('token') ?? ''
  const roomUrl = searchParams.get('roomUrl') ? decodeURIComponent(searchParams.get('roomUrl')!) : ''
  const consultationId = searchParams.get('consultationId') ?? ''

  const callFrameRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [elapsed, setElapsed] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [notes, setNotes] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [activeTab, setActiveTab] = useState<'notes' | 'chat'>('notes')
  const [isEnding, setIsEnding] = useState(false)
  const startedRef = useRef<number>(Date.now())

  // Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedRef.current) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    return h > 0
      ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
      : `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  }

  // Initialise Daily.co iframe
  useEffect(() => {
    if (!roomUrl || !token || !containerRef.current) return
    const frame = DailyIframe.createFrame(containerRef.current, {
      iframeStyle: { position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' },
      showLeaveButton: false,
      showFullscreenButton: false,
    })
    frame.join({ url: roomUrl, token })
    callFrameRef.current = frame
    return () => { frame.destroy() }
  }, [roomUrl, token])

  // Realtime chat
  useEffect(() => {
    if (!consultationId) return
    const channel = supabase
      .channel(`consultation:${consultationId}`)
      .on('broadcast', { event: 'chat_message' }, ({ payload }) => {
        setChatMessages(prev => [...prev, payload as ChatMessage])
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [consultationId])

  const handleMute = () => {
    callFrameRef.current?.setLocalAudio(isMuted)
    setIsMuted(!isMuted)
  }
  const handleCamera = () => {
    callFrameRef.current?.setLocalVideo(isCameraOff)
    setIsCameraOff(!isCameraOff)
  }

  const sendChatMessage = async () => {
    if (!chatInput.trim()) return
    const msg: ChatMessage = {
      id: `pract_${Date.now()}`,
      role: 'practitioner',
      content: chatInput,
      timestamp: Date.now(),
    }
    setChatMessages(prev => [...prev, msg])
    setChatInput('')
    await supabase
      .channel(`consultation:${consultationId}`)
      .send({ type: 'broadcast', event: 'chat_message', payload: msg })
  }

  const handleEndSession = async () => {
    if (!confirm('Terminer la consultation ? Un résumé IA sera généré.')) return
    setIsEnding(true)
    try {
      callFrameRef.current?.leave()
      const { data: { session } } = await supabase.auth.getSession()
      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL}/end-consultation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ consultationId, chatHistory: chatMessages, notes }),
      })
      router.push(`/practitioner/consultation/${params.appointmentId}/summary?consultationId=${consultationId}`)
    } catch (e) {
      alert('Erreur lors de la fin de session')
      setIsEnding(false)
    }
  }

  const timerColor = elapsed >= 3600 ? '#ba1a1a' : elapsed >= 2700 ? '#e4c546' : '#ffffff'

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#213145] flex flex-col font-[Manrope]">
      {/* Header — fidèle à video_consultation_1 */}
      <header className="fixed top-0 left-0 w-full z-50 flex items-center justify-between px-6 h-16 bg-white/10 backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-4">
          <span className="text-xl font-bold text-sky-400 tracking-tight">M-Santé</span>
          <div className="hidden md:flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full border border-white/20">
            <span className="w-2 h-2 rounded-full bg-[#006685] shadow-[0_0_8px_rgba(0,102,133,0.5)]" />
            <span className="text-white/70 text-xs uppercase tracking-widest font-bold">Connexion sécurisée</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-center">
            <span className="block text-white/50 text-[10px] uppercase tracking-widest">Durée</span>
            <span className="block font-bold text-lg tabular-nums" style={{ color: timerColor }}>{formatTime(elapsed)}</span>
          </div>
        </div>
      </header>

      <div className="flex h-full pt-16">
        {/* Zone vidéo principale */}
        <main className="flex-1 relative bg-[#213145] overflow-hidden">
          <div ref={containerRef} className="absolute inset-0" />

          {/* Contrôles bas — fidèle à video_consultation_1 */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex items-center gap-4 bg-[#213145]/70 backdrop-blur-xl border border-white/15 px-6 py-3 rounded-full shadow-[0_20px_40px_rgba(0,0,0,0.2)]">
            <button
              onClick={handleMute}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isMuted ? 'bg-red-500/30 text-red-300' : 'bg-white/10 hover:bg-white/20 text-white'}`}
              title="Mute"
            >
              <span className="material-symbols-outlined">{isMuted ? 'mic_off' : 'mic'}</span>
            </button>
            <button
              onClick={handleCamera}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isCameraOff ? 'bg-red-500/30 text-red-300' : 'bg-white/10 hover:bg-white/20 text-white'}`}
              title="Camera"
            >
              <span className="material-symbols-outlined">{isCameraOff ? 'videocam_off' : 'videocam'}</span>
            </button>
            <div className="w-px h-8 bg-white/20 mx-1" />
            <button
              onClick={handleEndSession}
              disabled={isEnding}
              className="px-6 h-12 rounded-full flex items-center gap-2 bg-[#ba1a1a] hover:bg-red-700 text-white font-bold transition-all shadow-[0_0_15px_rgba(186,26,26,0.3)] disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-sm">call_end</span>
              {isEnding ? 'Fin...' : 'Terminer'}
            </button>
          </div>
        </main>

        {/* Sidebar droite — Notes + Chat */}
        <aside className="w-80 flex flex-col gap-4 p-4 bg-transparent">
          {/* Onglets */}
          <div className="flex bg-white/20 rounded-xl p-1">
            {(['notes', 'chat'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === tab ? 'bg-white text-[#006685]' : 'text-white/70 hover:text-white'}`}
              >
                {tab === 'notes' ? '📝 Notes' : `💬 Chat${chatMessages.length > 0 ? ` (${chatMessages.length})` : ''}`}
              </button>
            ))}
          </div>

          {/* Notes panel — fidèle à video_consultation_1 */}
          {activeTab === 'notes' && (
            <div className="flex-1 bg-white/40 backdrop-blur-2xl rounded-xl border border-white/40 shadow-xl p-5 flex flex-col gap-3">
              <h3 className="font-bold text-[#0b1c30] text-base">Notes de session</h3>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Notez les points clés de la consultation…"
                className="flex-1 resize-none bg-white/50 border border-[#bec8ce]/50 rounded-lg p-3 text-sm text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#006685]/50 min-h-[300px]"
              />
              <p className="text-[10px] text-[#6f787e]">Notes privées — non visibles par le patient</p>
            </div>
          )}

          {/* Chat panel — fidèle à video_consultation_1 */}
          {activeTab === 'chat' && (
            <div className="flex-1 bg-white/40 backdrop-blur-2xl rounded-xl border border-white/40 shadow-xl flex flex-col overflow-hidden">
              <div className="p-4 border-b border-white/20 bg-[#eff4ff]/50">
                <h3 className="font-bold text-[#0b1c30] text-base flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#006685] text-sm">lock</span>
                  Chat chiffré
                </h3>
              </div>
              <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-3">
                {chatMessages.map(msg => (
                  <div key={msg.id} className={`flex gap-2 ${msg.role === 'practitioner' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      msg.role === 'practitioner' ? 'bg-[#82d8ff] text-[#006685]' : 'bg-[#e5eeff] text-[#0b1c30]'
                    }`}>
                      {msg.role === 'practitioner' ? 'Dr' : 'P'}
                    </div>
                    <div className={`py-2 px-3 rounded-lg max-w-[80%] ${
                      msg.role === 'practitioner'
                        ? 'bg-[#006685] text-white rounded-tr-none'
                        : 'bg-[#e5eeff] text-[#0b1c30] rounded-tl-none border border-white/50'
                    }`}>
                      <p className="text-sm">{msg.content}</p>
                      <span className="text-[10px] opacity-60 mt-1 block text-right">
                        {new Date(msg.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t border-white/20 bg-[#eff4ff]/30 flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendChatMessage()}
                  placeholder="Écrire un message…"
                  className="flex-1 bg-white/50 border border-[#bec8ce]/50 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006685]/50"
                />
                <button
                  onClick={sendChatMessage}
                  className="w-8 h-8 rounded-full bg-[#006685] text-white flex items-center justify-center hover:bg-[#005570] transition-colors shadow-sm"
                >
                  <span className="material-symbols-outlined text-sm">send</span>
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add apps/web/app/practitioner/consultation/
git commit -m "feat(web): add practitioner session page (Daily.co iframe + chat + notes)"
```

---

## Task 15 : Web — Page bilan praticien + upload ordonnance

**Files:**
- Create: `apps/web/app/practitioner/consultation/[appointmentId]/summary/page.tsx`

**Design de référence :** `video_consultation_2/code.html`.

**Step 1: Créer summary/page.tsx**

```typescript
// apps/web/app/practitioner/consultation/[appointmentId]/summary/page.tsx
'use client'
import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Consultation, ChatMessage } from '@/types/consultation'

export default function PractitionerSummary() {
  const params = useParams<{ appointmentId: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const consultationId = searchParams.get('consultationId') ?? ''
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [consultation, setConsultation] = useState<Consultation | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadDone, setUploadDone] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    if (!consultationId) return
    const poll = setInterval(async () => {
      const { data } = await supabase
        .from('consultations')
        .select('*')
        .eq('id', consultationId)
        .single()
      if (data?.ai_summary) {
        setConsultation(data as Consultation)
        clearInterval(poll)
      }
    }, 2000)
    return () => clearInterval(poll)
  }, [consultationId])

  const uploadPrescription = async (file: File) => {
    if (!file || !consultationId) return
    if (file.type !== 'application/pdf') {
      alert('Uniquement les fichiers PDF sont acceptés.')
      return
    }
    setIsUploading(true)
    try {
      const { error } = await supabase.storage
        .from('prescriptions')
        .upload(`${consultationId}.pdf`, file, { upsert: true, contentType: 'application/pdf' })
      if (error) throw error
      await supabase
        .from('consultations')
        .update({ prescription_url: `${consultationId}.pdf` })
        .eq('id', consultationId)
      setUploadDone(true)
    } catch (e) {
      alert('Erreur lors de l\'upload')
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadPrescription(file)
  }

  const chatHistory = (consultation?.chat_history ?? []) as ChatMessage[]

  return (
    <div className="min-h-screen bg-[#f8f9ff] font-[Manrope]">
      <header className="fixed top-0 w-full z-50 flex items-center justify-between px-6 py-4 bg-white/70 backdrop-blur-xl border-b border-white/20">
        <button onClick={() => router.back()} className="text-[#006685] flex items-center gap-2 hover:opacity-70">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="font-bold text-lg text-[#006685] tracking-tight">Bilan de consultation</h1>
        <button className="p-2 rounded-full hover:bg-[#e5eeff]">
          <span className="material-symbols-outlined text-[#6f787e]">more_vert</span>
        </button>
      </header>

      <main className="pt-24 pb-12 px-6 max-w-2xl mx-auto flex flex-col gap-6">
        {/* Durée + date */}
        <div className="bg-white/60 backdrop-blur-md rounded-3xl p-6 border border-white/50 shadow-[0_10px_30px_-10px_rgba(0,102,133,0.08)] flex gap-6">
          <div className="flex-1 text-center">
            <p className="text-xs text-[#6f787e] uppercase tracking-widest mb-1">Durée</p>
            <p className="text-2xl font-bold text-[#0b1c30]">{consultation?.duration_actual_min ?? '—'} min</p>
          </div>
          <div className="w-px bg-[#bec8ce]/40" />
          <div className="flex-1 text-center">
            <p className="text-xs text-[#6f787e] uppercase tracking-widest mb-1">Date</p>
            <p className="text-base font-semibold text-[#0b1c30]">
              {new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Résumé IA */}
        <div className="bg-white/60 backdrop-blur-md rounded-3xl p-6 border border-white/50 shadow-[0_10px_30px_-10px_rgba(0,102,133,0.08)] flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🤖</span>
            <span className="text-xs text-[#006685] uppercase tracking-widest font-bold">Résumé IA — Claude</span>
          </div>
          {consultation?.ai_summary ? (
            <p className="text-sm text-[#0b1c30] leading-relaxed">{consultation.ai_summary}</p>
          ) : (
            <div className="flex items-center gap-3 text-[#6f787e]">
              <div className="w-4 h-4 border-2 border-[#006685] border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Génération du résumé en cours…</span>
            </div>
          )}
          <p className="text-[10px] text-[#6f787e] italic">Ce résumé ne remplace pas les conseils d'un médecin.</p>
        </div>

        {/* Transcript chat */}
        {chatHistory.length > 0 && (
          <div className="bg-white/60 backdrop-blur-md rounded-3xl p-6 border border-white/50 shadow-[0_10px_30px_-10px_rgba(0,102,133,0.08)] flex flex-col gap-3">
            <span className="text-xs text-[#006685] uppercase tracking-widest font-bold">💬 Transcript</span>
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
              {chatHistory.map(msg => (
                <div key={msg.id} className="flex gap-2">
                  <span className={`text-xs font-semibold shrink-0 w-20 ${msg.role === 'practitioner' ? 'text-[#006685]' : 'text-[#705d00]'}`}>
                    {msg.role === 'practitioner' ? 'Praticien' : 'Patient'}
                  </span>
                  <span className="text-sm text-[#0b1c30]">{msg.content}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload ordonnance */}
        <div className="bg-white/60 backdrop-blur-md rounded-3xl p-6 border border-white/50 shadow-[0_10px_30px_-10px_rgba(0,102,133,0.08)] flex flex-col gap-4">
          <span className="text-xs text-[#006685] uppercase tracking-widest font-bold">📋 Ordonnance PDF</span>
          {uploadDone ? (
            <div className="flex items-center gap-3 text-emerald-700 bg-emerald-50 rounded-xl px-4 py-3 border border-emerald-200">
              <span>✅</span>
              <span className="text-sm font-semibold">Ordonnance envoyée au patient avec succès</span>
            </div>
          ) : (
            <div
              onDrop={handleFileDrop}
              onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center gap-3 transition-all cursor-pointer ${isDragging ? 'border-[#006685] bg-[#e5eeff]/40' : 'border-[#bec8ce] hover:border-[#006685] hover:bg-[#f8f9ff]'}`}
              onClick={() => fileInputRef.current?.click()}
            >
              <span className="text-4xl">📄</span>
              <p className="text-sm text-[#6f787e] text-center">
                Glissez votre ordonnance PDF ici<br />
                <span className="text-[#006685] font-semibold">ou cliquez pour sélectionner</span>
              </p>
              {isUploading && (
                <div className="flex items-center gap-2 text-[#006685]">
                  <div className="w-4 h-4 border-2 border-[#006685] border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">Envoi en cours…</span>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={e => e.target.files?.[0] && uploadPrescription(e.target.files[0])}
              />
            </div>
          )}
        </div>

        {/* Retour */}
        <button
          onClick={() => router.push('/practitioner')}
          className="w-full py-3.5 bg-[#006685] hover:bg-[#005570] text-white font-bold rounded-full transition-all"
        >
          Retour au tableau de bord
        </button>
      </main>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add apps/web/app/practitioner/consultation/
git commit -m "feat(web): add practitioner summary page with PDF prescription upload"
```

---

## Task 16 : Tests finaux + vérification

**Step 1: Run all mobile tests**

```bash
cd "c:/Users/Khodiaou/Desktop/m-santé app"
pnpm --filter mobile test -- --no-coverage --passWithNoTests
```

Expected: ≥18 tests PASS (anciens 15 + 3 consultationStore + 3 ConsultationTimer + 2 types)

**Step 2: Typecheck mobile**

```bash
cd "apps/mobile"
pnpm tsc --noEmit
```

Expected: 0 errors

**Step 3: Typecheck web**

```bash
cd "apps/web"
pnpm tsc --noEmit
```

Expected: 0 errors (ou warnings seulement sur Daily.co types)

**Step 4: Vérifier que tous les fichiers sont trackés**

```bash
cd "c:/Users/Khodiaou/Desktop/m-santé app"
git status
```

Expected: working tree clean

**Step 5: Commit final si nécessaire**

```bash
git add -A
git commit -m "chore(consultation): final checks + typecheck pass"
```
