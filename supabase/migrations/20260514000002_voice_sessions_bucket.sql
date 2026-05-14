-- Create voice-sessions storage bucket for Mounima voice responses
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voice-sessions',
  'voice-sessions',
  false,
  10485760,  -- 10 MB limit per file
  ARRAY['audio/mpeg', 'audio/mp4']
)
ON CONFLICT (id) DO NOTHING;

-- Only authenticated users can read from the voice-sessions bucket
-- (access controlled further via signed URLs generated server-side)
CREATE POLICY "auth_users_voice_read" ON storage.objects
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND bucket_id = 'voice-sessions'
  );

-- Service role (edge function) can write voice files
CREATE POLICY "service_role_voice_write" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'voice-sessions');
