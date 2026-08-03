-- Le DSM est retiré du module d'aide au diagnostic (remplacé par une vraie
-- intégration BDPM pour les médicaments — voir bdpm_medications). Seule la
-- CIM (OMS ICD-11) reste comme outil d'aide au diagnostic.
DROP TABLE IF EXISTS public.dsm_entries;

ALTER TABLE public.profession_permissions
  DROP COLUMN IF EXISTS can_use_dsm,
  DROP COLUMN IF EXISTS can_view_diagnostic_criteria;

-- practitioner_has_diagnostic_permission ne gère plus que les permissions
-- restantes (can_use_cim, can_advanced_search_diagnostic,
-- can_associate_diagnosis, can_export_diagnostic).
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
    WHEN 'can_use_cim' THEN pp.can_use_cim
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

CREATE OR REPLACE FUNCTION public.get_my_diagnostic_permissions()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'can_use_cim', public.practitioner_has_diagnostic_permission(auth.uid(), 'can_use_cim'),
    'can_advanced_search_diagnostic', public.practitioner_has_diagnostic_permission(auth.uid(), 'can_advanced_search_diagnostic'),
    'can_associate_diagnosis', public.practitioner_has_diagnostic_permission(auth.uid(), 'can_associate_diagnosis'),
    'can_export_diagnostic', public.practitioner_has_diagnostic_permission(auth.uid(), 'can_export_diagnostic')
  );
$$;

-- diagnosis_records.source n'accepte plus que 'cim'.
ALTER TABLE public.diagnosis_records DROP CONSTRAINT IF EXISTS diagnosis_records_source_check;
ALTER TABLE public.diagnosis_records ADD CONSTRAINT diagnosis_records_source_check CHECK (source = 'cim');
