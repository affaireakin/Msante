-- Signup and the practitioner profile editor both showed the exact same
-- specialty list regardless of "Professionnel de santé" vs "Praticien
-- bien-être" — signup queried profession_permissions with no filter, and
-- the profile editor used its own separate hardcoded list that mixed both
-- categories. Add a category to filter by.
ALTER TABLE public.profession_permissions
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'healthcare'
    CHECK (category IN ('healthcare', 'wellness'));

UPDATE public.profession_permissions SET category = 'wellness'
  WHERE profession_key IN ('sophrologue', 'coach');
