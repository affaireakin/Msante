-- Admin-managed whitelist of countries selectable in the phone-number
-- country picker at signup. Only Sénégal starts active — the admin
-- "unlocks" (activates) additional countries from /admin/countries as the
-- platform expands, per business request.
CREATE TABLE IF NOT EXISTS public.allowed_countries (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  iso_code   TEXT        NOT NULL UNIQUE,
  dial_code  TEXT        NOT NULL,
  flag_emoji TEXT        NOT NULL,
  label      TEXT        NOT NULL,
  is_active  BOOLEAN     NOT NULL DEFAULT FALSE,
  sort_order INT         NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.allowed_countries (iso_code, dial_code, flag_emoji, label, is_active, sort_order) VALUES
  ('SN', '+221', '🇸🇳', 'Sénégal',        TRUE,  1),
  ('CI', '+225', '🇨🇮', 'Côte d''Ivoire', FALSE, 2),
  ('ML', '+223', '🇲🇱', 'Mali',           FALSE, 3),
  ('CM', '+237', '🇨🇲', 'Cameroun',       FALSE, 4),
  ('GN', '+224', '🇬🇳', 'Guinée',         FALSE, 5),
  ('BF', '+226', '🇧🇫', 'Burkina Faso',   FALSE, 6),
  ('BJ', '+229', '🇧🇯', 'Bénin',          FALSE, 7),
  ('TG', '+228', '🇹🇬', 'Togo',           FALSE, 8),
  ('NE', '+227', '🇳🇪', 'Niger',          FALSE, 9),
  ('MR', '+222', '🇲🇷', 'Mauritanie',     FALSE, 10),
  ('GA', '+241', '🇬🇦', 'Gabon',          FALSE, 11),
  ('CD', '+243', '🇨🇩', 'RD Congo',       FALSE, 12),
  ('CG', '+242', '🇨🇬', 'Congo',          FALSE, 13),
  ('MA', '+212', '🇲🇦', 'Maroc',          FALSE, 14),
  ('TN', '+216', '🇹🇳', 'Tunisie',        FALSE, 15),
  ('DZ', '+213', '🇩🇿', 'Algérie',        FALSE, 16),
  ('FR', '+33',  '🇫🇷', 'France',         FALSE, 17),
  ('BE', '+32',  '🇧🇪', 'Belgique',       FALSE, 18),
  ('CH', '+41',  '🇨🇭', 'Suisse',         FALSE, 19),
  ('CA', '+1',   '🇨🇦', 'Canada',         FALSE, 20)
ON CONFLICT (iso_code) DO NOTHING;

ALTER TABLE public.allowed_countries ENABLE ROW LEVEL SECURITY;

-- Read must be open to "anon" too (not just "authenticated"): the signup
-- form renders this picker before any session exists.
CREATE POLICY "read_active_countries" ON public.allowed_countries
  FOR SELECT TO anon, authenticated
  USING (
    is_active = TRUE
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "admin_manage_countries" ON public.allowed_countries
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- Carry phone/country through from signUp's metadata (previously only
-- role/full_name were copied; phone was only ever set later at onboarding,
-- optionally). Patients now submit it as mandatory at signup.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, role, full_name, phone, country)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'patient'),
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'country', 'SN')
  );
  RETURN NEW;
END;
$$;
