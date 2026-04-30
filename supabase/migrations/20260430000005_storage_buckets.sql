-- Bucket pour les documents de vérification des praticiens
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'verification-documents',
  'verification-documents',
  FALSE,
  52428800, -- 50MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Politique : les praticiens peuvent uploader leurs propres documents
CREATE POLICY "practitioners_upload_own_docs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'verification-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Politique : les praticiens peuvent lire leurs propres documents
CREATE POLICY "practitioners_read_own_docs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'verification-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Politique : les admins peuvent tout lire
CREATE POLICY "admins_read_all_docs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'verification-documents'
  AND EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
  )
);
