-- Professional info on practitioners (for prescription letterhead)
ALTER TABLE public.practitioners
  ADD COLUMN IF NOT EXISTS professional_title TEXT,
  ADD COLUMN IF NOT EXISTS registration_number TEXT,
  ADD COLUMN IF NOT EXISTS clinic_address TEXT;

-- Store prescription/report text content on consultations
ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS prescription_content TEXT,
  ADD COLUMN IF NOT EXISTS document_type TEXT DEFAULT 'prescription';

-- Prescriptions bucket: any authenticated user can read/write
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'prescriptions_insert_auth'
  ) THEN
    EXECUTE $p$CREATE POLICY "prescriptions_insert_auth" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'prescriptions' AND auth.uid() IS NOT NULL)$p$;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'prescriptions_select_auth'
  ) THEN
    EXECUTE $p$CREATE POLICY "prescriptions_select_auth" ON storage.objects FOR SELECT USING (bucket_id = 'prescriptions' AND auth.uid() IS NOT NULL)$p$;
  END IF;
END $$;
