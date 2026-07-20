-- Section 20 : messagerie interne pour l'équipe admin, distincte de la
-- messagerie patient↔praticien (déjà supervisée en lecture seule sur
-- /admin/messages). Couvre Administrateur Général ↔ Administrateurs,
-- Admins ↔ Collaborateurs, Admins ↔ Organisations, Organisations ↔
-- Collaborateurs autorisés, Gestionnaires des incidents ↔ Développeurs,
-- Support ↔ Administrateurs — en pratique, ces paires sont surtout des
-- variantes de "n'importe quel compte admin/organisation" avec des rôles
-- granulaires différents (déjà gérés par le système de rôles des sections
-- 9/12), donc un simple DM 1-à-1 entre comptes admin/organisation couvre
-- l'ensemble sans modèle de contacts séparé par paire.

CREATE TABLE public.internal_messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body              TEXT,
  attachment_url    TEXT,
  attachment_name   TEXT,
  linked_ticket_id  UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  linked_dispute_id UUID REFERENCES public.disputes(id) ON DELETE SET NULL,
  read_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_internal_messages_conversation
  ON public.internal_messages (LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id), created_at);
CREATE INDEX idx_internal_messages_receiver_unread
  ON public.internal_messages (receiver_id, read_at) WHERE read_at IS NULL;

ALTER TABLE public.internal_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "internal_messages_participants_read" ON public.internal_messages FOR SELECT USING (
  auth.uid() = sender_id OR auth.uid() = receiver_id
  OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "internal_messages_send" ON public.internal_messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'organization_admin'))
  AND EXISTS (SELECT 1 FROM public.users WHERE id = receiver_id AND role IN ('admin', 'organization_admin', 'organization_member', 'secretary'))
);
CREATE POLICY "internal_messages_mark_read" ON public.internal_messages FOR UPDATE USING (
  auth.uid() = receiver_id
) WITH CHECK (auth.uid() = receiver_id);

-- Storage bucket for internal message attachments (generic files, not the
-- medical-document categories used by patient↔practitioner messaging).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'internal-message-attachments', 'internal-message-attachments', false, 20971520,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain', 'application/zip', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "internal_attachments_participant_rw" ON storage.objects FOR ALL USING (
  bucket_id = 'internal-message-attachments' AND auth.uid() IS NOT NULL
);

-- Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'internal_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_messages;
  END IF;
END $$;
