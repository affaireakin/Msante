-- ─── Extend profession_permissions with new feature columns ─────────────────
ALTER TABLE public.profession_permissions
  ADD COLUMN IF NOT EXISTS can_view_notes          BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS can_view_prescriptions  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_view_appreciations  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_view_mood_journal   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_teleconsult         BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS allowed_data_categories TEXT[]  NOT NULL DEFAULT '{}';

-- Update existing professions with sensible defaults for new columns
UPDATE public.profession_permissions SET
  can_view_notes         = TRUE,
  can_view_prescriptions = TRUE,
  can_view_appreciations = TRUE,
  can_teleconsult        = TRUE,
  allowed_data_categories = ARRAY['analyses','imagerie','comptes_rendus','ordonnances','antecedents','vaccinations']
WHERE profession_key = 'medecin';

UPDATE public.profession_permissions SET
  can_view_notes         = TRUE,
  can_view_prescriptions = TRUE,
  can_view_appreciations = TRUE,
  can_teleconsult        = TRUE,
  allowed_data_categories = ARRAY['comptes_rendus','ordonnances','antecedents']
WHERE profession_key = 'psychiatre';

UPDATE public.profession_permissions SET
  can_view_notes         = TRUE,
  can_view_prescriptions = FALSE,
  can_view_appreciations = TRUE,
  can_view_mood_journal  = TRUE,
  can_teleconsult        = TRUE,
  allowed_data_categories = ARRAY['psychologie','comptes_rendus']
WHERE profession_key = 'psychologue';

UPDATE public.profession_permissions SET
  can_view_notes         = TRUE,
  can_view_mood_journal  = TRUE,
  can_teleconsult        = TRUE,
  allowed_data_categories = ARRAY['comptes_rendus']
WHERE profession_key IN ('sophrologue', 'coach');

UPDATE public.profession_permissions SET
  can_view_notes         = TRUE,
  can_view_prescriptions = FALSE,
  allowed_data_categories = ARRAY['analyses','comptes_rendus']
WHERE profession_key = 'infirmier';

UPDATE public.profession_permissions SET
  can_view_notes         = TRUE,
  can_view_prescriptions = FALSE,
  allowed_data_categories = ARRAY['imagerie','comptes_rendus']
WHERE profession_key = 'kinesitherapeute';

-- ─── Extend patient_data_permissions ─────────────────────────────────────────
ALTER TABLE public.patient_data_permissions
  ADD COLUMN IF NOT EXISTS access_level TEXT NOT NULL DEFAULT 'limited'
    CHECK (access_level IN ('full', 'limited', 'document_only', 'emergency_only')),
  ADD COLUMN IF NOT EXISTS expires_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS allow_notes           BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS allow_appreciations   BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS allow_mood_journal    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS notes                 TEXT;

-- ─── Patient access audit log ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.patient_access_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  practitioner_id  UUID NOT NULL REFERENCES public.practitioners(id) ON DELETE CASCADE,
  accessed_section TEXT NOT NULL, -- 'notes', 'prescriptions', 'mood_journal', 'analyses', etc.
  accessed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_access_logs_patient ON public.patient_access_logs(patient_id, accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_practitioner ON public.patient_access_logs(practitioner_id);

ALTER TABLE public.patient_access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patients_read_own_logs" ON public.patient_access_logs
  FOR SELECT USING (auth.uid() = patient_id);

CREATE POLICY "admins_all_access_logs" ON public.patient_access_logs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );
