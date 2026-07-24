-- QA finding : "Mon équipe" (apps/web/app/patient/mon-equipe/page.tsx) était
-- cassée pour tout le monde — elle appelle deux RPC Postgres qui n'ont
-- jamais existé (get_patient_team, list_practitioners) et essaie d'écrire
-- une colonne `role` sur patient_data_permissions qui n'existe pas non plus.

-- 1) Colonne manquante — le rôle du praticien dans l'équipe du patient
-- (médecin traitant, psychiatre, etc.), distinct de access_level (le niveau
-- d'accès aux données).
ALTER TABLE public.patient_data_permissions
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'autre'
  CHECK (role IN (
    'medecin_traitant', 'psychiatre', 'psychologue', 'therapeute',
    'sophrologue', 'kinesitherapeute', 'infirmier', 'specialiste', 'autre'
  ));

-- 2) get_patient_team : l'équipe de soins du patient, avec le nom/spécialité
-- du praticien déjà jointés (évite un aller-retour supplémentaire côté
-- client). Pas SECURITY DEFINER : la policy "patients_own_permissions"
-- (auth.uid() = patient_id) déjà en place sur patient_data_permissions
-- s'applique normalement, donc un patient ne peut jamais lire l'équipe d'un
-- autre patient même en appelant la fonction avec un patient_uuid différent.
CREATE OR REPLACE FUNCTION public.get_patient_team(patient_uuid UUID)
RETURNS TABLE (
  permission_id UUID,
  practitioner_id UUID,
  role TEXT,
  access_level TEXT,
  expires_at TIMESTAMPTZ,
  allow_notes BOOLEAN,
  allow_appreciations BOOLEAN,
  allow_mood_journal BOOLEAN,
  speciality TEXT,
  full_name TEXT
) LANGUAGE sql STABLE AS $$
  SELECT
    pdp.id, pdp.practitioner_id, pdp.role, pdp.access_level, pdp.expires_at,
    pdp.allow_notes, pdp.allow_appreciations, pdp.allow_mood_journal,
    p.speciality, u.full_name
  FROM public.patient_data_permissions pdp
  JOIN public.practitioners p ON p.id = pdp.practitioner_id
  JOIN public.users u ON u.id = p.user_id
  WHERE pdp.patient_id = patient_uuid;
$$;

-- 3) list_practitioners : mêmes critères que /patient/practitioners
-- (praticien approuvé, et si rattaché à une organisation, validé par elle)
-- pour que "Mon équipe" ne propose que des praticiens réellement actifs.
-- session_currency est exposée sous l'alias `currency` attendu côté client.
CREATE OR REPLACE FUNCTION public.list_practitioners()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  speciality TEXT,
  rating NUMERIC,
  session_price NUMERIC,
  currency TEXT,
  is_verified BOOLEAN,
  full_name TEXT
) LANGUAGE sql STABLE AS $$
  SELECT
    p.id, p.user_id, p.speciality, p.rating, p.session_price,
    p.session_currency, p.is_verified, u.full_name
  FROM public.practitioners p
  JOIN public.users u ON u.id = p.user_id
  WHERE p.verification_status = 'approved'
    AND (p.organization_id IS NULL OR p.org_validated_at IS NOT NULL);
$$;
