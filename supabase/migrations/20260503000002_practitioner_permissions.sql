ALTER TABLE public.practitioners
  ADD COLUMN IF NOT EXISTS practitioner_type TEXT DEFAULT 'doctor'
    CHECK (practitioner_type IN ('doctor', 'psychologist', 'coach', 'nutritionist', 'other')),
  ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{"can_prescribe": true, "can_order_exams": true}';

-- Index pour requêtes admin par type
CREATE INDEX IF NOT EXISTS idx_practitioners_type ON practitioners(practitioner_type);
