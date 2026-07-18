-- Gestion de projet intégrée (section 8 du cahier des charges) : tickets
-- internes à l'équipe admin (bug/évolution/support/incident/tâche), workflow
-- kanban, commentaires, pièces jointes, historique.

CREATE TYPE ticket_type AS ENUM ('bug', 'evolution', 'support', 'incident', 'tache');
CREATE TYPE ticket_status AS ENUM ('a_faire', 'en_cours', 'en_test', 'corrige', 'valide', 'deploye');
CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');

CREATE TABLE public.tickets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  description   TEXT,
  type          ticket_type NOT NULL DEFAULT 'tache',
  priority      ticket_priority NOT NULL DEFAULT 'medium',
  status        ticket_status NOT NULL DEFAULT 'a_faire',
  assignee_id   UUID REFERENCES public.users(id),
  due_date      DATE,
  created_by    UUID NOT NULL REFERENCES public.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_tickets_status ON public.tickets(status);
CREATE INDEX idx_tickets_assignee ON public.tickets(assignee_id);

CREATE TABLE public.ticket_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES public.users(id),
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ticket_comments_ticket ON public.ticket_comments(ticket_id, created_at);

CREATE TABLE public.ticket_attachments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id     UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  file_url      TEXT NOT NULL,
  file_name     TEXT NOT NULL,
  uploaded_by   UUID NOT NULL REFERENCES public.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ticket_attachments_ticket ON public.ticket_attachments(ticket_id);

CREATE TABLE public.ticket_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  actor_id        UUID REFERENCES public.users(id),
  field_changed   TEXT NOT NULL,
  old_value       TEXT,
  new_value       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ticket_history_ticket ON public.ticket_history(ticket_id, created_at);

-- Auto-log status/assignee/priority changes so the ticket has a real history
-- without every UI action having to remember to write one.
CREATE OR REPLACE FUNCTION public.log_ticket_changes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.ticket_history (ticket_id, actor_id, field_changed, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'status', OLD.status::text, NEW.status::text);
  END IF;
  IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
    INSERT INTO public.ticket_history (ticket_id, actor_id, field_changed, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'assignee_id', OLD.assignee_id::text, NEW.assignee_id::text);
  END IF;
  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    INSERT INTO public.ticket_history (ticket_id, actor_id, field_changed, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'priority', OLD.priority::text, NEW.priority::text);
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_log_ticket_changes
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.log_ticket_changes();

-- RLS: internal admin-team tool. Any admin (whatever sub_role) can see/act on
-- everything — per-sub-role restrictions are a separate, later concern
-- (granular admin roles).
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_all_tickets" ON public.tickets FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_all_ticket_comments" ON public.ticket_comments FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_all_ticket_attachments" ON public.ticket_attachments FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

ALTER TABLE public.ticket_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_read_ticket_history" ON public.ticket_history FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Storage bucket for ticket attachments (screenshots, logs, etc.)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ticket-attachments', 'ticket-attachments', false, 20971520,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain', 'application/zip']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "ticket_attachment_admin_rw" ON storage.objects FOR ALL USING (
  bucket_id = 'ticket-attachments' AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Realtime so the board updates live across admins working the same queue.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tickets', 'ticket_comments', 'ticket_attachments']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
