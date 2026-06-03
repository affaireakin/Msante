-- Documents émis par un praticien pour un patient (plusieurs par consultation)
CREATE TABLE IF NOT EXISTS public.practitioner_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id UUID REFERENCES public.consultations(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.users(id),
  practitioner_id UUID NOT NULL REFERENCES public.practitioners(id),
  document_type TEXT NOT NULL DEFAULT 'prescription'
    CHECK (document_type IN ('prescription', 'report', 'appreciation', 'certificate')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pract_docs_patient ON public.practitioner_documents(patient_id);
CREATE INDEX IF NOT EXISTS idx_pract_docs_consultation ON public.practitioner_documents(consultation_id);
CREATE INDEX IF NOT EXISTS idx_pract_docs_practitioner ON public.practitioner_documents(practitioner_id);

ALTER TABLE public.practitioner_documents ENABLE ROW LEVEL SECURITY;

-- Patient : lecture de ses propres documents
CREATE POLICY "patient_read_own_documents" ON public.practitioner_documents
  FOR SELECT USING (patient_id = auth.uid());

-- Praticien : gestion complète de ses documents
CREATE POLICY "practitioner_manage_own_documents" ON public.practitioner_documents
  FOR ALL USING (
    practitioner_id IN (SELECT id FROM public.practitioners WHERE user_id = auth.uid())
  );

-- Admin
CREATE POLICY "admin_all_documents" ON public.practitioner_documents
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
