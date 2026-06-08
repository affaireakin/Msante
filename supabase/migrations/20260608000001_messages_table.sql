-- Messages table for patient ↔ practitioner secure messaging
-- Supports text messages and medical document attachments

-- 1. Enum for attachment types
DO $$ BEGIN
  CREATE TYPE message_attachment_type AS ENUM (
    'analyse',
    'ordonnance',
    'compte_rendu',
    'imagerie',
    'autre'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id        UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id      UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  appointment_id   UUID        REFERENCES public.appointments(id) ON DELETE SET NULL,
  body             TEXT CHECK (length(body) <= 10000),
  attachment_url   TEXT,
  attachment_name  TEXT,
  attachment_type  message_attachment_type,
  read_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT messages_has_content CHECK (
    body IS NOT NULL OR attachment_url IS NOT NULL
  )
);

-- 3. Indexes
-- Conversation index: orders all messages between two users regardless of direction
CREATE INDEX IF NOT EXISTS idx_messages_conversation
  ON public.messages (
    LEAST(sender_id::text, receiver_id::text),
    GREATEST(sender_id::text, receiver_id::text),
    created_at
  );

-- Unread messages index: fast lookup of unread messages per recipient
CREATE INDEX IF NOT EXISTS idx_messages_receiver_unread
  ON public.messages (receiver_id, read_at)
  WHERE read_at IS NULL;

-- 4. Row Level Security
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Users can read messages they sent or received
CREATE POLICY "users_read_own_messages" ON public.messages
  FOR SELECT USING (
    sender_id = auth.uid() OR receiver_id = auth.uid()
  );

-- Users can only send messages as themselves
CREATE POLICY "users_send_messages" ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
  );

-- Users can only mark messages as read when they are the receiver
CREATE POLICY "users_mark_read" ON public.messages
  FOR UPDATE
  USING (receiver_id = auth.uid())
  WITH CHECK (receiver_id = auth.uid());

-- Regular users cannot delete messages (immutable medical record)
-- Admins have full access for moderation and support purposes
CREATE POLICY "admins_all_messages" ON public.messages
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- 5. Storage bucket for message attachments (private, 20MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message-attachments',
  'message-attachments',
  FALSE,
  20971520, -- 20MB
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- 6. Storage RLS policies

-- Users can only upload to their own folder ({uid}/filename)
CREATE POLICY "message_attachments_upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'message-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can only read their own uploaded attachments (own folder)
CREATE POLICY "message_attachments_read"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'message-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Admins can read all attachments for moderation
CREATE POLICY "admins_read_all_attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'message-attachments'
  AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
