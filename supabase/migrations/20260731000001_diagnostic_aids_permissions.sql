-- Section 27 : intégration DSM/CIM comme outils d'aide au diagnostic —
-- l'accès doit être piloté par le système Rôles & Permissions existant,
-- refusé par défaut, et n'accordé qu'aux professions explicitement
-- autorisées (psychiatres, psychologues, médecins, spécialistes...).

-- 1. Colonnes de référence par profession (éditées par le Super Admin dans
--    l'écran Rôles & Permissions déjà existant) — documentent l'intention
--    par défaut pour chaque profession, mais ne sont PAS lues directement
--    par la RLS (voir practitioner_has_diagnostic_permission ci-dessous,
--    qui suit exactement le même schéma à deux niveaux déjà utilisé par
--    can_prescribe : override par praticien dans practitioners.permissions,
--    sinon repli sur le défaut de la profession).
ALTER TABLE public.profession_permissions
  ADD COLUMN IF NOT EXISTS can_use_dsm BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_use_cim BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_view_diagnostic_criteria BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_advanced_search_diagnostic BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_associate_diagnosis BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_export_diagnostic BOOLEAN NOT NULL DEFAULT FALSE;

-- Activer par défaut pour les professions cliniques concernées par le
-- diagnostic psychiatrique/médical — le reste (bien-être, sophrologue,
-- coach...) reste à FALSE et devra être autorisé explicitement.
UPDATE public.profession_permissions SET
  can_use_dsm = TRUE, can_use_cim = TRUE, can_view_diagnostic_criteria = TRUE,
  can_advanced_search_diagnostic = TRUE, can_associate_diagnosis = TRUE, can_export_diagnostic = TRUE
WHERE profession_key IN ('psychiatre', 'psychologue', 'medecin')
   OR category = 'healthcare';

-- 2. Fonction d'application — même logique à deux niveaux que can_prescribe :
--    1) override explicite sur le praticien (practitioners.permissions JSONB)
--    2) sinon, défaut de sa profession (jointure sur speciality = profession_label)
--    3) sinon, refusé (contrairement à can_prescribe qui est permissif par
--       défaut, l'accès DSM/CIM doit être refusé par défaut — voir le cahier
--       des charges : "ne doit pas être disponible pour tous les utilisateurs").
CREATE OR REPLACE FUNCTION public.practitioner_has_diagnostic_permission(p_user_id UUID, p_perm TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_override BOOLEAN;
  v_default BOOLEAN;
BEGIN
  SELECT (permissions->>p_perm)::boolean INTO v_override
  FROM practitioners WHERE user_id = p_user_id;

  IF v_override IS NOT NULL THEN
    RETURN v_override;
  END IF;

  SELECT CASE p_perm
    WHEN 'can_use_dsm' THEN pp.can_use_dsm
    WHEN 'can_use_cim' THEN pp.can_use_cim
    WHEN 'can_view_diagnostic_criteria' THEN pp.can_view_diagnostic_criteria
    WHEN 'can_advanced_search_diagnostic' THEN pp.can_advanced_search_diagnostic
    WHEN 'can_associate_diagnosis' THEN pp.can_associate_diagnosis
    WHEN 'can_export_diagnostic' THEN pp.can_export_diagnostic
    ELSE FALSE
  END INTO v_default
  FROM practitioners p
  JOIN profession_permissions pp ON pp.profession_label = p.speciality
  WHERE p.user_id = p_user_id;

  RETURN COALESCE(v_default, FALSE);
END;
$$;

-- Commodité côté client : un seul aller-retour au lieu de 6 pour afficher/
-- masquer les boutons de recherche DSM/CIM. Utilise auth.uid() (appelant),
-- contrairement à practitioner_has_diagnostic_permission qui est paramétrée
-- pour un usage serveur (edge functions) sur un utilisateur arbitraire.
CREATE OR REPLACE FUNCTION public.get_my_diagnostic_permissions()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'can_use_dsm', public.practitioner_has_diagnostic_permission(auth.uid(), 'can_use_dsm'),
    'can_use_cim', public.practitioner_has_diagnostic_permission(auth.uid(), 'can_use_cim'),
    'can_view_diagnostic_criteria', public.practitioner_has_diagnostic_permission(auth.uid(), 'can_view_diagnostic_criteria'),
    'can_advanced_search_diagnostic', public.practitioner_has_diagnostic_permission(auth.uid(), 'can_advanced_search_diagnostic'),
    'can_associate_diagnosis', public.practitioner_has_diagnostic_permission(auth.uid(), 'can_associate_diagnosis'),
    'can_export_diagnostic', public.practitioner_has_diagnostic_permission(auth.uid(), 'can_export_diagnostic')
  );
$$;
