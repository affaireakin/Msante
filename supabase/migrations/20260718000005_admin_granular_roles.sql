-- Rôles admin granulaires (section 9 du cahier des charges) : au-delà des 4
-- sous-rôles fixes existants (admin/moderator/accountant/readonly, gérés en
-- dur dans admin/layout.tsx), le super-admin doit pouvoir créer des rôles
-- métier sur-mesure (Responsable support, validation, contenu, technique...)
-- avec des permissions granulaires personnalisables.
--
-- Conçu en couche additive : un utilisateur avec admin_role_id NULL continue
-- de fonctionner exactement comme avant (sub_role legacy). Seuls les
-- utilisateurs explicitement rattachés à un rôle personnalisé basculent sur
-- le nouveau système de permissions.

CREATE TABLE public.admin_roles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,
  description   TEXT,
  is_system     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.admin_permissions (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key       TEXT NOT NULL UNIQUE,
  label     TEXT NOT NULL,
  category  TEXT NOT NULL
);

CREATE TABLE public.admin_role_permissions (
  role_id       UUID NOT NULL REFERENCES public.admin_roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.admin_permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS admin_role_id UUID REFERENCES public.admin_roles(id) ON DELETE SET NULL;

-- ── Permissions granulaires ──────────────────────────────────────────────
INSERT INTO public.admin_permissions (key, label, category) VALUES
  ('tickets.manage',           'Gérer les tickets',                    'Support'),
  ('disputes.manage',          'Gérer les litiges et réclamations',    'Support'),
  ('appeals.manage',           'Traiter les appels/contestations',     'Support'),
  ('practitioners.validate',   'Valider les praticiens',               'Validation'),
  ('organizations.validate',   'Valider les organisations',            'Validation'),
  ('collaborators.validate',   'Valider les collaborateurs',           'Validation'),
  ('content.manage',           'Gérer CGU / FAQ / pages publiques',    'Contenu'),
  ('technical.manage',         'Gérer bugs / incidents / déploiements', 'Technique'),
  ('users.manage',             'Gérer les utilisateurs',               'Général'),
  ('payments.view',            'Consulter les paiements',              'Général'),
  ('analytics.view',           'Consulter les analytiques',            'Général'),
  ('audit.view',               'Consulter le journal d''audit',        'Général')
ON CONFLICT (key) DO NOTHING;

-- ── Rôles système par défaut (les 4 exemples du cahier des charges) ─────
INSERT INTO public.admin_roles (name, description, is_system) VALUES
  ('Responsable support',    'Gestion des tickets et des réclamations',                 TRUE),
  ('Responsable validation', 'Validation des praticiens et des organisations',          TRUE),
  ('Responsable contenu',    'Gestion des CGU, FAQ et pages publiques',                 TRUE),
  ('Responsable technique',  'Suivi des bugs, incidents et déploiements',               TRUE)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.admin_roles r, public.admin_permissions p
WHERE r.name = 'Responsable support' AND p.key IN ('tickets.manage', 'disputes.manage', 'appeals.manage')
ON CONFLICT DO NOTHING;

INSERT INTO public.admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.admin_roles r, public.admin_permissions p
WHERE r.name = 'Responsable validation' AND p.key IN ('practitioners.validate', 'organizations.validate', 'collaborators.validate')
ON CONFLICT DO NOTHING;

INSERT INTO public.admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.admin_roles r, public.admin_permissions p
WHERE r.name = 'Responsable contenu' AND p.key IN ('content.manage')
ON CONFLICT DO NOTHING;

INSERT INTO public.admin_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.admin_roles r, public.admin_permissions p
WHERE r.name = 'Responsable technique' AND p.key IN ('technical.manage', 'tickets.manage', 'audit.view')
ON CONFLICT DO NOTHING;

-- ── RLS : lecture pour tout admin, écriture réservée au super-admin ─────
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_read_admin_roles" ON public.admin_roles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "super_admin_write_admin_roles" ON public.admin_roles FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin' AND sub_role IS NULL)
);

ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_read_admin_permissions" ON public.admin_permissions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

ALTER TABLE public.admin_role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_read_admin_role_permissions" ON public.admin_role_permissions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "super_admin_write_admin_role_permissions" ON public.admin_role_permissions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin' AND sub_role IS NULL)
);
