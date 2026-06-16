-- ─── 1. Sync email from auth.users to public.users ───────────────────────────
-- Adds an email column and a trigger to keep it in sync automatically.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;

-- Back-fill existing rows from auth.users
UPDATE public.users u
SET email = au.email
FROM auth.users au
WHERE au.id = u.id AND u.email IS NULL;

-- Trigger function: runs on INSERT and UPDATE on auth.users
CREATE OR REPLACE FUNCTION public.sync_user_email()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.users SET email = NEW.email WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

-- Drop if already exists, then recreate
DROP TRIGGER IF EXISTS on_auth_user_email_change ON auth.users;
CREATE TRIGGER on_auth_user_email_change
  AFTER INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.sync_user_email();

-- ─── 2. Message threads — track conversation closed status ────────────────────
-- Conversations are identified by the two participant IDs (LEAST/GREATEST).
-- Only practitioners can close a conversation.

CREATE TABLE IF NOT EXISTS public.message_threads (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_a UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  participant_b UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  closed_at     TIMESTAMPTZ,
  closed_by     UUID        REFERENCES public.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (participant_a, participant_b),
  CONSTRAINT participants_ordered CHECK (participant_a < participant_b)
);

CREATE INDEX IF NOT EXISTS idx_message_threads_participants
  ON public.message_threads (participant_a, participant_b);

ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;

-- Both participants can see the thread metadata
CREATE POLICY "thread_participants_read" ON public.message_threads
  FOR SELECT USING (participant_a = auth.uid() OR participant_b = auth.uid());

-- Practitioners can insert (open) and update (close) threads
CREATE POLICY "thread_participants_write" ON public.message_threads
  FOR INSERT WITH CHECK (participant_a = auth.uid() OR participant_b = auth.uid());

CREATE POLICY "thread_close_update" ON public.message_threads
  FOR UPDATE USING (participant_a = auth.uid() OR participant_b = auth.uid());

-- Admins full access
CREATE POLICY "admins_all_threads" ON public.message_threads
  FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
