-- Section 12: "chaque collaborateur doit pouvoir recevoir un ou plusieurs
-- rôles" — the single nullable users.admin_role_id can't express that.
-- Also fixes a live privilege-escalation bug found while investigating this:
-- every accepted admin/collaborator invitation currently lands with
-- sub_role = NULL, which — per the hierarchy trigger just shipped — reads as
-- a full super admin until someone manually downgrades them. New invites
-- must carry their selected role(s) all the way through to acceptance.

CREATE TABLE public.user_admin_roles (
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_id     UUID NOT NULL REFERENCES public.admin_roles(id) ON DELETE CASCADE,
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, role_id)
);

ALTER TABLE public.user_admin_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_own_or_admin_user_admin_roles" ON public.user_admin_roles FOR SELECT USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "super_admin_write_user_admin_roles" ON public.user_admin_roles FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin' AND sub_role IS NULL)
);

-- Migrate existing single-role assignments before the column disappears.
INSERT INTO public.user_admin_roles (user_id, role_id)
SELECT id, admin_role_id FROM public.users WHERE admin_role_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Invitations carry the selected role(s) through to acceptance.
ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS role_ids UUID[];

-- ── New roles from the section 12 example list ──────────────────────────
INSERT INTO public.admin_roles (name, description, is_system) VALUES
  ('Administrateur', 'Accès complet à la console admin', TRUE),
  ('Responsable Organisation', 'Validation et gestion des organisations', TRUE),
  ('Modérateur', 'Modération, validation praticiens/organisations, litiges', TRUE),
  ('Service client', 'Support et gestion des tickets', TRUE),
  ('Facturation', 'Paiements et analytiques', TRUE),
  ('Développeur', 'Suivi technique, bugs, incidents', TRUE),
  ('Marketing', 'Gestion du contenu public du site', TRUE),
  ('Gestionnaire des litiges', 'Traitement des litiges patients/praticiens', TRUE),
  ('Validation des praticiens', 'Validation des dossiers praticiens', TRUE)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.admin_roles r CROSS JOIN public.admin_permissions p
WHERE r.name = 'Administrateur'
ON CONFLICT DO NOTHING;

INSERT INTO public.admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.admin_roles r, public.admin_permissions p
WHERE r.name = 'Responsable Organisation' AND p.key = 'organizations.validate'
ON CONFLICT DO NOTHING;

INSERT INTO public.admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.admin_roles r, public.admin_permissions p
WHERE r.name = 'Modérateur' AND p.key IN ('users.manage', 'practitioners.validate', 'organizations.validate', 'disputes.manage', 'appeals.manage', 'analytics.view')
ON CONFLICT DO NOTHING;

INSERT INTO public.admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.admin_roles r, public.admin_permissions p
WHERE r.name = 'Service client' AND p.key IN ('tickets.manage', 'disputes.manage')
ON CONFLICT DO NOTHING;

INSERT INTO public.admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.admin_roles r, public.admin_permissions p
WHERE r.name = 'Facturation' AND p.key IN ('payments.view', 'analytics.view')
ON CONFLICT DO NOTHING;

INSERT INTO public.admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.admin_roles r, public.admin_permissions p
WHERE r.name = 'Développeur' AND p.key IN ('technical.manage', 'tickets.manage', 'audit.view')
ON CONFLICT DO NOTHING;

INSERT INTO public.admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.admin_roles r, public.admin_permissions p
WHERE r.name = 'Marketing' AND p.key = 'content.manage'
ON CONFLICT DO NOTHING;

INSERT INTO public.admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.admin_roles r, public.admin_permissions p
WHERE r.name = 'Gestionnaire des litiges' AND p.key = 'disputes.manage'
ON CONFLICT DO NOTHING;

INSERT INTO public.admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.admin_roles r, public.admin_permissions p
WHERE r.name = 'Validation des praticiens' AND p.key = 'practitioners.validate'
ON CONFLICT DO NOTHING;

-- ── admin_role_id is now fully superseded by user_admin_roles ───────────
ALTER TABLE public.users DROP COLUMN IF EXISTS admin_role_id;

-- The hierarchy trigger referenced admin_role_id directly — point it at the
-- new multi-role table instead (same protection, same "super admin = no
-- roles at all" definition, just via EXISTS instead of a single column).
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
