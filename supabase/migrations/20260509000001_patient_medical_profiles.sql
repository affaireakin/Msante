-- Patient medical profiles
CREATE TABLE IF NOT EXISTS public.patient_medical_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  blood_type TEXT CHECK (blood_type IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Inconnu')),
  allergies TEXT[] DEFAULT '{}',
  chronic_conditions TEXT[] DEFAULT '{}',
  current_medications TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  height_cm INT,
  weight_kg NUMERIC(5,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(patient_id)
);

ALTER TABLE public.patient_medical_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patients_own_medical_profile" ON public.patient_medical_profiles
  FOR ALL USING (auth.uid() = patient_id);

CREATE POLICY "practitioners_read_patient_profiles" ON public.patient_medical_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      JOIN public.practitioners p ON p.id = a.practitioner_id
      WHERE a.patient_id = patient_medical_profiles.patient_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "admins_full_medical_profiles" ON public.patient_medical_profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX idx_patient_medical_profiles_patient ON public.patient_medical_profiles(patient_id);

-- Storage bucket for verification documents (run once)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false) ON CONFLICT DO NOTHING;
