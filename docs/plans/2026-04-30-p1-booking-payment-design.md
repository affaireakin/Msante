# Design — P1 Recherche + Réservation + Paiement
> M-Santé Super App · 2026-04-30

## Contexte

Module core patient — permet de trouver un praticien, réserver un créneau et payer. Prérequis : P0 Auth + Onboarding complété.

---

## Décisions de design

| Sujet | Décision |
|-------|----------|
| Architecture lecture | TanStack Query → Supabase direct |
| Architecture écriture | Edge Functions (create-appointment + process-payment) |
| Paiement P1 | Simulation (architecture Provider Pattern prête pour Wave/OM réels) |
| Créneaux | Statiques récurrents (availabilities table) |
| Confirmation RDV | Automatique après paiement simulé réussi |
| Filtres recherche | Spécialité + langue + tarif max + disponibilité |
| Source de vérité UI | Maquettes HTML dans les dossiers du projet |

---

## Flow patient

```
find-practitioners → practitioner/[id] → booking/[practitionerId]
→ confirm-session → payment/processing → booking-success
```

---

## Structure de fichiers

```
apps/mobile/
├── app/(patient)/
│   ├── find-practitioners.tsx
│   ├── practitioner/[id].tsx
│   ├── booking/[practitionerId].tsx
│   ├── confirm-session.tsx
│   ├── payment/processing.tsx
│   └── booking-success.tsx
│
├── features/
│   ├── practitioners/
│   │   ├── hooks/usePractitioners.ts
│   │   ├── hooks/usePractitioner.ts
│   │   ├── hooks/useAvailability.ts
│   │   ├── components/PractitionerCard.tsx
│   │   ├── components/FilterBar.tsx
│   │   ├── components/SlotPicker.tsx
│   │   ├── components/WeekCalendar.tsx
│   │   └── components/RatingStars.tsx
│   │
│   └── booking/
│       ├── hooks/useCreateAppointment.ts
│       ├── hooks/usePayment.ts
│       ├── components/PaymentSheet.tsx
│       ├── store/bookingStore.ts
│       └── services/paymentProviders.ts
│
└── supabase/functions/
    ├── create-appointment/index.ts
    └── process-payment/index.ts
```

---

## Base de données

### Nouvelles tables

**`public.availabilities`** — créneaux récurrents praticien
```sql
CREATE TABLE public.availabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id UUID NOT NULL REFERENCES public.practitioners(id),
  day_of_week INT CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT TRUE
);
```

**`public.appointments`** + **`public.payments`** — tables existantes dans CLAUDE.md

### RLS additions
- `appointments` : INSERT pour patient (patient_id = auth.uid())
- `payments` : INSERT pour patient (patient_id = auth.uid())
- `availabilities` : SELECT public (is_active = TRUE)

---

## Edge Functions

### `create-appointment`
```
POST { practitioner_id, scheduled_at, duration_min, type }
1. Vérifie JWT patient
2. Vérifie praticien approved
3. Vérifie absence de chevauchement (lock)
4. INSERT appointments → status: 'pending'
5. Retourne { appointmentId, amount, currency }
```

### `process-payment`
```
POST { appointment_id, provider, phone? }
1. Vérifie JWT + ownership
2. INSERT payments → status: 'processing'
3. Simulation 1.5s → succès
4. UPDATE payments → 'completed'
5. UPDATE appointments → 'confirmed'
6. Retourne { paymentId, status: 'completed' }
```

---

## Zustand bookingStore

```typescript
interface BookingState {
  practitionerId: string | null
  practitionerName: string | null
  selectedSlot: { date: string; startTime: string; endTime: string } | null
  sessionType: 'video' | 'audio' | 'chat'
  paymentProvider: 'wave' | 'orange_money' | 'card' | null
  amount: number | null
  appointmentId: string | null
  setSlot: (slot) => void
  setPaymentProvider: (provider) => void
  reset: () => void
}
```

---

## Architecture paiement (Provider Pattern)

```typescript
interface PaymentProvider {
  name: string
  initiate(amount: number, currency: string, phone?: string): Promise<PaymentIntent>
}

// P1 — SimulatedProvider (délai 1.5s → succès)
// P2 — WaveProvider + OrangeMoneyProvider (plug-and-play)
```

---

## Écrans (6)

| Écran | Route | Référence UI |
|-------|-------|--------------|
| Find Practitioners | `/(patient)/find-practitioners` | `find_a_practitioner/` |
| Profil praticien | `/(patient)/practitioner/[id]` | `practitioner_profile_public/` |
| Sélection créneau | `/(patient)/booking/[practitionerId]` | `booking_selection/` |
| Confirmation session | `/(patient)/confirm-session` | `confirm_session/` |
| Paiement en cours | `/(patient)/payment/processing` | `payment_confirmation/` |
| Succès réservation | `/(patient)/booking-success` | `booking_success_1/` |

## Composants nouveaux (6)

| Composant | Description |
|-----------|-------------|
| `<PractitionerCard />` | Avatar initiales + nom + spécialité + rating + prix |
| `<FilterBar />` | Chips scrollables spécialité/langue/tarif |
| `<SlotPicker />` | Grille créneaux horaires |
| `<WeekCalendar />` | Calendrier horizontal 7 jours |
| `<PaymentSheet />` | Bottom sheet Wave/OM/Card |
| `<RatingStars />` | Étoiles notation |
