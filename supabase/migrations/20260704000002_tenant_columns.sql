-- Tenant columns — Phase 1, Task 1.3
-- Ajoute organization_id (NULLABLE) aux entités métier.
-- NULL = praticien indépendant / hors organisation (rétro-compatibilité stricte).
-- NOTE: doit s'exécuter AVANT tenant_helpers.sql, car current_user_org_id()
-- lit users.organization_id (renommé 20260704000002, avant les helpers 000003).

ALTER TABLE public.users              ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.practitioners      ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.appointments       ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.payments           ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.consultation_types ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
-- messages/documents : dérivés du praticien, org_id ajouté pour requêtes directes
ALTER TABLE public.messages           ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

CREATE INDEX IF NOT EXISTS idx_practitioners_org ON public.practitioners(organization_id);
CREATE INDEX IF NOT EXISTS idx_appointments_org  ON public.appointments(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_org         ON public.users(organization_id);
