-- Add current_priorities to patient_medical_profiles
ALTER TABLE public.patient_medical_profiles
  ADD COLUMN IF NOT EXISTS current_priorities TEXT;

-- Add reminder_email to users (separate from auth email, used for notifications)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS reminder_email TEXT;
