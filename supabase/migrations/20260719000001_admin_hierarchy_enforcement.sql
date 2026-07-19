-- CRITICAL SECURITY FIX (section 13): a suspended/lesser admin was able to
-- suspend the super admin account (Niang). Root cause: admin/collaborators
-- writes directly to public.users (status, sub_role, or a full DELETE) with
-- no hierarchy check at all — admins_full_access_users RLS grants blanket
-- write access to ANY admin over ANY other user row, including fellow
-- admins and the true super admin. set-account-status (the other suspend
-- path) already blocks any admin target outright, but that protection is
-- entirely bypassed by this direct-write path.
--
-- Fix: enforce hierarchy at the database layer via a trigger (not just a UI
-- guard, which a direct API call would trivially bypass). Only a true super
-- admin (sub_role IS NULL AND admin_role_id IS NULL) may UPDATE or DELETE
-- another admin account. Self-edits are always allowed. Service-role writes
-- (no auth.uid(), e.g. edge functions) bypass this check — they enforce
-- their own guards already.
CREATE OR REPLACE FUNCTION public.enforce_admin_hierarchy()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  caller_id UUID := auth.uid();
  caller_is_super BOOLEAN;
BEGIN
  IF caller_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF caller_id = OLD.id THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF OLD.role = 'admin' THEN
    -- sub_role/admin_role_id are NULL by default for every non-admin account
    -- too (patient, practitioner, organization_admin...) — the role check
    -- here is what actually scopes "super admin" to admins, not just anyone
    -- who happens to have never had those columns set.
    SELECT (role = 'admin' AND sub_role IS NULL AND admin_role_id IS NULL) INTO caller_is_super
    FROM public.users WHERE id = caller_id;

    IF NOT COALESCE(caller_is_super, FALSE) THEN
      RAISE EXCEPTION 'Seul un administrateur général peut modifier ou supprimer un compte administrateur';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_admin_hierarchy ON public.users;
CREATE TRIGGER trg_enforce_admin_hierarchy
  BEFORE UPDATE OR DELETE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_admin_hierarchy();
