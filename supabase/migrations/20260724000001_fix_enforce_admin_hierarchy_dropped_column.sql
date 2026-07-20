-- CRITICAL FIX: 20260722000001 rewrote enforce_admin_hierarchy() referencing
-- users.admin_role_id — a column already dropped by 20260719000002 in favor
-- of the user_admin_roles table. Every UPDATE/DELETE on public.users where
-- the caller isn't the row owner and the target's role='admin' hit this
-- dead column and raised a hard Postgres error ("column admin_role_id does
-- not exist"), silently breaking the "Modifier rôle"/"Suspendre"/delete
-- actions for every admin acting on another admin's account. Restores the
-- user_admin_roles-based check from 20260719000002 in both branches.

CREATE OR REPLACE FUNCTION public.enforce_admin_hierarchy()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  caller_id UUID := auth.uid();
  caller_is_super BOOLEAN;
BEGIN
  IF caller_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Blocage promotion vers un rôle à privilèges, y compris en auto-édition --
  -- c'est précisément le chemin que l'exception d'auto-édition ci-dessous ne
  -- doit jamais couvrir.
  IF TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role
     AND NEW.role IN ('admin', 'organization_admin') THEN
    SELECT (
      u.role = 'admin' AND u.sub_role IS NULL
      AND NOT EXISTS (SELECT 1 FROM public.user_admin_roles WHERE user_id = u.id)
    ) INTO caller_is_super
    FROM public.users u WHERE u.id = caller_id;

    IF NOT COALESCE(caller_is_super, FALSE) THEN
      RAISE EXCEPTION 'Seul un administrateur général peut attribuer le rôle %', NEW.role;
    END IF;
  END IF;

  IF caller_id = OLD.id THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF OLD.role = 'admin' THEN
    SELECT (
      u.role = 'admin' AND u.sub_role IS NULL
      AND NOT EXISTS (SELECT 1 FROM public.user_admin_roles WHERE user_id = u.id)
    ) INTO caller_is_super
    FROM public.users u WHERE u.id = caller_id;

    IF NOT COALESCE(caller_is_super, FALSE) THEN
      RAISE EXCEPTION 'Seul un administrateur général peut modifier ou supprimer un compte administrateur';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;
