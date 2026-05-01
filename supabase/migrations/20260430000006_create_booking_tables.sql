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
