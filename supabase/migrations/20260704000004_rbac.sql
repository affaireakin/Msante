-- RBAC (Roles / Permissions / RolePermissions / UserRoles) — Phase 1, Task 1.4

CREATE TABLE public.org_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, name)
);

CREATE TABLE public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,   -- ex: practitioner.invite
  label TEXT NOT NULL,
  category TEXT NOT NULL
);

CREATE TABLE public.role_permissions (
  role_id UUID NOT NULL REFERENCES public.org_roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE public.user_roles (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.org_roles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id, organization_id)
);

-- Seed du catalogue de permissions (spec §Permissions possibles)
INSERT INTO public.permissions (code, label, category) VALUES
  ('practitioner.create','Créer un praticien','Praticiens'),
  ('practitioner.update','Modifier un praticien','Praticiens'),
  ('practitioner.delete','Supprimer un praticien','Praticiens'),
  ('practitioner.invite','Inviter un praticien','Praticiens'),
  ('practitioner.suspend','Suspendre un praticien','Praticiens'),
  ('calendar.read','Voir l''agenda','Agenda'),
  ('calendar.update','Modifier l''agenda','Agenda'),
  ('appointment.read','Voir les RDV','Rendez-vous'),
  ('appointment.create','Créer un RDV','Rendez-vous'),
  ('appointment.update','Modifier un RDV','Rendez-vous'),
  ('appointment.cancel','Annuler un RDV','Rendez-vous'),
  ('patient.read','Voir les patients','Patients'),
  ('patient.update','Modifier un patient','Patients'),
  ('invoice.read','Voir les factures','Facturation'),
  ('invoice.export','Exporter les factures','Facturation'),
  ('accounting.read','Voir la comptabilité','Comptabilité'),
  ('dashboard.read','Voir les statistiques','Statistiques'),
  ('settings.update','Modifier les paramètres','Paramètres'),
  ('users.manage','Gérer les utilisateurs','Utilisateurs'),
  ('roles.manage','Gérer les rôles','Rôles')
ON CONFLICT (code) DO NOTHING;

-- Helper permission (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.user_has_permission(perm_code TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin() OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = auth.uid() AND p.code = perm_code
  );
$$;
