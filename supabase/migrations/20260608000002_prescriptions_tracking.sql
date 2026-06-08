CREATE TYPE prescription_status AS ENUM ('draft', 'signed', 'dispensed', 'cancelled');

CREATE TABLE public.prescriptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id   UUID REFERENCES public.consultations(id),
  appointment_id    UUID NOT NULL REFERENCES public.appointments(id),
  practitioner_id   UUID NOT NULL REFERENCES public.practitioners(id),
  patient_id        UUID NOT NULL REFERENCES public.users(id),
  medications       JSONB NOT NULL DEFAULT '[]',
  diagnosis         TEXT,
  instructions      TEXT,
  pdf_url           TEXT,
  pdf_generated_at  TIMESTAMPTZ,
  status            prescription_status NOT NULL DEFAULT 'draft',
  signed_at         TIMESTAMPTZ,
  consultation_type TEXT DEFAULT 'video'
    CHECK (consultation_type IN ('video', 'audio', 'presentiel', 'standalone')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prescriptions_patient ON prescriptions(patient_id, created_at DESC);
CREATE INDEX idx_prescriptions_practitioner ON prescriptions(practitioner_id, created_at DESC);
CREATE INDEX idx_prescriptions_appointment ON prescriptions(appointment_id);

ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patients_read_own_prescriptions" ON public.prescriptions
  FOR SELECT USING (auth.uid() = patient_id);

CREATE POLICY "practitioners_manage_own_prescriptions" ON public.prescriptions
  FOR ALL
  USING (auth.uid() = (SELECT user_id FROM practitioners WHERE id = practitioner_id))
  WITH CHECK (auth.uid() = (SELECT user_id FROM practitioners WHERE id = practitioner_id));

CREATE POLICY "admins_all_prescriptions" ON public.prescriptions
  FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- updated_at trigger (reuse existing function if it exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at') THEN
    CREATE FUNCTION update_updated_at()
    RETURNS TRIGGER LANGUAGE plpgsql AS $func$
    BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
    $func$;
  END IF;
END $$;

CREATE TRIGGER prescriptions_updated_at
  BEFORE UPDATE ON prescriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
