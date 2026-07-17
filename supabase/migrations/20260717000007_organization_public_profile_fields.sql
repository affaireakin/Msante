-- The patient-facing organization marketplace needs a description and
-- opening hours to show on the public profile — neither existed on
-- organizations (only internal/admin fields were captured at onboarding).
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS opening_hours TEXT;
