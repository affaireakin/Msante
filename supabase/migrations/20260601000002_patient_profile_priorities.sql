-- Add priorities and avatar_url to patient profiles
ALTER TABLE public.patient_medical_profiles
  ADD COLUMN IF NOT EXISTS priorities TEXT[] DEFAULT '{}';

-- Add avatar_url to users table (optional for patients, mandatory check in app for practitioners)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;
