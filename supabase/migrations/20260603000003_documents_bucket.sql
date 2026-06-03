-- Bucket for practitioner verification documents
-- Public so getPublicUrl works and admins can open documents directly
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  TRUE,
  52428800, -- 50MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Practitioners can upload their own docs (path: {user_id}/type_timestamp.ext)
CREATE POLICY "documents_upload_own"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Practitioners can update/delete their own docs
CREATE POLICY "documents_update_own"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "documents_delete_own"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Public read (bucket is public, admins can open document URLs directly)
CREATE POLICY "documents_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'documents');
