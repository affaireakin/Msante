-- Mounima (the AI wellness companion) had no memory across page loads —
-- every visit started from zero, forcing patients to re-explain their
-- situation each time. This is arguably the most sensitive data category in
-- the app (raw mental-health chat, including crisis disclosures), so access
-- is restricted to the patient themself only — no admin/practitioner
-- override, unlike most other tables.
CREATE TABLE public.mounima_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT NOT NULL,
  is_crisis   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mounima_messages_patient ON public.mounima_messages(patient_id, created_at);

ALTER TABLE public.mounima_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patients_own_mounima_messages" ON public.mounima_messages
  FOR ALL
  USING (auth.uid() = patient_id)
  WITH CHECK (auth.uid() = patient_id);
