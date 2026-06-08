CREATE TABLE public.profession_permissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profession_key  TEXT NOT NULL UNIQUE,
  profession_label TEXT NOT NULL,
  can_prescribe           BOOLEAN NOT NULL DEFAULT FALSE,
  can_write_observations  BOOLEAN NOT NULL DEFAULT TRUE,
  can_write_reports       BOOLEAN NOT NULL DEFAULT TRUE,
  can_view_full_dossier   BOOLEAN NOT NULL DEFAULT FALSE,
  can_view_analyses       BOOLEAN NOT NULL DEFAULT FALSE,
  can_view_imaging        BOOLEAN NOT NULL DEFAULT FALSE,
  can_share_with_patient  BOOLEAN NOT NULL DEFAULT TRUE,
  can_request_analyses    BOOLEAN NOT NULL DEFAULT FALSE,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.profession_permissions
  (profession_key, profession_label, can_prescribe, can_write_observations, can_write_reports, can_view_full_dossier, can_view_analyses, can_view_imaging, can_request_analyses, description)
VALUES
  ('medecin',         'Médecin',           TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  'Accès complet, prescription autorisée'),
  ('psychiatre',      'Psychiatre',         TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  FALSE, FALSE, 'Prescription autorisée, pas d''imagerie'),
  ('psychologue',     'Psychologue',        FALSE, TRUE,  TRUE,  FALSE, FALSE, FALSE, FALSE, 'Notes et comptes-rendus selon autorisation patient'),
  ('sophrologue',     'Sophrologue',        FALSE, TRUE,  TRUE,  FALSE, FALSE, FALSE, FALSE, 'Notes de suivi, pas d''accès aux données médicales'),
  ('coach',           'Coach Bien-être',    FALSE, FALSE, TRUE,  FALSE, FALSE, FALSE, FALSE, 'Comptes-rendus de séance et suivi objectifs'),
  ('infirmier',       'Infirmier',          FALSE, TRUE,  TRUE,  FALSE, TRUE,  FALSE, FALSE, 'Observations et analyses, pas de prescription'),
  ('kinesitherapeute','Kinésithérapeute',   FALSE, TRUE,  TRUE,  FALSE, FALSE, TRUE,  FALSE, 'Observations et imagerie')
ON CONFLICT (profession_key) DO NOTHING;

ALTER TABLE public.profession_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_profession_permissions" ON public.profession_permissions
  FOR SELECT USING (TRUE);

CREATE POLICY "admins_manage_profession_permissions" ON public.profession_permissions
  FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE TRIGGER profession_permissions_updated_at
  BEFORE UPDATE ON profession_permissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
