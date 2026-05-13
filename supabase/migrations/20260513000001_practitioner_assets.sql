-- Add stamp and signature columns to practitioners
ALTER TABLE public.practitioners
  ADD COLUMN IF NOT EXISTS stamp_url     TEXT,
  ADD COLUMN IF NOT EXISTS signature_url TEXT;

-- Avatar bucket (public) — one per user
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Practitioner assets bucket (private) — stamp + signature
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'practitioner-assets',
  'practitioner-assets',
  false,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: users can read/write only their own avatar
CREATE POLICY "users_own_avatar_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "users_own_avatar_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "users_own_avatar_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Public read for avatars (profile photos visible to patients)
CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- RLS: practitioners can read/write only their own assets
CREATE POLICY "practitioner_assets_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'practitioner-assets'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "practitioner_assets_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'practitioner-assets'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "practitioner_assets_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'practitioner-assets'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
