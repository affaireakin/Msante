-- Professional prefixes table for display names (Dr, Pr, M., Mme, PhD…)
CREATE TABLE IF NOT EXISTS public.professional_prefixes (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  prefix       TEXT        NOT NULL,
  label        TEXT        NOT NULL,
  allowed_roles TEXT[]     NOT NULL DEFAULT ARRAY['practitioner']::TEXT[],
  is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order   INT         NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed defaults
INSERT INTO public.professional_prefixes (prefix, label, allowed_roles, sort_order) VALUES
  ('Dr',    'Docteur',              ARRAY['practitioner']::TEXT[],                          1),
  ('Pr',    'Professeur',           ARRAY['practitioner']::TEXT[],                          2),
  ('Dr Pr', 'Docteur Professeur',   ARRAY['practitioner']::TEXT[],                          3),
  ('PhD',   'Docteur en recherche', ARRAY['practitioner']::TEXT[],                          4),
  ('M.',    'Monsieur',             ARRAY['patient','practitioner','admin']::TEXT[],         5),
  ('Mme',   'Madame',               ARRAY['patient','practitioner','admin']::TEXT[],         6)
ON CONFLICT DO NOTHING;

-- Add prefix_id to users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS prefix_id UUID REFERENCES public.professional_prefixes(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE public.professional_prefixes ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read active prefixes (needed for dropdowns everywhere)
CREATE POLICY "read_active_prefixes" ON public.professional_prefixes
  FOR SELECT TO authenticated
  USING (
    is_active = TRUE
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Only admins can create / update / delete
CREATE POLICY "admin_manage_prefixes" ON public.professional_prefixes
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
