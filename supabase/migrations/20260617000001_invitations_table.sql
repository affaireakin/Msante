-- ─── Table invitations collaborateurs ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.invitations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT        NOT NULL,
  role        TEXT        NOT NULL CHECK (role IN ('admin', 'moderator', 'accountant', 'practitioner')),
  token       UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  status      TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  invited_by  UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '48 hours',
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invitations_token  ON public.invitations (token);
CREATE INDEX IF NOT EXISTS idx_invitations_email  ON public.invitations (email);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON public.invitations (status);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Admins voient et gèrent toutes les invitations
CREATE POLICY "admins_manage_invitations" ON public.invitations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- N'importe qui peut lire son invitation via le token (pour la page /invite)
CREATE POLICY "public_read_by_token" ON public.invitations
  FOR SELECT USING (true);

-- Job quotidien : marquer les invitations expirées
-- (à déclencher via pg_cron ou un trigger)
CREATE OR REPLACE FUNCTION public.expire_invitations()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.invitations
  SET status = 'expired'
  WHERE status = 'pending' AND expires_at < NOW();
END;
$$;
