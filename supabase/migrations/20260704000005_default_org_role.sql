-- Rôles système par défaut à la création d'une organisation — Phase 1, Task 1.5
-- Un trigger AFTER INSERT sur organizations crée automatiquement 2 rôles système :
--   * "Administrateur" (is_system=true) → TOUTES les permissions
--   * "Praticien"      (is_system=true) → sous-ensemble agenda/RDV/patients (lecture)

CREATE OR REPLACE FUNCTION public.seed_default_org_roles()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  admin_role_id       UUID;
  practitioner_role_id UUID;
BEGIN
  -- Rôle "Administrateur" : toutes les permissions
  INSERT INTO public.org_roles (organization_id, name, description, is_system)
  VALUES (NEW.id, 'Administrateur', 'Accès complet à l''organisation', TRUE)
  RETURNING id INTO admin_role_id;

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT admin_role_id, p.id
  FROM public.permissions p
  ON CONFLICT DO NOTHING;

  -- Rôle "Praticien" : agenda + rendez-vous + lecture patients
  INSERT INTO public.org_roles (organization_id, name, description, is_system)
  VALUES (NEW.id, 'Praticien', 'Gestion de son agenda et de ses rendez-vous', TRUE)
  RETURNING id INTO practitioner_role_id;

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT practitioner_role_id, p.id
  FROM public.permissions p
  WHERE p.code IN (
    'calendar.read',
    'calendar.update',
    'appointment.read',
    'appointment.create',
    'appointment.update',
    'appointment.cancel',
    'patient.read'
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_default_org_roles ON public.organizations;
CREATE TRIGGER trg_seed_default_org_roles
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_default_org_roles();
