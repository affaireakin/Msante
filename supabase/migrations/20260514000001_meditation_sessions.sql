CREATE TABLE IF NOT EXISTS public.meditation_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  duration_min   INT NOT NULL,
  completed_at   TIMESTAMPTZ DEFAULT NOW(),
  session_date   DATE NOT NULL DEFAULT CURRENT_DATE
);

ALTER TABLE public.meditation_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patients_own_meditation" ON public.meditation_sessions
  FOR ALL USING (auth.uid() = patient_id);

CREATE INDEX idx_meditation_sessions_patient_date
  ON public.meditation_sessions(patient_id, session_date DESC);
