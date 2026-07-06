-- Practitioner invitations (OTP) + double validation columns — Phase 6

-- ─────────────────────────────────────────────────────────────────────────────
-- Task 6.1 : practitioner_invitations
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.practitioner_invitations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  firstname       TEXT        NOT NULL,
  lastname        TEXT        NOT NULL,
  email           TEXT        NOT NULL,
  phone           TEXT,
  otp             TEXT        NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','used','expired','cancelled')),
  created_by      UUID        REFERENCES public.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_practitioner_invitations_org ON public.practitioner_invitations(organization_id);
CREATE INDEX idx_practitioner_invitations_email ON public.practitioner_invitations(email);

ALTER TABLE public.practitioner_invitations ENABLE ROW LEVEL SECURITY;

-- Read/write limited to the org (org admin) + super admin.
-- NOTE: the invitee (unauthenticated, or freshly signed-up) never reads this
-- table directly — OTP verification and acceptance go through Edge Functions
-- using the service role, which bypasses RLS by design.
CREATE POLICY "practitioner_invitations_select" ON public.practitioner_invitations
  FOR SELECT USING (
    public.is_super_admin() OR public.is_org_admin(organization_id)
  );

CREATE POLICY "practitioner_invitations_write" ON public.practitioner_invitations
  FOR ALL USING (
    public.is_super_admin() OR public.is_org_admin(organization_id)
  )
  WITH CHECK (
    public.is_super_admin() OR public.is_org_admin(organization_id)
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Task 6.5 : double validation columns
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.practitioners ADD COLUMN IF NOT EXISTS org_validated_at TIMESTAMPTZ;
ALTER TABLE public.practitioners ADD COLUMN IF NOT EXISTS org_validated_by UUID REFERENCES public.users(id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Task 6.4 : appointments.organization_id inherited from the practitioner
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_appointment_organization()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM public.practitioners WHERE id = NEW.practitioner_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_appointment_organization ON public.appointments;
CREATE TRIGGER trg_set_appointment_organization
  BEFORE INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_appointment_organization();
