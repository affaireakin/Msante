-- Audit the "création" event for organizations — Phase 8, Task 8.2
-- Status changes (approve/reject/suspend/...) are already logged explicitly
-- by the validate-organization / suspend-organization Edge Functions with
-- richer context (reason, old/new status) — this trigger only covers the
-- initial INSERT, which today happens client-side from the onboarding form
-- and had no audit trail at all.

CREATE OR REPLACE FUNCTION public.audit_organization_creation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, new_values)
  VALUES (
    COALESCE(NEW.created_by, auth.uid()),
    'organization.create',
    'organization',
    NEW.id::text,
    jsonb_build_object('name', NEW.name, 'status', NEW.status)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_organization_creation ON public.organizations;
CREATE TRIGGER trg_audit_organization_creation
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.audit_organization_creation();
