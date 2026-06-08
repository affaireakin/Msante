CREATE TABLE public.patient_data_permissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  practitioner_id UUID NOT NULL REFERENCES public.practitioners(id) ON DELETE CASCADE,
  allow_medical_history       BOOLEAN NOT NULL DEFAULT TRUE,
  allow_biological_analyses   BOOLEAN NOT NULL DEFAULT FALSE,
  allow_prescriptions         BOOLEAN NOT NULL DEFAULT TRUE,
  allow_consultation_reports  BOOLEAN NOT NULL DEFAULT TRUE,
  allow_psychological_data    BOOLEAN NOT NULL DEFAULT FALSE,
  allow_gynecological_data    BOOLEAN NOT NULL DEFAULT FALSE,
  allow_shared_documents      BOOLEAN NOT NULL DEFAULT TRUE,
  allow_appointment_history   BOOLEAN NOT NULL DEFAULT TRUE,
  allow_mood_journal          BOOLEAN NOT NULL DEFAULT FALSE,
  granted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(patient_id, practitioner_id)
);

CREATE INDEX idx_data_permissions_patient ON patient_data_permissions(patient_id);
CREATE INDEX idx_data_permissions_practitioner ON patient_data_permissions(practitioner_id);

ALTER TABLE public.patient_data_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patients_own_permissions" ON public.patient_data_permissions
  FOR ALL
  USING (auth.uid() = patient_id)
  WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "practitioners_read_own_permissions" ON public.patient_data_permissions
  FOR SELECT USING (
    auth.uid() = (SELECT user_id FROM practitioners WHERE id = practitioner_id)
  );

CREATE POLICY "admins_all_permissions" ON public.patient_data_permissions
  FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE TRIGGER permissions_updated_at
  BEFORE UPDATE ON patient_data_permissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create default permissions when appointment is confirmed
CREATE OR REPLACE FUNCTION create_default_permissions()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    INSERT INTO public.patient_data_permissions (patient_id, practitioner_id)
    VALUES (NEW.patient_id, NEW.practitioner_id)
    ON CONFLICT (patient_id, practitioner_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_create_permissions
  AFTER UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION create_default_permissions();

-- Also fire on INSERT (in case appointment is created already confirmed)
CREATE TRIGGER auto_create_permissions_on_insert
  AFTER INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION create_default_permissions();
