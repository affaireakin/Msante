-- Un créateur d'organisation était enregistré avec role = 'patient' jusqu'à
-- la validation de sa demande — un placeholder, faute de rôle représentant
-- l'état "demande en attente". Trois conséquences bien réelles :
--
--   1. La donnée est fausse : la console d'admin affiche un patient là où il
--      y a un demandeur d'organisation.
--   2. Le compte a réellement les droits patient (les politiques RLS patient
--      s'appliquent : réservation de consultations, journal d'humeur, etc.).
--   3. Les indicateurs sont faussés : "Patients inscrits" et "Taux
--      d'onboarding", web comme mobile, comptent role = 'patient'.
--
-- Et une demande refusée laissait le compte patient indéfiniment.
--
-- Ce rôle dédié corrige les trois. Il n'accorde aucun droit : les politiques
-- du parcours organisation reposent toutes sur created_by = auth.uid()
-- (cf. 20260704000006_org_rls.sql), jamais sur le rôle — le parcours
-- d'inscription reste donc intact, sans les permissions patient en trop.

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN (
    'patient',
    'practitioner',
    'admin',
    'organization_admin',
    'organization_member',
    'organization_pending',
    'secretary'
  ));

-- Régularisation des comptes existants : uniquement ceux qui ont une demande
-- réellement en attente. Les demandes refusées ou archivées ne sont pas
-- touchées — leur compte reste tel quel, à traiter au cas par cas.
UPDATE public.users u
SET role = 'organization_pending'
WHERE u.role = 'patient'
  AND EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.created_by = u.id AND o.status = 'pending'
  );
