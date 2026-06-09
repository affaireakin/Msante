-- Patient reviews for practitioners after completed appointments
CREATE TABLE IF NOT EXISTS public.appointment_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  patient_id UUID NOT NULL REFERENCES public.users(id),
  practitioner_id UUID NOT NULL REFERENCES public.practitioners(id),
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  is_anonymous BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_practitioner ON public.appointment_reviews(practitioner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_patient ON public.appointment_reviews(patient_id);

ALTER TABLE public.appointment_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patients_manage_own_reviews" ON public.appointment_reviews
  FOR ALL USING (auth.uid() = patient_id);

CREATE POLICY "practitioners_read_own_reviews" ON public.appointment_reviews
  FOR SELECT USING (
    auth.uid() = (SELECT user_id FROM practitioners WHERE id = practitioner_id LIMIT 1)
  );

CREATE POLICY "admins_all_reviews" ON public.appointment_reviews
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );
