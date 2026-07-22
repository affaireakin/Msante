-- Section 25 : les triggers d'audit existants (20260706000002, 20260706000003)
-- renseignent désormais module/target_user_id/target_role en plus des
-- colonnes déjà présentes. CREATE OR REPLACE — les triggers pointent déjà
-- vers ces fonctions, pas besoin de les recréer.

CREATE OR REPLACE FUNCTION public.audit_role_permission_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role_id UUID := COALESCE(NEW.role_id, OLD.role_id);
  v_permission_id UUID := COALESCE(NEW.permission_id, OLD.permission_id);
  v_role_name TEXT;
BEGIN
  SELECT name INTO v_role_name FROM public.org_roles WHERE id = v_role_id;

  INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, old_values, new_values, module, target_role)
  VALUES (
    auth.uid(),
    CASE WHEN TG_OP = 'INSERT' THEN 'role_permission.grant' ELSE 'role_permission.revoke' END,
    'org_role',
    v_role_id::text,
    CASE WHEN TG_OP = 'DELETE' THEN jsonb_build_object('permission_id', v_permission_id) ELSE NULL END,
    CASE WHEN TG_OP = 'INSERT' THEN jsonb_build_object('permission_id', v_permission_id) ELSE NULL END,
    'organization',
    v_role_name
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_user_role_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id UUID := COALESCE(NEW.user_id, OLD.user_id);
  v_role_id UUID := COALESCE(NEW.role_id, OLD.role_id);
  v_role_name TEXT;
BEGIN
  SELECT name INTO v_role_name FROM public.org_roles WHERE id = v_role_id;

  INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, old_values, new_values, module, target_user_id, target_role)
  VALUES (
    auth.uid(),
    CASE WHEN TG_OP = 'INSERT' THEN 'user_role.assign' ELSE 'user_role.unassign' END,
    'user',
    v_user_id::text,
    CASE WHEN TG_OP = 'DELETE' THEN jsonb_build_object('role_id', v_role_id) ELSE NULL END,
    CASE WHEN TG_OP = 'INSERT' THEN jsonb_build_object('role_id', v_role_id) ELSE NULL END,
    'organization',
    v_user_id,
    v_role_name
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_organization_creation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, new_values, module, target_user_id)
  VALUES (
    COALESCE(NEW.created_by, auth.uid()),
    'organization.create',
    'organization',
    NEW.id::text,
    jsonb_build_object('name', NEW.name, 'status', NEW.status),
    'organization',
    NEW.created_by
  );
  RETURN NEW;
END;
$$;
