-- Tenant RLS isolation — Phase 2
-- Design notes (IMPORTANT):
--  * Postgres PERMISSIVE policies combine with OR. We therefore only ADD
--    policies scoped to the NEW org roles (org_admin / super_admin). We never
--    add a broad "organization_id IS NULL OR = current_user_org_id()" policy to
--    the business tables, which would leak every independent practitioner's rows
--    to any authenticated user. Existing patient/practitioner policies are left
--    untouched and keep enforcing their own scope.
--  * We never use RESTRICTIVE policies here: a restrictive rule would AND with
--    existing ones and could block a patient from seeing their own appointment
--    with an org-affiliated practitioner.
--  * All org/role lookups go through the SECURITY DEFINER helpers from
--    20260704000002 / 20260704000004 to avoid RLS recursion.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. organizations
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Read: super admin (all), members of the org, and the creator (to follow their
-- pending request).
CREATE POLICY "org_select" ON public.organizations
  FOR SELECT USING (
    public.is_super_admin()
    OR id = public.current_user_org_id()
    OR created_by = auth.uid()
  );

-- Create: any authenticated user may submit an onboarding request, forced to
-- status 'pending' and created_by = self. Super admin may create in any status.
CREATE POLICY "org_insert" ON public.organizations
  FOR INSERT WITH CHECK (
    public.is_super_admin()
    OR (created_by = auth.uid() AND status = 'pending')
  );

-- Update: super admin (validation / suspension / anything). Org admins may edit
-- their own org's profile fields; the status column is protected by the trigger
-- below so they cannot self-activate or lift a suspension.
CREATE POLICY "org_update_super" ON public.organizations
  FOR UPDATE USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY "org_update_admin" ON public.organizations
  FOR UPDATE USING (public.is_org_admin(id)) WITH CHECK (public.is_org_admin(id));

-- Guard: only a super admin may change `status`. Prevents an org admin from
-- flipping their own organization to 'active' or out of 'suspended'.
-- NOTE: triggers run even for service-role connections (Edge Functions use the
-- SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS but NOT triggers, and has no
-- auth.uid() so is_super_admin() would be false). The validate-organization /
-- suspend-organization Edge Functions already re-check caller.role === 'admin'
-- in application code before writing, so we trust auth.role() = 'service_role'
-- here — the same trust boundary the rest of this codebase's Edge Functions use.
CREATE OR REPLACE FUNCTION public.prevent_org_status_tamper()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND auth.role() <> 'service_role'
     AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only a super admin can change the organization status';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_org_status_tamper ON public.organizations;
CREATE TRIGGER trg_prevent_org_status_tamper
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.prevent_org_status_tamper();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. organization_documents
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.organization_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_docs_select" ON public.organization_documents
  FOR SELECT USING (
    public.is_super_admin()
    OR public.is_org_admin(organization_id)
    OR EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_id AND o.created_by = auth.uid()
    )
  );

CREATE POLICY "org_docs_insert" ON public.organization_documents
  FOR INSERT WITH CHECK (
    public.is_super_admin()
    OR public.is_org_admin(organization_id)
    OR EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_id AND o.created_by = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. permissions (global static catalog — readable by all authenticated)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "permissions_read_all" ON public.permissions
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "permissions_super_admin_write" ON public.permissions
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. org_roles
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.org_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_roles_select" ON public.org_roles
  FOR SELECT USING (
    public.is_super_admin()
    OR organization_id = public.current_user_org_id()
  );

-- Manage roles: super admin, or an org admin of that org holding roles.manage.
CREATE POLICY "org_roles_write" ON public.org_roles
  FOR ALL USING (
    public.is_super_admin()
    OR (public.is_org_admin(organization_id) AND public.user_has_permission('roles.manage'))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (public.is_org_admin(organization_id) AND public.user_has_permission('roles.manage'))
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. role_permissions (scoped through the parent org_role)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "role_permissions_select" ON public.role_permissions
  FOR SELECT USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.org_roles r
      WHERE r.id = role_id AND r.organization_id = public.current_user_org_id()
    )
  );

CREATE POLICY "role_permissions_write" ON public.role_permissions
  FOR ALL USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.org_roles r
      WHERE r.id = role_id
        AND public.is_org_admin(r.organization_id)
        AND public.user_has_permission('roles.manage')
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.org_roles r
      WHERE r.id = role_id
        AND public.is_org_admin(r.organization_id)
        AND public.user_has_permission('roles.manage')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. user_roles
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- A member can read their own role assignments; org admins/super admin read the
-- org's assignments.
CREATE POLICY "user_roles_select" ON public.user_roles
  FOR SELECT USING (
    public.is_super_admin()
    OR user_id = auth.uid()
    OR organization_id = public.current_user_org_id()
  );

CREATE POLICY "user_roles_write" ON public.user_roles
  FOR ALL USING (
    public.is_super_admin()
    OR (public.is_org_admin(organization_id) AND public.user_has_permission('users.manage'))
  )
  WITH CHECK (
    public.is_super_admin()
    OR (public.is_org_admin(organization_id) AND public.user_has_permission('users.manage'))
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Business tables — ADD org-admin read visibility (ADDITIVE, scoped by role).
--    Existing patient/practitioner/admin policies are untouched. These grant an
--    org admin read access to rows belonging to THEIR org only. Independent rows
--    (organization_id IS NULL) are NOT matched here, so nothing leaks.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE POLICY "org_admin_read" ON public.practitioners
  FOR SELECT USING (public.is_org_admin(organization_id));

CREATE POLICY "org_admin_read" ON public.appointments
  FOR SELECT USING (public.is_org_admin(organization_id));

CREATE POLICY "org_admin_read" ON public.payments
  FOR SELECT USING (public.is_org_admin(organization_id));

CREATE POLICY "org_admin_read" ON public.consultation_types
  FOR SELECT USING (public.is_org_admin(organization_id));

CREATE POLICY "org_admin_read" ON public.messages
  FOR SELECT USING (public.is_org_admin(organization_id));
