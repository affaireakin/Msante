# P1 Booking + Payment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implémenter le flow complet patient — recherche de praticiens, réservation de créneau, et paiement simulé (Wave/Orange Money) avec confirmation automatique.

**Architecture:** TanStack Query pour la lecture (liste praticiens, créneaux), deux Edge Functions Supabase pour les opérations critiques (create-appointment, process-payment), Provider Pattern pour le paiement simulé extensible.

**Tech Stack:** React Native + Expo Router v3, TanStack Query v5, Zustand, Supabase Edge Functions (Deno), NativeWind v4, React Hook Form + Zod.

---

## Task 1 : Migrations DB — availabilities + appointments + payments + RLS

**Files:**
- Create: `supabase/migrations/20260430000006_create_booking_tables.sql`
- Create: `supabase/migrations/20260430000007_booking_rls.sql`
- Create: `supabase/migrations/20260430000008_seed_availabilities.sql`

**Step 1: Créer `supabase/migrations/20260430000006_create_booking_tables.sql`**

```sql
-- Créneaux récurrents des praticiens
CREATE TABLE public.availabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id UUID NOT NULL REFERENCES public.practitioners(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_availabilities_practitioner ON public.availabilities(practitioner_id);
CREATE INDEX idx_availabilities_day ON public.availabilities(practitioner_id, day_of_week);

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

CREATE INDEX idx_appointments_patient ON public.appointments(patient_id);
CREATE INDEX idx_appointments_practitioner ON public.appointments(practitioner_id);
CREATE INDEX idx_appointments_scheduled_at ON public.appointments(scheduled_at);
CREATE INDEX idx_appointments_status ON public.appointments(status);

-- Paiements
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES public.appointments(id),
  patient_id UUID NOT NULL REFERENCES public.users(id),
  practitioner_id UUID NOT NULL REFERENCES public.practitioners(id),
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT DEFAULT 'XOF',
  provider TEXT NOT NULL
    CHECK (provider IN ('wave', 'orange_money', 'stripe', 'card', 'simulated')),
  provider_ref TEXT,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
  retry_count INT DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_patient ON public.payments(patient_id);
CREATE INDEX idx_payments_appointment ON public.payments(appointment_id);
CREATE INDEX idx_payments_status ON public.payments(status);
```

**Step 2: Créer `supabase/migrations/20260430000007_booking_rls.sql`**

```sql
-- Availabilities : lecture publique
ALTER TABLE public.availabilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "availabilities_public_read" ON public.availabilities
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY "practitioners_manage_own_availabilities" ON public.availabilities
  FOR ALL USING (
    practitioner_id IN (
      SELECT id FROM public.practitioners WHERE user_id = auth.uid()
    )
  );

-- Appointments : patient voit les siens, praticien voit les siens
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patients_own_appointments" ON public.appointments
  FOR SELECT USING (auth.uid() = patient_id);

CREATE POLICY "patients_create_appointments" ON public.appointments
  FOR INSERT WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "practitioners_own_appointments" ON public.appointments
  FOR SELECT USING (
    practitioner_id IN (
      SELECT id FROM public.practitioners WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "edge_functions_manage_appointments" ON public.appointments
  FOR ALL USING (auth.role() = 'service_role');

-- Payments : patient voit les siens
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patients_own_payments" ON public.payments
  FOR SELECT USING (auth.uid() = patient_id);

CREATE POLICY "edge_functions_manage_payments" ON public.payments
  FOR ALL USING (auth.role() = 'service_role');
```

**Step 3: Créer `supabase/migrations/20260430000008_seed_availabilities.sql`**

```sql
-- Seed : disponibilités pour les praticiens déjà en base (test uniquement)
-- Ce script sera exécuté uniquement en dev via supabase db seed
-- En prod, les praticiens configurent leurs disponibilités via l'app

-- Exemple de disponibilités pour tests
-- INSERT INTO public.availabilities (practitioner_id, day_of_week, start_time, end_time)
-- SELECT id, unnest(ARRAY[1,2,3,4,5]), '09:00', '17:00'
-- FROM public.practitioners
-- WHERE verification_status = 'approved'
-- LIMIT 3;
-- (Commenté — à décommenter uniquement pour seeds de dev)
SELECT 1; -- no-op placeholder
```

**Step 4: Appliquer les migrations localement**

```bash
supabase db reset
```
Expected: "Reset successful" — 8 migrations appliquées

**Step 5: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): add availabilities, appointments, payments tables with RLS"
git push origin main
```

---

## Task 2 : Types TypeScript — booking

**Files:**
- Create: `apps/mobile/types/booking.ts`

**Step 1: Créer `apps/mobile/types/booking.ts`**

```typescript
export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
export type SessionType = 'video' | 'audio' | 'chat'
export type PaymentProvider = 'wave' | 'orange_money' | 'card' | 'simulated'
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded'

export interface Availability {
  id: string
  practitioner_id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_active: boolean
}

export interface TimeSlot {
  date: string           // 'YYYY-MM-DD'
  start_time: string     // 'HH:MM'
  end_time: string       // 'HH:MM'
  available: boolean
}

export interface Appointment {
  id: string
  patient_id: string
  practitioner_id: string
  scheduled_at: string
  duration_min: number
  status: AppointmentStatus
  type: SessionType
  payment_id: string | null
  notes: string | null
  created_at: string
}

export interface Payment {
  id: string
  appointment_id: string | null
  patient_id: string
  practitioner_id: string
  amount: number
  currency: string
  provider: PaymentProvider
  provider_ref: string | null
  status: PaymentStatus
  retry_count: number
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface PractitionerFilter {
  speciality?: string
  language?: string
  maxPrice?: number
  hasAvailability?: boolean
}

export interface CreateAppointmentRequest {
  practitioner_id: string
  scheduled_at: string
  duration_min: number
  type: SessionType
}

export interface CreateAppointmentResponse {
  appointmentId: string
  amount: number
  currency: string
}

export interface ProcessPaymentRequest {
  appointment_id: string
  provider: PaymentProvider
  phone?: string
}

export interface ProcessPaymentResponse {
  paymentId: string
  status: PaymentStatus
}
```

**Step 2: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```
Expected: 0 erreurs

**Step 3: Commit**

```bash
git add apps/mobile/types/booking.ts
git commit -m "feat(types): add booking TypeScript interfaces"
git push origin main
```

---

## Task 3 : Zustand bookingStore

**Files:**
- Create: `apps/mobile/features/booking/store/bookingStore.ts`
- Create: `apps/mobile/features/booking/store/__tests__/bookingStore.test.ts`

**Step 1: Écrire le test**

```typescript
// apps/mobile/features/booking/store/__tests__/bookingStore.test.ts
import { act } from 'react'
import { renderHook } from '@testing-library/react-hooks'
import { useBookingStore } from '../bookingStore'

describe('bookingStore', () => {
  beforeEach(() => act(() => useBookingStore.getState().reset()))

  it('starts empty', () => {
    const { result } = renderHook(() => useBookingStore())
    expect(result.current.practitionerId).toBeNull()
    expect(result.current.selectedSlot).toBeNull()
    expect(result.current.paymentProvider).toBeNull()
  })

  it('setSlot updates slot and practitioner', () => {
    const { result } = renderHook(() => useBookingStore())
    act(() => {
      result.current.setPractitioner('p-1', 'Dr. Diallo')
      result.current.setSlot({ date: '2026-05-01', startTime: '09:00', endTime: '10:00' })
    })
    expect(result.current.practitionerId).toBe('p-1')
    expect(result.current.selectedSlot?.date).toBe('2026-05-01')
  })

  it('reset clears all state', () => {
    const { result } = renderHook(() => useBookingStore())
    act(() => {
      result.current.setPractitioner('p-1', 'Dr. Diallo')
      result.current.reset()
    })
    expect(result.current.practitionerId).toBeNull()
  })
})
```

**Step 2: Lancer le test (doit échouer)**

```bash
cd apps/mobile && pnpm test -- --testPathPattern=bookingStore
```
Expected: FAIL

**Step 3: Créer `apps/mobile/features/booking/store/bookingStore.ts`**

```typescript
import { create } from 'zustand'
import type { SessionType, PaymentProvider } from '@/types/booking'

interface TimeSlot {
  date: string
  startTime: string
  endTime: string
}

interface BookingState {
  practitionerId: string | null
  practitionerName: string | null
  selectedSlot: TimeSlot | null
  sessionType: SessionType
  paymentProvider: PaymentProvider | null
  amount: number | null
  currency: string
  appointmentId: string | null

  setPractitioner: (id: string, name: string) => void
  setSlot: (slot: TimeSlot) => void
  setSessionType: (type: SessionType) => void
  setPaymentProvider: (provider: PaymentProvider) => void
  setAmount: (amount: number, currency: string) => void
  setAppointmentId: (id: string) => void
  reset: () => void
}

const initialState = {
  practitionerId: null,
  practitionerName: null,
  selectedSlot: null,
  sessionType: 'video' as SessionType,
  paymentProvider: null,
  amount: null,
  currency: 'XOF',
  appointmentId: null,
}

export const useBookingStore = create<BookingState>((set) => ({
  ...initialState,
  setPractitioner: (id, name) => set({ practitionerId: id, practitionerName: name }),
  setSlot: (slot) => set({ selectedSlot: slot }),
  setSessionType: (sessionType) => set({ sessionType }),
  setPaymentProvider: (paymentProvider) => set({ paymentProvider }),
  setAmount: (amount, currency) => set({ amount, currency }),
  setAppointmentId: (appointmentId) => set({ appointmentId }),
  reset: () => set(initialState),
}))
```

**Step 4: Relancer les tests**

```bash
cd apps/mobile && pnpm test -- --testPathPattern=bookingStore
```
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add apps/mobile/features/booking/
git commit -m "feat(booking): add bookingStore with slot + payment state"
git push origin main
```

---

## Task 4 : Edge Function — create-appointment

**Files:**
- Create: `supabase/functions/create-appointment/index.ts`

**Step 1: Créer `supabase/functions/create-appointment/index.ts`**

```typescript
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
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Vérifie le JWT
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { practitioner_id, scheduled_at, duration_min = 60, type = 'video' } = await req.json()

    // Vérifie que le praticien est approuvé
    const { data: practitioner, error: pErr } = await supabase
      .from('practitioners')
      .select('id, session_price, session_currency, verification_status')
      .eq('id', practitioner_id)
      .single()

    if (pErr || !practitioner) {
      return new Response(JSON.stringify({ error: 'Practitioner not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (practitioner.verification_status !== 'approved') {
      return new Response(JSON.stringify({ error: 'Practitioner not verified' }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Vérifie absence de chevauchement
    const scheduledDate = new Date(scheduled_at)
    const endDate = new Date(scheduledDate.getTime() + duration_min * 60 * 1000)

    const { data: conflicts } = await supabase
      .from('appointments')
      .select('id')
      .eq('practitioner_id', practitioner_id)
      .not('status', 'in', '("cancelled","no_show")')
      .lt('scheduled_at', endDate.toISOString())
      .gt('scheduled_at', new Date(scheduledDate.getTime() - duration_min * 60 * 1000).toISOString())

    if (conflicts && conflicts.length > 0) {
      return new Response(JSON.stringify({ error: 'Slot already taken' }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Crée le RDV
    const { data: appointment, error: aErr } = await supabase
      .from('appointments')
      .insert({
        patient_id: user.id,
        practitioner_id,
        scheduled_at,
        duration_min,
        type,
        status: 'pending',
      })
      .select()
      .single()

    if (aErr) throw aErr

    return new Response(JSON.stringify({
      appointmentId: appointment.id,
      amount: practitioner.session_price,
      currency: practitioner.session_currency,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
```

**Step 2: Commit**

```bash
git add supabase/functions/create-appointment/
git commit -m "feat(functions): add create-appointment Edge Function with conflict check"
git push origin main
```

---

## Task 5 : Edge Function — process-payment

**Files:**
- Create: `supabase/functions/process-payment/index.ts`

**Step 1: Créer `supabase/functions/process-payment/index.ts`**

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

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
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { appointment_id, provider, phone } = await req.json()

    // Vérifie que l'appointment appartient au patient
    const { data: appointment, error: aErr } = await supabase
      .from('appointments')
      .select('id, patient_id, practitioner_id, status')
      .eq('id', appointment_id)
      .single()

    if (aErr || !appointment) {
      return new Response(JSON.stringify({ error: 'Appointment not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (appointment.patient_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Récupère le montant du praticien
    const { data: practitioner } = await supabase
      .from('practitioners')
      .select('session_price, session_currency')
      .eq('id', appointment.practitioner_id)
      .single()

    // Crée le paiement en processing
    const { data: payment, error: pErr } = await supabase
      .from('payments')
      .insert({
        appointment_id,
        patient_id: user.id,
        practitioner_id: appointment.practitioner_id,
        amount: practitioner?.session_price ?? 0,
        currency: practitioner?.session_currency ?? 'XOF',
        provider: provider ?? 'simulated',
        provider_ref: `SIM-${Date.now()}`,
        status: 'processing',
        metadata: { phone: phone ?? null, simulated: true },
      })
      .select()
      .single()

    if (pErr) throw pErr

    // Simulation paiement : délai 1.5s
    await delay(1500)

    // Met à jour payment → completed
    await supabase
      .from('payments')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', payment.id)

    // Confirme le RDV + lie le payment_id
    await supabase
      .from('appointments')
      .update({ status: 'confirmed', payment_id: payment.id })
      .eq('id', appointment_id)

    return new Response(JSON.stringify({
      paymentId: payment.id,
      status: 'completed',
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
```

**Step 2: Commit**

```bash
git add supabase/functions/process-payment/
git commit -m "feat(functions): add process-payment Edge Function with simulated provider"
git push origin main
```

---

## Task 6 : Hooks TanStack Query — praticiens + créneaux

**Files:**
- Create: `apps/mobile/features/practitioners/hooks/usePractitioners.ts`
- Create: `apps/mobile/features/practitioners/hooks/usePractitioner.ts`
- Create: `apps/mobile/features/practitioners/hooks/useAvailability.ts`
- Create: `apps/mobile/features/booking/hooks/useCreateAppointment.ts`
- Create: `apps/mobile/features/booking/hooks/usePayment.ts`

**Step 1: Créer `apps/mobile/features/practitioners/hooks/usePractitioners.ts`**

```typescript
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import type { PractitionerFilter } from '@/types/booking'
import type { Practitioner } from '@/types/database'

export interface PractitionerWithUser extends Practitioner {
  users: { full_name: string; avatar_url: string | null }
}

export function usePractitioners(filters: PractitionerFilter = {}) {
  return useQuery({
    queryKey: ['practitioners', filters],
    queryFn: async (): Promise<PractitionerWithUser[]> => {
      let query = supabase
        .from('practitioners')
        .select('*, users(full_name, avatar_url)')
        .eq('verification_status', 'approved')
        .eq('is_verified', true)

      if (filters.speciality) {
        query = query.ilike('speciality', `%${filters.speciality}%`)
      }
      if (filters.language) {
        query = query.contains('languages', [filters.language])
      }
      if (filters.maxPrice) {
        query = query.lte('session_price', filters.maxPrice)
      }

      const { data, error } = await query.order('rating', { ascending: false })
      if (error) throw error
      return (data ?? []) as PractitionerWithUser[]
    },
    staleTime: 5 * 60 * 1000, // 5 min
  })
}
```

**Step 2: Créer `apps/mobile/features/practitioners/hooks/usePractitioner.ts`**

```typescript
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import type { PractitionerWithUser } from './usePractitioners'

export function usePractitioner(id: string) {
  return useQuery({
    queryKey: ['practitioner', id],
    queryFn: async (): Promise<PractitionerWithUser | null> => {
      const { data, error } = await supabase
        .from('practitioners')
        .select('*, users(full_name, avatar_url)')
        .eq('id', id)
        .single()
      if (error) return null
      return data as PractitionerWithUser
    },
    enabled: !!id,
  })
}
```

**Step 3: Créer `apps/mobile/features/practitioners/hooks/useAvailability.ts`**

```typescript
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import type { TimeSlot } from '@/types/booking'

function generateSlots(
  availabilities: Array<{ day_of_week: number; start_time: string; end_time: string }>,
  takenSlots: string[],
  durationMin: number,
  daysAhead = 14
): TimeSlot[] {
  const slots: TimeSlot[] = []
  const today = new Date()

  for (let d = 0; d < daysAhead; d++) {
    const date = new Date(today)
    date.setDate(today.getDate() + d)
    const dayOfWeek = date.getDay()
    const dateStr = date.toISOString().split('T')[0]

    const dayAvail = availabilities.filter(a => a.day_of_week === dayOfWeek)

    for (const avail of dayAvail) {
      const [startH, startM] = avail.start_time.split(':').map(Number)
      const [endH, endM] = avail.end_time.split(':').map(Number)
      let currentMinutes = startH * 60 + startM
      const endMinutes = endH * 60 + endM

      while (currentMinutes + durationMin <= endMinutes) {
        const startHour = Math.floor(currentMinutes / 60).toString().padStart(2, '0')
        const startMin = (currentMinutes % 60).toString().padStart(2, '0')
        const endMins = currentMinutes + durationMin
        const endHour = Math.floor(endMins / 60).toString().padStart(2, '0')
        const endMinStr = (endMins % 60).toString().padStart(2, '0')

        const slotKey = `${dateStr}T${startHour}:${startMin}:00`
        slots.push({
          date: dateStr,
          start_time: `${startHour}:${startMin}`,
          end_time: `${endHour}:${endMinStr}`,
          available: !takenSlots.includes(slotKey),
        })

        currentMinutes += durationMin
      }
    }
  }

  return slots
}

export function useAvailability(practitionerId: string, durationMin = 60) {
  return useQuery({
    queryKey: ['availability', practitionerId, durationMin],
    queryFn: async (): Promise<TimeSlot[]> => {
      const [{ data: avails }, { data: appointments }] = await Promise.all([
        supabase
          .from('availabilities')
          .select('day_of_week, start_time, end_time')
          .eq('practitioner_id', practitionerId)
          .eq('is_active', true),
        supabase
          .from('appointments')
          .select('scheduled_at')
          .eq('practitioner_id', practitionerId)
          .not('status', 'in', '("cancelled","no_show")')
          .gte('scheduled_at', new Date().toISOString()),
      ])

      const takenSlots = (appointments ?? []).map(a =>
        a.scheduled_at.substring(0, 19)
      )

      return generateSlots(avails ?? [], takenSlots, durationMin)
    },
    enabled: !!practitionerId,
    staleTime: 2 * 60 * 1000,
  })
}
```

**Step 4: Créer `apps/mobile/features/booking/hooks/useCreateAppointment.ts`**

```typescript
import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import type { CreateAppointmentRequest, CreateAppointmentResponse } from '@/types/booking'

export function useCreateAppointment() {
  return useMutation({
    mutationFn: async (data: CreateAppointmentRequest): Promise<CreateAppointmentResponse> => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-appointment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(data),
        }
      )

      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Failed to create appointment')
      return result
    },
  })
}
```

**Step 5: Créer `apps/mobile/features/booking/hooks/usePayment.ts`**

```typescript
import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import type { ProcessPaymentRequest, ProcessPaymentResponse } from '@/types/booking'

export function usePayment() {
  return useMutation({
    mutationFn: async (data: ProcessPaymentRequest): Promise<ProcessPaymentResponse> => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/process-payment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(data),
        }
      )

      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Payment failed')
      return result
    },
  })
}
```

**Step 6: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

**Step 7: Commit**

```bash
git add apps/mobile/features/
git commit -m "feat(booking): add TanStack Query hooks for practitioners, availability, and payment mutations"
git push origin main
```

---

## Task 7 : Composants UI praticiens

**Files:**
- Create: `apps/mobile/features/practitioners/components/PractitionerCard.tsx`
- Create: `apps/mobile/features/practitioners/components/FilterBar.tsx`
- Create: `apps/mobile/features/practitioners/components/RatingStars.tsx`
- Create: `apps/mobile/features/practitioners/components/WeekCalendar.tsx`
- Create: `apps/mobile/features/practitioners/components/SlotPicker.tsx`
- Create: `apps/mobile/features/booking/components/PaymentSheet.tsx`

**Step 1: `PractitionerCard.tsx`**

```typescript
import { View, Text, TouchableOpacity } from 'react-native'
import type { PractitionerWithUser } from '../hooks/usePractitioners'

interface PractitionerCardProps {
  practitioner: PractitionerWithUser
  onPress: () => void
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

export function PractitionerCard({ practitioner, onPress }: PractitionerCardProps) {
  const name = practitioner.users?.full_name ?? 'Praticien'
  const isAvailable = practitioner.verification_status === 'approved'

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className="bg-white/60 rounded-xl p-4 border border-white/80 flex-row gap-3 items-start"
      style={{ shadowColor: '#006685', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 }}
    >
      {/* Avatar initiales */}
      <View className="w-14 h-14 rounded-xl bg-primary-container items-center justify-center">
        <Text className="text-primary font-manrope font-bold text-lg">{getInitials(name)}</Text>
      </View>

      {/* Infos */}
      <View className="flex-1 gap-1">
        <View className="flex-row items-center justify-between">
          <Text className="text-base font-semibold text-on-surface font-manrope" numberOfLines={1}>
            {name}
          </Text>
          {isAvailable && (
            <View className="bg-emerald-50 px-2 py-0.5 rounded-full">
              <Text className="text-xs text-emerald-600 font-manrope font-medium">Disponible</Text>
            </View>
          )}
        </View>

        <Text className="text-sm text-on-surface-variant font-manrope">{practitioner.speciality}</Text>

        <View className="flex-row items-center justify-between mt-1">
          <View className="flex-row items-center gap-1">
            <Text className="text-amber-400 text-sm">★</Text>
            <Text className="text-sm text-on-surface-variant font-manrope">
              {practitioner.rating?.toFixed(1) ?? 'N/A'}
            </Text>
            <Text className="text-xs text-outline font-manrope">
              ({practitioner.total_reviews})
            </Text>
          </View>
          <Text className="text-sm font-semibold text-primary font-manrope">
            {practitioner.session_price?.toLocaleString()} {practitioner.session_currency}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}
```

**Step 2: `RatingStars.tsx`**

```typescript
import { View, Text } from 'react-native'

interface RatingStarsProps {
  rating: number
  total?: number
  size?: 'sm' | 'md'
}

export function RatingStars({ rating, total, size = 'md' }: RatingStarsProps) {
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm'
  return (
    <View className="flex-row items-center gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <Text key={i} className={`${textSize} ${i <= Math.round(rating) ? 'text-amber-400' : 'text-outline-variant'}`}>
          ★
        </Text>
      ))}
      <Text className={`${textSize} text-on-surface-variant font-manrope`}>
        {rating.toFixed(1)}{total ? ` (${total})` : ''}
      </Text>
    </View>
  )
}
```

**Step 3: `FilterBar.tsx`**

```typescript
import { ScrollView, TouchableOpacity, Text, View } from 'react-native'

const SPECIALITIES = ['Psychologue', 'Psychiatre', 'Thérapeute', 'Coach', 'Nutritionniste']
const LANGUAGES = ['Français', 'English', 'Wolof']

interface FilterBarProps {
  activeSpeciality: string | null
  activeLanguage: string | null
  onSpecialityChange: (s: string | null) => void
  onLanguageChange: (l: string | null) => void
}

export function FilterBar({ activeSpeciality, activeLanguage, onSpecialityChange, onLanguageChange }: FilterBarProps) {
  return (
    <View className="gap-2">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="gap-2">
        <View className="flex-row gap-2 px-1 py-1">
          {SPECIALITIES.map(s => (
            <TouchableOpacity
              key={s}
              onPress={() => onSpecialityChange(activeSpeciality === s ? null : s)}
              className={`px-3 py-1.5 rounded-full border ${
                activeSpeciality === s ? 'bg-primary border-primary' : 'border-outline-variant bg-white/60'
              }`}
            >
              <Text className={`text-xs font-manrope font-medium ${activeSpeciality === s ? 'text-white' : 'text-on-surface'}`}>
                {s}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-2 px-1 pb-1">
          {LANGUAGES.map(l => (
            <TouchableOpacity
              key={l}
              onPress={() => onLanguageChange(activeLanguage === l ? null : l)}
              className={`px-3 py-1.5 rounded-full border ${
                activeLanguage === l ? 'bg-secondary-container border-secondary-container' : 'border-outline-variant bg-white/60'
              }`}
            >
              <Text className={`text-xs font-manrope font-medium ${activeLanguage === l ? 'text-on-surface' : 'text-on-surface'}`}>
                {l}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}
```

**Step 4: `WeekCalendar.tsx`**

```typescript
import { ScrollView, TouchableOpacity, Text, View } from 'react-native'

const DAY_NAMES = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const MONTH_NAMES = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

interface WeekCalendarProps {
  selectedDate: string | null
  availableDates: string[]
  onSelectDate: (date: string) => void
  daysAhead?: number
}

export function WeekCalendar({ selectedDate, availableDates, onSelectDate, daysAhead = 14 }: WeekCalendarProps) {
  const days = Array.from({ length: daysAhead }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return d
  })

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View className="flex-row gap-2 px-1 py-1">
        {days.map(d => {
          const dateStr = d.toISOString().split('T')[0]
          const isSelected = selectedDate === dateStr
          const hasSlots = availableDates.includes(dateStr)
          const isToday = dateStr === new Date().toISOString().split('T')[0]

          return (
            <TouchableOpacity
              key={dateStr}
              onPress={() => hasSlots && onSelectDate(dateStr)}
              disabled={!hasSlots}
              className={`w-14 py-2 rounded-xl items-center gap-0.5 ${
                isSelected ? 'bg-primary' :
                hasSlots ? 'bg-white/60 border border-white/80' :
                'bg-surface-container opacity-40'
              }`}
            >
              <Text className={`text-xs font-manrope ${isSelected ? 'text-white/70' : 'text-on-surface-variant'}`}>
                {DAY_NAMES[d.getDay()]}
              </Text>
              <Text className={`text-base font-bold font-manrope ${isSelected ? 'text-white' : 'text-on-surface'}`}>
                {d.getDate()}
              </Text>
              <Text className={`text-xs font-manrope ${isSelected ? 'text-white/70' : 'text-on-surface-variant'}`}>
                {MONTH_NAMES[d.getMonth()]}
              </Text>
              {isToday && !isSelected && (
                <View className="w-1 h-1 rounded-full bg-primary mt-0.5" />
              )}
            </TouchableOpacity>
          )
        })}
      </View>
    </ScrollView>
  )
}
```

**Step 5: `SlotPicker.tsx`**

```typescript
import { View, Text, TouchableOpacity, FlatList } from 'react-native'
import type { TimeSlot } from '@/types/booking'

interface SlotPickerProps {
  slots: TimeSlot[]
  selectedDate: string
  selectedSlot: string | null
  onSelectSlot: (slot: TimeSlot) => void
}

export function SlotPicker({ slots, selectedDate, selectedSlot, onSelectSlot }: SlotPickerProps) {
  const daySlots = slots.filter(s => s.date === selectedDate)

  if (daySlots.length === 0) {
    return (
      <View className="py-8 items-center">
        <Text className="text-on-surface-variant font-manrope text-sm">
          Aucun créneau disponible ce jour
        </Text>
      </View>
    )
  }

  return (
    <View className="flex-row flex-wrap gap-2">
      {daySlots.map(slot => {
        const key = `${slot.date}-${slot.start_time}`
        const isSelected = selectedSlot === key
        return (
          <TouchableOpacity
            key={key}
            onPress={() => slot.available && onSelectSlot(slot)}
            disabled={!slot.available}
            className={`px-4 py-2 rounded-lg border ${
              isSelected ? 'bg-primary border-primary' :
              slot.available ? 'bg-white/60 border-outline-variant' :
              'bg-surface-container border-outline-variant opacity-40'
            }`}
          >
            <Text className={`text-sm font-manrope font-medium ${isSelected ? 'text-white' : 'text-on-surface'}`}>
              {slot.start_time}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}
```

**Step 6: `PaymentSheet.tsx`**

```typescript
import { View, Text, TouchableOpacity, TextInput, Modal } from 'react-native'
import { useState } from 'react'
import type { PaymentProvider } from '@/types/booking'
import { PrimaryButton } from '@/components/ui'

interface PaymentSheetProps {
  visible: boolean
  amount: number
  currency: string
  onConfirm: (provider: PaymentProvider, phone?: string) => void
  onClose: () => void
}

const PROVIDERS: Array<{ id: PaymentProvider; label: string; emoji: string; needsPhone: boolean }> = [
  { id: 'wave', label: 'Wave', emoji: '💙', needsPhone: true },
  { id: 'orange_money', label: 'Orange Money', emoji: '🟠', needsPhone: true },
  { id: 'card', label: 'Carte bancaire', emoji: '💳', needsPhone: false },
]

export function PaymentSheet({ visible, amount, currency, onConfirm, onClose }: PaymentSheetProps) {
  const [selected, setSelected] = useState<PaymentProvider | null>(null)
  const [phone, setPhone] = useState('')

  const selectedProvider = PROVIDERS.find(p => p.id === selected)

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity className="flex-1 bg-black/40" activeOpacity={1} onPress={onClose} />
      <View className="bg-background rounded-t-2xl px-6 pt-6 pb-10">
        <View className="w-10 h-1 bg-outline-variant rounded-full self-center mb-6" />
        <Text className="text-lg font-bold text-on-surface font-manrope mb-1">
          Choisir votre moyen de paiement
        </Text>
        <Text className="text-2xl font-black text-primary font-manrope mb-6">
          {amount?.toLocaleString()} {currency}
        </Text>

        <View className="gap-3 mb-6">
          {PROVIDERS.map(p => (
            <TouchableOpacity
              key={p.id}
              onPress={() => setSelected(p.id)}
              className={`flex-row items-center gap-3 p-4 rounded-xl border ${
                selected === p.id ? 'border-primary bg-primary-container/30' : 'border-outline-variant bg-white/60'
              }`}
            >
              <Text className="text-2xl">{p.emoji}</Text>
              <Text className="flex-1 text-base font-manrope font-medium text-on-surface">
                {p.label}
              </Text>
              <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
                selected === p.id ? 'border-primary' : 'border-outline-variant'
              }`}>
                {selected === p.id && <View className="w-2.5 h-2.5 rounded-full bg-primary" />}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {selectedProvider?.needsPhone && (
          <View className="mb-6 gap-1">
            <Text className="text-sm font-manrope font-medium text-on-surface-variant">
              Numéro {selectedProvider.label}
            </Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="+221 77 000 00 00"
              keyboardType="phone-pad"
              className="border border-outline-variant rounded-lg px-4 py-3 text-base font-manrope text-on-surface bg-surface-container-low"
              placeholderTextColor="#6f787e"
            />
          </View>
        )}

        <PrimaryButton
          label={`Payer ${amount?.toLocaleString()} ${currency}`}
          onPress={() => selected && onConfirm(selected, phone || undefined)}
          disabled={!selected || (selectedProvider?.needsPhone && !phone)}
        />
      </View>
    </Modal>
  )
}
```

**Step 7: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

**Step 8: Commit**

```bash
git add apps/mobile/features/
git commit -m "feat(ui): add practitioner and booking components (PractitionerCard, FilterBar, WeekCalendar, SlotPicker, PaymentSheet)"
git push origin main
```

---

## Task 8 : Écran Find Practitioners

**Files:**
- Create: `apps/mobile/app/(patient)/find-practitioners.tsx`

> Référence UI : `find_a_practitioner/code.html`

**Step 1: Créer `apps/mobile/app/(patient)/find-practitioners.tsx`**

```typescript
import { useState } from 'react'
import { View, Text, FlatList, TextInput, SafeAreaView, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { usePractitioners } from '@/features/practitioners/hooks/usePractitioners'
import { PractitionerCard } from '@/features/practitioners/components/PractitionerCard'
import { FilterBar } from '@/features/practitioners/components/FilterBar'
import { useBookingStore } from '@/features/booking/store/bookingStore'

export default function FindPractitionersScreen() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [speciality, setSpeciality] = useState<string | null>(null)
  const [language, setLanguage] = useState<string | null>(null)

  const { data: practitioners, isLoading, error } = usePractitioners({
    speciality: speciality ?? undefined,
    language: language ?? undefined,
  })

  const { setPractitioner } = useBookingStore()

  const filtered = practitioners?.filter(p =>
    !search || p.users?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.speciality.toLowerCase().includes(search.toLowerCase())
  ) ?? []

  const handleSelect = (p: typeof filtered[0]) => {
    setPractitioner(p.id, p.users?.full_name ?? 'Praticien')
    router.push(`/(patient)/practitioner/${p.id}`)
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="px-6 pt-6 pb-4 gap-4">
        <Text className="text-2xl font-bold text-on-surface font-manrope">
          Trouver un praticien
        </Text>

        {/* Search */}
        <View className="flex-row items-center bg-white/60 rounded-xl border border-white/80 px-4 gap-2">
          <Text className="text-outline">🔍</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Nom, spécialité..."
            className="flex-1 py-3 text-base font-manrope text-on-surface"
            placeholderTextColor="#6f787e"
          />
        </View>

        <FilterBar
          activeSpeciality={speciality}
          activeLanguage={language}
          onSpecialityChange={setSpeciality}
          onLanguageChange={setLanguage}
        />
      </View>

      {/* Liste */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#006685" size="large" />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-error font-manrope text-center">
            Impossible de charger les praticiens
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 24, gap: 12 }}
          renderItem={({ item }) => (
            <PractitionerCard practitioner={item} onPress={() => handleSelect(item)} />
          )}
          ListEmptyComponent={
            <View className="py-12 items-center">
              <Text className="text-on-surface-variant font-manrope">
                Aucun praticien trouvé
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}
```

**Step 2: Commit**

```bash
git add apps/mobile/app/(patient)/find-practitioners.tsx
git commit -m "feat(screens): add FindPractitioners screen with search and filters"
git push origin main
```

---

## Task 9 : Écran Profil Praticien

**Files:**
- Create: `apps/mobile/app/(patient)/practitioner/[id].tsx`

> Référence UI : `practitioner_profile_public/code.html`

**Step 1: Créer `apps/mobile/app/(patient)/practitioner/[id].tsx`**

```typescript
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { usePractitioner } from '@/features/practitioners/hooks/usePractitioner'
import { RatingStars } from '@/features/practitioners/components/RatingStars'
import { PrimaryButton } from '@/components/ui'

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

export default function PractitionerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { data: practitioner, isLoading } = usePractitioner(id)

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#006685" size="large" />
      </SafeAreaView>
    )
  }

  if (!practitioner) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <Text className="text-error font-manrope">Praticien introuvable</Text>
      </SafeAreaView>
    )
  }

  const name = practitioner.users?.full_name ?? 'Praticien'

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Header */}
        <View className="px-6 pt-4 pb-6">
          <TouchableOpacity onPress={() => router.back()} className="mb-4">
            <Text className="text-primary font-manrope font-medium">← Retour</Text>
          </TouchableOpacity>

          <View className="items-center gap-4">
            <View className="w-24 h-24 rounded-2xl bg-primary-container items-center justify-center">
              <Text className="text-primary font-manrope font-bold text-3xl">{getInitials(name)}</Text>
            </View>
            <View className="items-center gap-1">
              <Text className="text-2xl font-bold text-on-surface font-manrope">{name}</Text>
              <Text className="text-base text-on-surface-variant font-manrope">{practitioner.speciality}</Text>
              {practitioner.rating && (
                <RatingStars rating={practitioner.rating} total={practitioner.total_reviews} />
              )}
            </View>
          </View>
        </View>

        {/* Infos */}
        <View className="px-6 gap-4">
          {/* Bio */}
          {practitioner.bio && (
            <View className="bg-white/60 rounded-xl p-4 border border-white/80">
              <Text className="text-sm font-bold text-on-surface font-manrope mb-2 uppercase tracking-wide">
                À propos
              </Text>
              <Text className="text-sm text-on-surface-variant font-manrope leading-relaxed">
                {practitioner.bio}
              </Text>
            </View>
          )}

          {/* Détails session */}
          <View className="bg-white/60 rounded-xl p-4 border border-white/80 gap-3">
            <Text className="text-sm font-bold text-on-surface font-manrope uppercase tracking-wide">
              Informations
            </Text>
            <View className="flex-row justify-between">
              <Text className="text-sm text-on-surface-variant font-manrope">Tarif</Text>
              <Text className="text-sm font-semibold text-primary font-manrope">
                {practitioner.session_price?.toLocaleString()} {practitioner.session_currency}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-sm text-on-surface-variant font-manrope">Durée</Text>
              <Text className="text-sm font-semibold text-on-surface font-manrope">
                {practitioner.session_duration_min} min
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-sm text-on-surface-variant font-manrope">Langues</Text>
              <Text className="text-sm font-semibold text-on-surface font-manrope">
                {practitioner.languages.join(', ')}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* CTA fixe */}
      <View className="absolute bottom-0 left-0 right-0 px-6 pb-8 pt-4 bg-background/90">
        <PrimaryButton
          label="Réserver une séance"
          onPress={() => router.push(`/(patient)/booking/${id}`)}
        />
      </View>
    </SafeAreaView>
  )
}
```

**Step 2: Commit**

```bash
git add apps/mobile/app/(patient)/practitioner/
git commit -m "feat(screens): add PractitionerProfile screen"
git push origin main
```

---

## Task 10 : Écran Sélection créneau

**Files:**
- Create: `apps/mobile/app/(patient)/booking/[practitionerId].tsx`

> Référence UI : `booking_selection/code.html`

**Step 1: Créer `apps/mobile/app/(patient)/booking/[practitionerId].tsx`**

```typescript
import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { usePractitioner } from '@/features/practitioners/hooks/usePractitioner'
import { useAvailability } from '@/features/practitioners/hooks/useAvailability'
import { WeekCalendar } from '@/features/practitioners/components/WeekCalendar'
import { SlotPicker } from '@/features/practitioners/components/SlotPicker'
import { PrimaryButton } from '@/components/ui'
import { useBookingStore } from '@/features/booking/store/bookingStore'
import type { SessionType, TimeSlot } from '@/types/booking'

const SESSION_TYPES: Array<{ id: SessionType; label: string; emoji: string }> = [
  { id: 'video', label: 'Vidéo', emoji: '📹' },
  { id: 'audio', label: 'Audio', emoji: '🎙️' },
  { id: 'chat', label: 'Chat', emoji: '💬' },
]

export default function BookingScreen() {
  const { practitionerId } = useLocalSearchParams<{ practitionerId: string }>()
  const router = useRouter()
  const { data: practitioner } = usePractitioner(practitionerId)
  const { data: slots, isLoading } = useAvailability(
    practitionerId,
    practitioner?.session_duration_min ?? 60
  )

  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedSlotKey, setSelectedSlotKey] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [sessionType, setSessionType] = useState<SessionType>('video')

  const { setSlot, setSessionType: storeSetSessionType, setPractitioner } = useBookingStore()

  const availableDates = [...new Set((slots ?? []).filter(s => s.available).map(s => s.date))]

  const handleSlotSelect = (slot: TimeSlot) => {
    setSelectedSlotKey(`${slot.date}-${slot.start_time}`)
    setSelectedSlot(slot)
  }

  const handleConfirm = () => {
    if (!selectedSlot || !practitioner) return
    setPractitioner(practitionerId, practitioner.users?.full_name ?? 'Praticien')
    setSlot({
      date: selectedSlot.date,
      startTime: selectedSlot.start_time,
      endTime: selectedSlot.end_time,
    })
    storeSetSessionType(sessionType)
    router.push('/(patient)/confirm-session')
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View className="px-6 pt-4 mb-6">
          <TouchableOpacity onPress={() => router.back()} className="mb-4">
            <Text className="text-primary font-manrope font-medium">← Retour</Text>
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-on-surface font-manrope">
            Choisir un créneau
          </Text>
          <Text className="text-sm text-on-surface-variant font-manrope mt-1">
            {practitioner?.users?.full_name} · {practitioner?.session_duration_min} min
          </Text>
        </View>

        {/* Type de session */}
        <View className="px-6 mb-6">
          <Text className="text-sm font-semibold text-on-surface font-manrope mb-3">
            Type de consultation
          </Text>
          <View className="flex-row gap-2">
            {SESSION_TYPES.map(t => (
              <TouchableOpacity
                key={t.id}
                onPress={() => setSessionType(t.id)}
                className={`flex-1 py-3 rounded-xl border items-center gap-1 ${
                  sessionType === t.id ? 'bg-primary border-primary' : 'bg-white/60 border-white/80'
                }`}
              >
                <Text className="text-lg">{t.emoji}</Text>
                <Text className={`text-xs font-manrope font-medium ${sessionType === t.id ? 'text-white' : 'text-on-surface'}`}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Calendrier */}
        <View className="mb-6">
          <Text className="text-sm font-semibold text-on-surface font-manrope px-6 mb-3">
            Choisir une date
          </Text>
          {isLoading ? (
            <View className="h-20 items-center justify-center">
              <ActivityIndicator color="#006685" />
            </View>
          ) : (
            <WeekCalendar
              selectedDate={selectedDate}
              availableDates={availableDates}
              onSelectDate={setSelectedDate}
            />
          )}
        </View>

        {/* Créneaux */}
        {selectedDate && (
          <View className="px-6">
            <Text className="text-sm font-semibold text-on-surface font-manrope mb-3">
              Créneaux disponibles
            </Text>
            <SlotPicker
              slots={slots ?? []}
              selectedDate={selectedDate}
              selectedSlot={selectedSlotKey}
              onSelectSlot={handleSlotSelect}
            />
          </View>
        )}
      </ScrollView>

      {/* CTA fixe */}
      {selectedSlot && (
        <View className="absolute bottom-0 left-0 right-0 px-6 pb-8 pt-4 bg-background/90">
          <PrimaryButton
            label={`Confirmer — ${selectedSlot.start_time} le ${selectedSlot.date}`}
            onPress={handleConfirm}
          />
        </View>
      )}
    </SafeAreaView>
  )
}
```

**Step 2: Commit**

```bash
git add apps/mobile/app/(patient)/booking/
git commit -m "feat(screens): add Booking screen with WeekCalendar + SlotPicker + session type selector"
git push origin main
```

---

## Task 11 : Écrans Confirm Session + Payment Processing + Booking Success

**Files:**
- Create: `apps/mobile/app/(patient)/confirm-session.tsx`
- Create: `apps/mobile/app/(patient)/payment/processing.tsx`
- Create: `apps/mobile/app/(patient)/booking-success.tsx`

> Référence UI : `confirm_session/`, `payment_confirmation/`, `booking_success_1/`

**Step 1: Créer `apps/mobile/app/(patient)/confirm-session.tsx`**

```typescript
import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { useBookingStore } from '@/features/booking/store/bookingStore'
import { useCreateAppointment } from '@/features/booking/hooks/useCreateAppointment'
import { PaymentSheet } from '@/features/booking/components/PaymentSheet'
import { PrimaryButton, GlassCard } from '@/components/ui'
import type { PaymentProvider } from '@/types/booking'

export default function ConfirmSessionScreen() {
  const router = useRouter()
  const [sheetVisible, setSheetVisible] = useState(false)
  const {
    practitionerName, selectedSlot, sessionType, amount, currency,
    paymentProvider, setPaymentProvider, setAppointmentId, practitionerId,
  } = useBookingStore()

  const createAppointment = useCreateAppointment()

  const SESSION_LABELS = { video: 'Vidéo', audio: 'Audio', chat: 'Chat' }

  const handlePaymentConfirm = async (provider: PaymentProvider, phone?: string) => {
    setSheetVisible(false)
    setPaymentProvider(provider)

    if (!practitionerId || !selectedSlot) return

    const scheduledAt = `${selectedSlot.date}T${selectedSlot.startTime}:00`

    try {
      const result = await createAppointment.mutateAsync({
        practitioner_id: practitionerId,
        scheduled_at: scheduledAt,
        duration_min: 60,
        type: sessionType,
      })

      setAppointmentId(result.appointmentId)

      router.push({
        pathname: '/(patient)/payment/processing',
        params: { appointmentId: result.appointmentId, provider, phone: phone ?? '' },
      })
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible de créer le RDV')
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="mt-8 mb-6">
          <TouchableOpacity onPress={() => router.back()} className="mb-4">
            <Text className="text-primary font-manrope font-medium">← Retour</Text>
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-on-surface font-manrope">
            Confirmer la session
          </Text>
        </View>

        <GlassCard className="gap-4 mb-6">
          <Text className="text-base font-semibold text-on-surface font-manrope">
            Récapitulatif
          </Text>

          {[
            { label: 'Praticien', value: practitionerName },
            { label: 'Date', value: selectedSlot?.date },
            { label: 'Heure', value: selectedSlot ? `${selectedSlot.startTime} → ${selectedSlot.endTime}` : '' },
            { label: 'Type', value: SESSION_LABELS[sessionType] },
          ].map(({ label, value }) => (
            <View key={label} className="flex-row justify-between">
              <Text className="text-sm text-on-surface-variant font-manrope">{label}</Text>
              <Text className="text-sm font-semibold text-on-surface font-manrope">{value}</Text>
            </View>
          ))}

          <View className="border-t border-outline-variant pt-3 flex-row justify-between">
            <Text className="text-base font-bold text-on-surface font-manrope">Total</Text>
            <Text className="text-base font-black text-primary font-manrope">
              {amount?.toLocaleString()} {currency}
            </Text>
          </View>
        </GlassCard>

        <PrimaryButton
          label="Procéder au paiement"
          onPress={() => setSheetVisible(true)}
          loading={createAppointment.isPending}
        />
      </ScrollView>

      <PaymentSheet
        visible={sheetVisible}
        amount={amount ?? 0}
        currency={currency}
        onConfirm={handlePaymentConfirm}
        onClose={() => setSheetVisible(false)}
      />
    </SafeAreaView>
  )
}
```

**Step 2: Créer `apps/mobile/app/(patient)/payment/processing.tsx`**

```typescript
import { useEffect } from 'react'
import { View, Text, ActivityIndicator, SafeAreaView, Alert } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { usePayment } from '@/features/booking/hooks/usePayment'
import type { PaymentProvider } from '@/types/booking'

export default function PaymentProcessingScreen() {
  const { appointmentId, provider, phone } = useLocalSearchParams<{
    appointmentId: string
    provider: PaymentProvider
    phone?: string
  }>()
  const router = useRouter()
  const processPayment = usePayment()

  const PROVIDER_LABELS: Record<string, string> = {
    wave: 'Wave',
    orange_money: 'Orange Money',
    card: 'Carte bancaire',
    simulated: 'Paiement',
  }

  useEffect(() => {
    const run = async () => {
      try {
        await processPayment.mutateAsync({
          appointment_id: appointmentId,
          provider: provider as PaymentProvider,
          phone: phone || undefined,
        })
        router.replace('/(patient)/booking-success')
      } catch (e) {
        Alert.alert(
          'Paiement échoué',
          e instanceof Error ? e.message : 'Une erreur est survenue',
          [{ text: 'Retour', onPress: () => router.back() }]
        )
      }
    }
    run()
  }, [])

  return (
    <SafeAreaView className="flex-1 bg-background items-center justify-center gap-6 px-6">
      <View className="w-20 h-20 bg-primary-container rounded-full items-center justify-center">
        <ActivityIndicator color="#006685" size="large" />
      </View>
      <View className="items-center gap-2">
        <Text className="text-xl font-bold text-on-surface font-manrope">
          Traitement en cours
        </Text>
        <Text className="text-sm text-on-surface-variant font-manrope text-center">
          {PROVIDER_LABELS[provider ?? 'simulated']} — veuillez patienter...
        </Text>
      </View>
    </SafeAreaView>
  )
}
```

**Step 3: Créer `apps/mobile/app/(patient)/booking-success.tsx`**

```typescript
import { View, Text, SafeAreaView } from 'react-native'
import { useRouter } from 'expo-router'
import { useBookingStore } from '@/features/booking/store/bookingStore'
import { PrimaryButton, GlassCard } from '@/components/ui'

export default function BookingSuccessScreen() {
  const router = useRouter()
  const { practitionerName, selectedSlot, sessionType, reset } = useBookingStore()

  const SESSION_LABELS = { video: 'Vidéo', audio: 'Audio', chat: 'Chat' }

  const handleHome = () => {
    reset()
    router.replace('/(patient)/home')
  }

  return (
    <SafeAreaView className="flex-1 bg-background px-6 justify-center gap-8">
      {/* Icône succès */}
      <View className="items-center gap-4">
        <View className="w-24 h-24 bg-emerald-50 rounded-full items-center justify-center">
          <Text className="text-5xl">✅</Text>
        </View>
        <View className="items-center gap-2">
          <Text className="text-2xl font-black text-on-surface font-manrope">
            Vous êtes prêt !
          </Text>
          <Text className="text-sm text-on-surface-variant font-manrope text-center">
            Votre rendez-vous a été confirmé avec succès.
          </Text>
        </View>
      </View>

      {/* Détails RDV */}
      <GlassCard className="gap-3">
        {[
          { label: '👨‍⚕️ Praticien', value: practitionerName },
          { label: '📅 Date', value: selectedSlot?.date },
          { label: '🕐 Heure', value: selectedSlot?.startTime },
          { label: '📹 Type', value: SESSION_LABELS[sessionType] },
        ].map(({ label, value }) => value ? (
          <View key={label} className="flex-row justify-between">
            <Text className="text-sm text-on-surface-variant font-manrope">{label}</Text>
            <Text className="text-sm font-semibold text-on-surface font-manrope">{value}</Text>
          </View>
        ) : null)}
      </GlassCard>

      {/* CTAs */}
      <View className="gap-3">
        <PrimaryButton label="Retour à l'accueil" onPress={handleHome} />
      </View>
    </SafeAreaView>
  )
}
```

**Step 4: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add apps/mobile/app/(patient)/
git commit -m "feat(screens): add ConfirmSession, PaymentProcessing, BookingSuccess screens"
git push origin main
```

---

## Task 12 : Navigation patient + QueryClient setup

**Files:**
- Modify: `apps/mobile/app/(patient)/home.tsx`
- Create: `apps/mobile/app/_providers.tsx`
- Modify: `apps/mobile/app/_layout.tsx`

**Step 1: Modifier `apps/mobile/app/(patient)/home.tsx`**

Remplace le placeholder par un vrai home patient :

```typescript
import { View, Text, TouchableOpacity, SafeAreaView } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { PrimaryButton } from '@/components/ui'
import { useAuthStore } from '@/features/auth/store/authStore'

export default function PatientHome() {
  const router = useRouter()
  const { profile } = useAuth()
  const { signOut } = useAuthStore()

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-6 pt-8 gap-6">
        {/* Header */}
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-sm text-on-surface-variant font-manrope">Bonjour,</Text>
            <Text className="text-2xl font-bold text-on-surface font-manrope">
              {profile?.full_name?.split(' ')[0] ?? 'Patient'} 👋
            </Text>
          </View>
          <TouchableOpacity onPress={signOut}>
            <Text className="text-sm text-outline font-manrope">Déconnexion</Text>
          </TouchableOpacity>
        </View>

        {/* CTA principal */}
        <View className="bg-primary rounded-2xl p-6 gap-2">
          <Text className="text-white/80 text-sm font-manrope">Besoin d'aide ?</Text>
          <Text className="text-white text-xl font-bold font-manrope">
            Trouvez votre praticien
          </Text>
          <Text className="text-white/70 text-sm font-manrope">
            +200 spécialistes disponibles
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(patient)/find-practitioners')}
            className="bg-white/20 rounded-xl py-3 items-center mt-2"
          >
            <Text className="text-white font-semibold font-manrope">Rechercher →</Text>
          </TouchableOpacity>
        </View>

        {/* Actions rapides */}
        <View className="gap-3">
          <Text className="text-base font-semibold text-on-surface font-manrope">
            Actions rapides
          </Text>
          <PrimaryButton
            label="Trouver un praticien"
            onPress={() => router.push('/(patient)/find-practitioners')}
          />
        </View>
      </View>
    </SafeAreaView>
  )
}
```

**Step 2: Créer `apps/mobile/app/_providers.tsx`**

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode } from 'react'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000,
    },
  },
})

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
```

**Step 3: Modifier `apps/mobile/app/_layout.tsx`**

Entoure le `<Stack>` avec `<Providers>` :

```typescript
import { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { Providers } from './_providers'
import { useAuthStore } from '@/features/auth/store/authStore'
import { supabase, fetchUserProfile, fetchPractitionerProfile } from '@/services/supabase'

export default function RootLayout() {
  const {
    isAuthenticated, profile, isLoading,
    setSession, setProfile, setPractitioner, setLoading,
  } = useAuthStore()
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
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
      }
    )
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
      if (segments[0] !== '(practitioner)') router.replace('/(practitioner)/home')
    } else {
      if (segments[0] !== '(patient)') router.replace('/(patient)/home')
    }
  }, [isAuthenticated, profile, isLoading])

  return (
    <Providers>
      <Stack screenOptions={{ headerShown: false }} />
    </Providers>
  )
}
```

**Step 4: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add apps/mobile/app/
git commit -m "feat(providers): add QueryClient provider + update PatientHome with navigation"
git push origin main
```

---

## Task 13 : Vérification finale P1

**Step 1: Typecheck complet**

```bash
cd apps/mobile && npx tsc --noEmit
```
Expected: 0 erreurs

**Step 2: Tests**

```bash
cd apps/mobile && pnpm test -- --coverage
```
Expected: bookingStore (3 tests PASS)

**Step 3: Vérifier la structure complète**

```bash
find apps/mobile/app/\(patient\) -name "*.tsx" | sort
find apps/mobile/features -name "*.ts" -o -name "*.tsx" | sort
find supabase/functions -name "*.ts" | sort
```

Expected :
- 9 écrans patient (home, find-practitioners, practitioner/[id], booking/[id], confirm-session, payment/processing, booking-success + layouts)
- Hooks, composants, store booking présents
- 2 Edge Functions créées

**Step 4: Vérification flow manuel**

Sur simulateur/Expo Go, tester :
- [ ] Home patient affiche le nom du patient
- [ ] "Trouver un praticien" ouvre la liste
- [ ] Filtres spécialité/langue fonctionnent
- [ ] Profil praticien affiche bio + tarif
- [ ] Sélection créneau affiche le calendrier
- [ ] PaymentSheet s'ouvre avec Wave/OM/Carte
- [ ] Processing → BookingSuccess (flow complet)

**Step 5: Commit final**

```bash
git add -A
git commit -m "feat(p1): complete booking+payment flow — search, profile, slot selection, payment simulation"
git push origin main
```

---

## Récapitulatif

| # | Tâche | Tests |
|---|-------|-------|
| 1 | Migrations DB (availabilities, appointments, payments, RLS) | supabase db reset |
| 2 | Types TypeScript booking | typecheck |
| 3 | Zustand bookingStore | 3 unit tests |
| 4 | Edge Function create-appointment | manuel |
| 5 | Edge Function process-payment | manuel |
| 6 | Hooks TanStack Query (praticiens, créneaux, mutations) | typecheck |
| 7 | Composants UI (PractitionerCard, FilterBar, WeekCalendar, SlotPicker, PaymentSheet) | typecheck |
| 8 | Écran FindPractitioners | manuel |
| 9 | Écran PractitionerProfile | manuel |
| 10 | Écran Booking (créneau) | manuel |
| 11 | Écrans ConfirmSession + PaymentProcessing + BookingSuccess | manuel |
| 12 | QueryClient provider + PatientHome | typecheck |
| 13 | Vérification finale | full |
