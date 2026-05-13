-- Sync schema with changes applied directly in previous session.
-- Safe to re-run (IF NOT EXISTS / IF NOT FOUND guards on every statement).

-- 1. users: date_of_birth, email, push_token, push_token_updated_at
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS push_token TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS push_token_updated_at TIMESTAMPTZ;

-- 2. consultations: separate tokens + room_name
--    (original schema only had room_token TEXT)
ALTER TABLE public.consultations ADD COLUMN IF NOT EXISTS room_name TEXT;
ALTER TABLE public.consultations ADD COLUMN IF NOT EXISTS patient_token TEXT;
ALTER TABLE public.consultations ADD COLUMN IF NOT EXISTS practitioner_token TEXT;

-- 3. Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_consultations_appointment ON public.consultations(appointment_id);
CREATE INDEX IF NOT EXISTS idx_users_push_token ON public.users(push_token) WHERE push_token IS NOT NULL;
