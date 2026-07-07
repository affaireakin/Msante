-- Organization logos — patients should recognize which cabinet/clinique a
-- practitioner belongs to when booking.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'organization-logos',
  'organization-logos',
  TRUE,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Path convention: {organization_id}/logo.{ext} — only that org's admin may write.
CREATE POLICY "org_logos_upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'organization-logos'
  AND public.is_org_admin((storage.foldername(name))[1]::uuid)
);

CREATE POLICY "org_logos_update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'organization-logos'
  AND public.is_org_admin((storage.foldername(name))[1]::uuid)
);

CREATE POLICY "org_logos_delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'organization-logos'
  AND public.is_org_admin((storage.foldername(name))[1]::uuid)
);

-- Public read (bucket is public, patients need to see it without restriction)
CREATE POLICY "org_logos_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'organization-logos');
