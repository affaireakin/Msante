-- supabase/migrations/20260513000003_p2_schema.sql

-- ── SECTION 2 : Invitations ──
CREATE TABLE IF NOT EXISTS public.invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('admin','moderator','accountant','practitioner')),
  token       UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '48 hours',
  status      TEXT DEFAULT 'pending' CHECK (status IN ('pending','accepted','expired')),
  invited_by  UUID NOT NULL REFERENCES public.users(id),
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_manage_invitations" ON public.invitations
  FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON public.invitations(status);

-- ── SECTION 3 : Refus patient ──
CREATE TABLE IF NOT EXISTS public.practitioner_patient_rules (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id       UUID NOT NULL REFERENCES public.practitioners(id) UNIQUE,
  alert_threshold       INT DEFAULT 2,
  auto_block_threshold  INT DEFAULT 3,
  default_cooldown_days INT DEFAULT 30
);
ALTER TABLE public.practitioner_patient_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "practitioner_own_rules" ON public.practitioner_patient_rules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.practitioners p WHERE p.id = practitioner_id AND p.user_id = auth.uid())
  );

CREATE TABLE IF NOT EXISTS public.practitioner_patient_blocks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id UUID NOT NULL REFERENCES public.practitioners(id),
  patient_id      UUID NOT NULL REFERENCES public.users(id),
  reason          TEXT,
  cooldown_until  DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  unblocked_at    TIMESTAMPTZ,
  UNIQUE(practitioner_id, patient_id)
);
ALTER TABLE public.practitioner_patient_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "practitioner_own_blocks" ON public.practitioner_patient_blocks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.practitioners p WHERE p.id = practitioner_id AND p.user_id = auth.uid())
  );
CREATE INDEX IF NOT EXISTS idx_blocks_practitioner_patient ON public.practitioner_patient_blocks(practitioner_id, patient_id);

-- ── SECTION 4 : Créneaux × prestations ──
CREATE TABLE IF NOT EXISTS public.practitioner_services (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id UUID NOT NULL REFERENCES public.practitioners(id),
  name            TEXT NOT NULL,
  duration_min    INT NOT NULL DEFAULT 60,
  price           NUMERIC(10,2),
  session_types   TEXT[] NOT NULL DEFAULT ARRAY['video'],
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.practitioner_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "practitioner_own_services" ON public.practitioner_services
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.practitioners p WHERE p.id = practitioner_id AND p.user_id = auth.uid())
  );
CREATE POLICY "services_public_read" ON public.practitioner_services
  FOR SELECT USING (is_active = TRUE);

CREATE TABLE IF NOT EXISTS public.availability_day_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id UUID NOT NULL REFERENCES public.practitioners(id),
  day_of_week     INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  allowed_types   TEXT[] NOT NULL DEFAULT ARRAY['video','audio','presentiel'],
  UNIQUE(practitioner_id, day_of_week)
);
ALTER TABLE public.availability_day_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "practitioner_own_day_rules" ON public.availability_day_rules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.practitioners p WHERE p.id = practitioner_id AND p.user_id = auth.uid())
  );
CREATE POLICY "day_rules_public_read" ON public.availability_day_rules FOR SELECT USING (TRUE);

ALTER TABLE public.availabilities
  ADD COLUMN IF NOT EXISTS override_types TEXT[],
  ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES public.practitioner_services(id);

-- ── SECTION 5 : Médecin traitant ──
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS referring_doctor_id UUID REFERENCES public.practitioners(id),
  ADD COLUMN IF NOT EXISTS referring_doctor_status TEXT DEFAULT 'none'
    CHECK (referring_doctor_status IN ('none','pending','accepted','refused'));

DROP POLICY IF EXISTS "referring_doctor_access" ON public.patient_medical_profiles;
CREATE POLICY "referring_doctor_access" ON public.patient_medical_profiles
  FOR SELECT USING (
    auth.uid() = patient_id
    OR EXISTS (
      SELECT 1 FROM public.practitioners p
      JOIN public.users u ON u.referring_doctor_id = p.id
      WHERE p.user_id = auth.uid()
        AND u.id = patient_medical_profiles.patient_id
        AND u.referring_doctor_status = 'accepted'
    )
  );

-- ── SECTION 6 : Statuts praticiens ──
ALTER TABLE public.practitioners
  ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'active'
    CHECK (account_status IN ('active','suspended','blocked')),
  ADD COLUMN IF NOT EXISTS status_reason TEXT,
  ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_changed_by UUID REFERENCES public.users(id);

CREATE TABLE IF NOT EXISTS public.practitioner_status_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id UUID NOT NULL REFERENCES public.practitioners(id),
  old_status      TEXT,
  new_status      TEXT NOT NULL,
  reason          TEXT NOT NULL,
  changed_by      UUID NOT NULL REFERENCES public.users(id),
  changed_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.practitioner_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_read_status_history" ON public.practitioner_status_history
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "practitioner_own_status_history" ON public.practitioner_status_history
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.practitioners p WHERE p.id = practitioner_id AND p.user_id = auth.uid())
  );

CREATE TABLE IF NOT EXISTS public.practitioner_appeals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id UUID NOT NULL REFERENCES public.practitioners(id),
  message         TEXT NOT NULL,
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','reviewed','accepted','rejected')),
  admin_response  TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at     TIMESTAMPTZ,
  reviewed_by     UUID REFERENCES public.users(id)
);
ALTER TABLE public.practitioner_appeals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_manage_appeals" ON public.practitioner_appeals
  FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "practitioner_own_appeals" ON public.practitioner_appeals
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.practitioners p WHERE p.id = practitioner_id AND p.user_id = auth.uid())
  );
