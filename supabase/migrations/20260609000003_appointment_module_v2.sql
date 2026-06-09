-- ─── Module 1 : Gestion des rendez-vous type Doctolib ───────────────────────

-- Types de consultation (avec couleur, durée, tarif, mode)
CREATE TABLE IF NOT EXISTS public.consultation_types (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id  UUID NOT NULL REFERENCES public.practitioners(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  duration_min     INT  NOT NULL DEFAULT 30,
  price            NUMERIC(10,2),
  currency         TEXT NOT NULL DEFAULT 'XOF',
  color            TEXT NOT NULL DEFAULT '#006685',
  description      TEXT,
  mode             TEXT NOT NULL DEFAULT 'both'
    CHECK (mode IN ('presentiel', 'video', 'both')),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order       INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consult_types_pract ON public.consultation_types(practitioner_id);

ALTER TABLE public.consultation_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pract_manage_own_types" ON public.consultation_types
  FOR ALL USING (
    auth.uid() = (SELECT user_id FROM practitioners WHERE id = practitioner_id LIMIT 1)
  );
CREATE POLICY "public_read_active_types" ON public.consultation_types
  FOR SELECT USING (is_active = TRUE);

-- Lieux de consultation (multi-sites)
CREATE TABLE IF NOT EXISTS public.practitioner_locations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id  UUID NOT NULL REFERENCES public.practitioners(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  address          TEXT,
  city             TEXT,
  is_teleconsult   BOOLEAN NOT NULL DEFAULT FALSE,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_locations_pract ON public.practitioner_locations(practitioner_id);

ALTER TABLE public.practitioner_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pract_manage_own_locations" ON public.practitioner_locations
  FOR ALL USING (
    auth.uid() = (SELECT user_id FROM practitioners WHERE id = practitioner_id LIMIT 1)
  );
CREATE POLICY "public_read_active_locations" ON public.practitioner_locations
  FOR SELECT USING (is_active = TRUE);

-- Disponibilités récurrentes hebdomadaires
CREATE TABLE IF NOT EXISTS public.weekly_availabilities (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id         UUID NOT NULL REFERENCES public.practitioners(id) ON DELETE CASCADE,
  day_of_week             INT  NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Dim, 1=Lun…
  start_time              TIME NOT NULL,
  end_time                TIME NOT NULL,
  location_id             UUID REFERENCES public.practitioner_locations(id) ON DELETE SET NULL,
  consultation_type_ids   UUID[] NOT NULL DEFAULT '{}',
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weekly_avail_pract ON public.weekly_availabilities(practitioner_id);

ALTER TABLE public.weekly_availabilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pract_manage_weekly_avail" ON public.weekly_availabilities
  FOR ALL USING (
    auth.uid() = (SELECT user_id FROM practitioners WHERE id = practitioner_id LIMIT 1)
  );
CREATE POLICY "public_read_weekly_avail" ON public.weekly_availabilities
  FOR SELECT USING (is_active = TRUE);

-- Périodes bloquées (exceptions : congés, formation…)
CREATE TABLE IF NOT EXISTS public.blocked_periods (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id  UUID NOT NULL REFERENCES public.practitioners(id) ON DELETE CASCADE,
  start_date       DATE NOT NULL,
  end_date         DATE NOT NULL,
  start_time       TIME,      -- NULL = journée entière
  end_time         TIME,      -- NULL = journée entière
  reason_type      TEXT NOT NULL DEFAULT 'other'
    CHECK (reason_type IN ('vacation','training','meeting','sick','travel','other')),
  reason_label     TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blocked_pract ON public.blocked_periods(practitioner_id, start_date);

ALTER TABLE public.blocked_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pract_manage_blocked" ON public.blocked_periods
  FOR ALL USING (
    auth.uid() = (SELECT user_id FROM practitioners WHERE id = practitioner_id LIMIT 1)
  );
CREATE POLICY "public_read_blocked" ON public.blocked_periods
  FOR SELECT USING (TRUE);

-- Paramètres de réservation avancés
CREATE TABLE IF NOT EXISTS public.practitioner_booking_settings (
  practitioner_id        UUID PRIMARY KEY REFERENCES public.practitioners(id) ON DELETE CASCADE,
  min_booking_delay_h    INT  NOT NULL DEFAULT 2,
  max_booking_days_ahead INT  NOT NULL DEFAULT 60,
  buffer_between_min     INT  NOT NULL DEFAULT 0,
  max_patients_per_day   INT,
  auto_confirm           BOOLEAN NOT NULL DEFAULT TRUE,
  waitlist_enabled       BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.practitioner_booking_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pract_manage_settings" ON public.practitioner_booking_settings
  FOR ALL USING (
    auth.uid() = (SELECT user_id FROM practitioners WHERE id = practitioner_id LIMIT 1)
  );
CREATE POLICY "public_read_settings" ON public.practitioner_booking_settings
  FOR SELECT USING (TRUE);

-- Seed : insérer les paramètres par défaut pour les praticiens existants
INSERT INTO public.practitioner_booking_settings (practitioner_id)
SELECT id FROM public.practitioners
ON CONFLICT (practitioner_id) DO NOTHING;
