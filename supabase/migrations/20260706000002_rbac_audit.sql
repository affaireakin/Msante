-- Audit logging for role/permission changes — Phase 7/8
-- Triggers so that BOTH direct client writes (RLS-gated) and any future
-- Edge Function writes are journaled uniformly, per "toutes les actions
-- sensibles ... doivent être journalisées dans un audit log".

CREATE OR REPLACE FUNCTION public.audit_role_permission_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role_id UUID := COALESCE(NEW.role_id, OLD.role_id);
  v_permission_id UUID := COALESCE(NEW.permission_id, OLD.permission_id);
BEGIN
  INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, old_values, new_values)
  VALUES (
    auth.uid(),
    CASE WHEN TG_OP = 'INSERT' THEN 'role_permission.grant' ELSE 'role_permission.revoke' END,
    'org_role',
    v_role_id::text,
    CASE WHEN TG_OP = 'DELETE' THEN jsonb_build_object('permission_id', v_permission_id) ELSE NULL END,
    CASE WHEN TG_OP = 'INSERT' THEN jsonb_build_object('permission_id', v_permission_id) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_role_permission_change ON public.role_permissions;
CREATE TRIGGER trg_audit_role_permission_change
  AFTER INSERT OR DELETE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.audit_role_permission_change();

CREATE OR REPLACE FUNCTION public.audit_user_role_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id UUID := COALESCE(NEW.user_id, OLD.user_id);
  v_role_id UUID := COALESCE(NEW.role_id, OLD.role_id);
BEGIN
  INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, old_values, new_values)
  VALUES (
    auth.uid(),
    CASE WHEN TG_OP = 'INSERT' THEN 'user_role.assign' ELSE 'user_role.unassign' END,
    'user',
    v_user_id::text,
    CASE WHEN TG_OP = 'DELETE' THEN jsonb_build_object('role_id', v_role_id) ELSE NULL END,
    CASE WHEN TG_OP = 'INSERT' THEN jsonb_build_object('role_id', v_role_id) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_user_role_change ON public.user_roles;
CREATE TRIGGER trg_audit_user_role_change
  AFTER INSERT OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_user_role_change();
