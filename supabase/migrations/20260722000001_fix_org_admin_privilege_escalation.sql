-- QA finding (audit organisation, section "sécurité/permissions") : un
-- organization_admin pouvait s'auto-promouvoir en administrateur plateforme.
-- Deux failles combinées :
-- 1. org_admin_update_org_members ne contraignait pas la colonne role: un
--    appel direct `update({role:'admin'})` sur sa propre ligne passait la
--    policy RLS (seule condition: is_org_admin + permission users.manage).
-- 2. enforce_admin_hierarchy() s'auto-désactive entièrement quand
--    caller_id = OLD.id (bypass auto-édition) et ne vérifiait que
--    OLD.role = 'admin' -- jamais NEW.role -- donc aucune protection contre
--    une PROMOTION vers un rôle à privilèges, y compris en auto-édition.
--
-- Fix : (a) borner org_admin_update_org_members à role IN
-- ('organization_member','secretary'), les deux seules valeurs que cette
-- fonctionnalité (bascule collaborateur <-> secrétaire) a besoin d'écrire ;
-- (b) faire échouer explicitement, même en auto-édition, toute tentative de
-- passer NEW.role à 'admin' ou 'organization_admin' venant d'un rôle
-- différent, sauf pour un vrai super admin (sub_role IS NULL AND
-- admin_role_id IS NULL) ou une écriture service-role (auth.uid() IS NULL,
-- déjà de confiance -- ex. accept-admin-invitation).

DROP POLICY IF EXISTS "org_admin_update_org_members" ON public.users;
CREATE POLICY "org_admin_update_org_members" ON public.users
  FOR UPDATE USING (
    public.is_org_admin(organization_id) AND public.user_has_permission('users.manage')
  )
  WITH CHECK (
    public.is_org_admin(organization_id) AND public.user_has_permission('users.manage')
    AND role IN ('organization_member', 'secretary')
  );

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
    SELECT (role = 'admin' AND sub_role IS NULL AND admin_role_id IS NULL) INTO caller_is_super
    FROM public.users WHERE id = caller_id;

    IF NOT COALESCE(caller_is_super, FALSE) THEN
      RAISE EXCEPTION 'Seul un administrateur général peut attribuer le rôle %', NEW.role;
    END IF;
  END IF;

  IF caller_id = OLD.id THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF OLD.role = 'admin' THEN
    SELECT (role = 'admin' AND sub_role IS NULL AND admin_role_id IS NULL) INTO caller_is_super
    FROM public.users WHERE id = caller_id;

    IF NOT COALESCE(caller_is_super, FALSE) THEN
      RAISE EXCEPTION 'Seul un administrateur général peut modifier ou supprimer un compte administrateur';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;
