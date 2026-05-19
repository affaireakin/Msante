ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS practitioner_notes TEXT,
  ADD COLUMN IF NOT EXISTS ai_summary TEXT,
  ADD COLUMN IF NOT EXISTS prescription_url TEXT;
