-- Secretaries — Task: practitioners (independent or org-affiliated) and org
-- admins can both invite a "Secrétaire" who can manage appointments.
--
-- Two paths, one dashboard:
--  * Independent/personal secretary: linked directly to ONE practitioner via
--    practitioner_secretaries. No organization involved.
--  * Org secretary: an org_roles "Secrétaire" system role (seeded below),
--    assigned via the EXISTING collaborator invite flow. Scoped by org RLS
--    using the RBAC permission catalogue that already existed but was never
--    wired into appointments RLS — only org_admin_read used it.
-- Both land on users.role = 'secretary' so client apps can route to a single
-- appointments-only dashboard regardless of which path was used.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. users.role — add 'secretary'
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('patient','practitioner','admin','organization_admin','organization_member','secretary'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. practitioner_invitations — allow a practitioner-issued invite (no org)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.practitioner_invitations ALTER COLUMN organization_id DROP NOT NULL;

ALTER TABLE public.practitioner_invitations
  ADD COLUMN IF NOT EXISTS invited_by_practitioner_id UUID REFERENCES public.practitioners(id);

ALTER TABLE public.practitioner_invitations DROP CONSTRAINT IF EXISTS practitioner_invitations_account_type_check;
ALTER TABLE public.practitioner_invitations ADD CONSTRAINT practitioner_invitations_account_type_check
  CHECK (account_type IN ('practitioner','collaborator','secretary'));

ALTER TABLE public.practitioner_invitations DROP CONSTRAINT IF EXISTS practitioner_invitations_target_check;
ALTER TABLE public.practitioner_invitations ADD CONSTRAINT practitioner_invitations_target_check
  CHECK (
    (organization_id IS NOT NULL AND invited_by_practitioner_id IS NULL)
    OR (organization_id IS NULL AND invited_by_practitioner_id IS NOT NULL)
  );

DROP POLICY IF EXISTS "practitioner_invitations_select" ON public.practitioner_invitations;
CREATE POLICY "practitioner_invitations_select" ON public.practitioner_invitations
  FOR SELECT USING (
    public.is_super_admin()
    OR public.is_org_admin(organization_id)
    OR invited_by_practitioner_id IN (SELECT id FROM public.practitioners WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "practitioner_invitations_write" ON public.practitioner_invitations;
CREATE POLICY "practitioner_invitations_write" ON public.practitioner_invitations
  FOR ALL USING (
    public.is_super_admin()
    OR public.is_org_admin(organization_id)
    OR invited_by_practitioner_id IN (SELECT id FROM public.practitioners WHERE user_id = auth.uid())
  )
  WITH CHECK (
    public.is_super_admin()
    OR public.is_org_admin(organization_id)
    OR invited_by_practitioner_id IN (SELECT id FROM public.practitioners WHERE user_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. practitioner_secretaries — the personal (non-org) link table
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.practitioner_secretaries (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id UUID        NOT NULL REFERENCES public.practitioners(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status          TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (practitioner_id, user_id)
);

CREATE INDEX idx_practitioner_secretaries_practitioner ON public.practitioner_secretaries(practitioner_id);
CREATE INDEX idx_practitioner_secretaries_user ON public.practitioner_secretaries(user_id);

ALTER TABLE public.practitioner_secretaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "practitioners_manage_own_secretaries" ON public.practitioner_secretaries
  FOR ALL USING (practitioner_id IN (SELECT id FROM public.practitioners WHERE user_id = auth.uid()))
  WITH CHECK (practitioner_id IN (SELECT id FROM public.practitioners WHERE user_id = auth.uid()));

CREATE POLICY "secretaries_read_own_link" ON public.practitioner_secretaries
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "admins_full_access_practitioner_secretaries" ON public.practitioner_secretaries
  FOR ALL USING (public.is_super_admin());

CREATE OR REPLACE FUNCTION public.is_practitioner_secretary(target_practitioner_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.practitioner_secretaries
    WHERE practitioner_id = target_practitioner_id AND user_id = auth.uid() AND status = 'active'
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. appointments RLS — grant secretary + org-permission access
--    (additive/permissive only, per the established convention in this repo)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "secretary_read_appointments" ON public.appointments
  FOR SELECT USING (public.is_practitioner_secretary(practitioner_id));

CREATE POLICY "secretary_update_appointments" ON public.appointments
  FOR UPDATE USING (public.is_practitioner_secretary(practitioner_id))
  WITH CHECK (public.is_practitioner_secretary(practitioner_id));

-- Org RBAC permission catalogue existed (appointment.read/update/...) but was
-- never actually enforced anywhere except roles.manage/users.manage — toggling
-- those checkboxes on the Roles page did nothing for appointments until now.
CREATE POLICY "org_permission_read_appointments" ON public.appointments
  FOR SELECT USING (
    organization_id = public.current_user_org_id()
    AND public.user_has_permission('appointment.read')
  );

CREATE POLICY "org_permission_update_appointments" ON public.appointments
  FOR UPDATE USING (
    organization_id = public.current_user_org_id()
    AND public.user_has_permission('appointment.update')
  )
  WITH CHECK (
    organization_id = public.current_user_org_id()
    AND public.user_has_permission('appointment.update')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Seed "Secrétaire" system org role (calendar/appointments + read patients,
--    same permission set as "Praticien" — no financial/admin access)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.seed_default_org_roles()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  admin_role_id        UUID;
  practitioner_role_id UUID;
  secretary_role_id    UUID;
BEGIN
  INSERT INTO public.org_roles (organization_id, name, description, is_system)
  VALUES (NEW.id, 'Administrateur', 'Accès complet à l''organisation', TRUE)
  RETURNING id INTO admin_role_id;

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT admin_role_id, p.id
  FROM public.permissions p
  ON CONFLICT DO NOTHING;

  INSERT INTO public.org_roles (organization_id, name, description, is_system)
  VALUES (NEW.id, 'Praticien', 'Gestion de son agenda et de ses rendez-vous', TRUE)
  RETURNING id INTO practitioner_role_id;

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT practitioner_role_id, p.id
  FROM public.permissions p
  WHERE p.code IN (
    'calendar.read', 'calendar.update',
    'appointment.read', 'appointment.create', 'appointment.update', 'appointment.cancel',
    'patient.read'
  )
  ON CONFLICT DO NOTHING;

  INSERT INTO public.org_roles (organization_id, name, description, is_system)
  VALUES (NEW.id, 'Secrétaire', 'Gestion des rendez-vous et de l''agenda', TRUE)
  RETURNING id INTO secretary_role_id;

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT secretary_role_id, p.id
  FROM public.permissions p
  WHERE p.code IN (
    'calendar.read', 'calendar.update',
    'appointment.read', 'appointment.create', 'appointment.update', 'appointment.cancel',
    'patient.read'
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- Backfill: orgs created before this migration never got the trigger's 3rd role.
DO $$
DECLARE
  org_rec RECORD;
  new_role_id UUID;
BEGIN
  FOR org_rec IN
    SELECT o.id FROM public.organizations o
    WHERE NOT EXISTS (
      SELECT 1 FROM public.org_roles r WHERE r.organization_id = o.id AND r.name = 'Secrétaire'
    )
  LOOP
    INSERT INTO public.org_roles (organization_id, name, description, is_system)
    VALUES (org_rec.id, 'Secrétaire', 'Gestion des rendez-vous et de l''agenda', TRUE)
    RETURNING id INTO new_role_id;

    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT new_role_id, p.id
    FROM public.permissions p
    WHERE p.code IN (
      'calendar.read', 'calendar.update',
      'appointment.read', 'appointment.create', 'appointment.update', 'appointment.cancel',
      'patient.read'
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
