-- supabase/migrations/20260502000002_consultations.sql

CREATE TABLE public.consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  room_name TEXT,
  room_url TEXT,
  patient_token TEXT,
  practitioner_token TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_actual_min INT,
  chat_history JSONB DEFAULT '[]',
  ai_summary TEXT,
  prescription_url TEXT,
  status TEXT DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'active', 'ended')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_consultations_appointment ON public.consultations(appointment_id);
CREATE INDEX idx_consultations_status ON public.consultations(status);

-- RLS
ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;

-- Patient: SELECT only
CREATE POLICY "patient_own_consultations" ON public.consultations
  FOR SELECT USING (
    appointment_id IN (
      SELECT id FROM public.appointments WHERE patient_id = auth.uid()
    )
  );

-- Practitioner: SELECT only
CREATE POLICY "practitioner_own_consultations" ON public.consultations
  FOR SELECT USING (
    appointment_id IN (
      SELECT a.id FROM public.appointments a
      JOIN public.practitioners p ON p.id = a.practitioner_id
      WHERE p.user_id = auth.uid()
    )
  );

-- Edge Functions bypass (service_role)
CREATE POLICY "edge_functions_manage_consultations" ON public.consultations
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "admin_all_consultations" ON public.consultations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Bucket prescriptions
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('prescriptions', 'prescriptions', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "practitioner_upload_prescription" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'prescriptions' AND
    EXISTS (
      SELECT 1 FROM public.consultations c
      JOIN public.appointments a ON a.id = c.appointment_id
      JOIN public.practitioners p ON p.id = a.practitioner_id
      WHERE c.id::text = (storage.foldername(name))[1]
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "patient_read_own_prescription" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'prescriptions' AND
    EXISTS (
      SELECT 1 FROM public.consultations c
      JOIN public.appointments a ON a.id = c.appointment_id
      WHERE c.id::text = (storage.foldername(name))[1]
        AND a.patient_id = auth.uid()
    )
  );
