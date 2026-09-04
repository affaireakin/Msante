-- Bug remonté : un admin a pu valider un praticien côté web sans qu'aucun
-- document de vérification n'ait jamais été soumis (l'upload avait échoué
-- côté mobile en amont — cf. apps/mobile/app/(practitioner)/documents.tsx,
-- corrigé dans le même lot, qui ciblait le mauvais bucket storage). Rien ne
-- l'en empêchait : /admin/practitioners faisait un simple .update() client,
-- sans vérification serveur. Le fix UI (bouton désactivé si aucun document)
-- est contourné par n'importe quel appel direct à l'API — il faut donc aussi
-- un garde-fou en base, cohérent avec la doctrine du projet ("RBAC vérifié
-- côté serveur, jamais côté client seul").
--
-- Même gap identifié et corrigé côté organisations (organization_documents),
-- où l'edge function validate-organization n'avait pas non plus ce contrôle.

CREATE OR REPLACE FUNCTION public.enforce_practitioner_approval_requires_documents()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.verification_status = 'approved' AND OLD.verification_status IS DISTINCT FROM 'approved' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.verification_documents WHERE practitioner_id = NEW.id
    ) THEN
      RAISE EXCEPTION 'Impossible d''approuver : aucun document de vérification soumis pour ce praticien.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_practitioner_approval_requires_documents ON public.practitioners;
CREATE TRIGGER trg_practitioner_approval_requires_documents
  BEFORE UPDATE ON public.practitioners
  FOR EACH ROW EXECUTE FUNCTION public.enforce_practitioner_approval_requires_documents();

CREATE OR REPLACE FUNCTION public.enforce_organization_approval_requires_documents()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'active' AND OLD.status IS DISTINCT FROM 'active' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.organization_documents WHERE organization_id = NEW.id
    ) THEN
      RAISE EXCEPTION 'Impossible de valider : aucun document justificatif soumis pour cette organisation.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_organization_approval_requires_documents ON public.organizations;
CREATE TRIGGER trg_organization_approval_requires_documents
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_organization_approval_requires_documents();
