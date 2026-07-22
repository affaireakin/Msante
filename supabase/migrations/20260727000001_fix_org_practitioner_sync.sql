-- Section 24 : un praticien (ex. "Dr Astou Sall") rattaché à une organisation
-- (ex. "Clinique Rabi") pouvait rester invisible dans le trombinoscope de
-- cette organisation. Root cause : organization_id existe en double, sur
-- users ET sur practitioners (20260704000002_tenant_columns.sql), sans
-- aucune contrainte les gardant synchronisés. Le rattachement d'un
-- praticien via accept-practitioner-invitation écrivait les deux colonnes
-- sans vérifier les erreurs (voir migration suivante pour le fix côté
-- fonction) : un échec partiel laissait users.organization_id renseigné
-- (praticien "rattaché" du point de vue admin) mais practitioners.organization_id
-- NULL (praticien absent des listes, qui filtrent uniquement sur cette
-- colonne — organization/practitioners et admin/organizations/[id]).

-- 1) Backfill : aligne practitioners.organization_id sur users.organization_id
-- pour tout praticien dont les deux colonnes divergent aujourd'hui.
UPDATE public.practitioners p
SET organization_id = u.organization_id
FROM public.users u
WHERE p.user_id = u.id
  AND u.role = 'practitioner'
  AND u.organization_id IS NOT NULL
  AND (p.organization_id IS NULL OR p.organization_id <> u.organization_id);

-- 2) Empêche la récidive : un utilisateur ne devrait avoir qu'une seule
-- fiche practitioners. Contrainte posée seulement s'il n'existe aucun
-- doublon aujourd'hui, pour ne jamais faire échouer le déploiement — si des
-- doublons existent, ce bloc les signale au lieu de bloquer db push.
DO $$
DECLARE
  dup_count INT;
BEGIN
  SELECT COUNT(*) INTO dup_count FROM (
    SELECT user_id FROM public.practitioners GROUP BY user_id HAVING COUNT(*) > 1
  ) d;

  IF dup_count = 0 THEN
    ALTER TABLE public.practitioners ADD CONSTRAINT practitioners_user_id_key UNIQUE (user_id);
  ELSE
    RAISE NOTICE 'practitioners_user_id_key non posée : % user_id en double à résoudre manuellement', dup_count;
  END IF;
END $$;
