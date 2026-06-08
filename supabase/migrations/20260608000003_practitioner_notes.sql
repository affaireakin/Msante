CREATE TYPE note_type AS ENUM (
  'observation', 'compte_rendu', 'note_suivi', 'bilan', 'alerte', 'prescription_note'
);

CREATE TABLE public.practitioner_notes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id UUID NOT NULL REFERENCES public.practitioners(id),
  patient_id      UUID NOT NULL REFERENCES public.users(id),
  appointment_id  UUID REFERENCES public.appointments(id),
  consultation_id UUID REFERENCES public.consultations(id),
  note_type       note_type NOT NULL DEFAULT 'observation',
  title           TEXT CHECK (length(title) <= 200),
  content         TEXT NOT NULL CHECK (length(content) <= 50000),
  is_shared_with_patient BOOLEAN NOT NULL DEFAULT FALSE,
  shared_at       TIMESTAMPTZ,
  tags            TEXT[] DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_practitioner_notes_patient ON practitioner_notes(patient_id, created_at DESC);
CREATE INDEX idx_practitioner_notes_practitioner ON practitioner_notes(practitioner_id, created_at DESC);

ALTER TABLE public.practitioner_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "practitioners_own_notes" ON public.practitioner_notes
  FOR ALL
  USING (auth.uid() = (SELECT user_id FROM practitioners WHERE id = practitioner_id))
  WITH CHECK (auth.uid() = (SELECT user_id FROM practitioners WHERE id = practitioner_id));

CREATE POLICY "patients_read_shared_notes" ON public.practitioner_notes
  FOR SELECT USING (auth.uid() = patient_id AND is_shared_with_patient = TRUE);

CREATE POLICY "admins_all_notes" ON public.practitioner_notes
  FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE TRIGGER practitioner_notes_updated_at
  BEFORE UPDATE ON practitioner_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
