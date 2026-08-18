-- Section 27 (feedback client) : le parcours d'inscription praticien doit
-- afficher "Professionnels de santé" et "Praticiens bien-être" dans un
-- ordre précis (pas alphabétique), et la liste bien-être doit inclure
-- Coach / Coach de vie / Développement personnel / Autre. Ajoute un ordre
-- explicite et complète les professions bien-être manquantes.
-- Aucun praticien n'existe encore en base à ce stade (reset de test récent),
-- donc renommer/réorganiser ces libellés est sans risque.
ALTER TABLE public.profession_permissions ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 100;

UPDATE public.profession_permissions SET sort_order = 1 WHERE profession_key = 'psychiatre';
UPDATE public.profession_permissions SET sort_order = 2 WHERE profession_key = 'psychologue';
UPDATE public.profession_permissions SET sort_order = 3 WHERE profession_key = 'medecin';
UPDATE public.profession_permissions SET sort_order = 4 WHERE profession_key = 'infirmier';
UPDATE public.profession_permissions SET sort_order = 5 WHERE profession_key = 'kinesitherapeute';

UPDATE public.profession_permissions SET sort_order = 1, profession_label = 'Coach' WHERE profession_key = 'coach';
UPDATE public.profession_permissions SET sort_order = 4 WHERE profession_key = 'sophrologue';

INSERT INTO public.profession_permissions
  (profession_key, profession_label, category, sort_order, can_prescribe, can_write_observations, can_write_reports, can_view_full_dossier, can_view_analyses, can_view_imaging, can_request_analyses, description)
VALUES
  ('coach_de_vie',              'Coach de vie',              'wellness', 2,  FALSE, FALSE, TRUE, FALSE, FALSE, FALSE, FALSE, 'Comptes-rendus de séance et suivi objectifs'),
  ('developpement_personnel',   'Développement personnel',   'wellness', 3,  FALSE, FALSE, TRUE, FALSE, FALSE, FALSE, FALSE, 'Comptes-rendus de séance et suivi objectifs'),
  ('autre_bien_etre',           'Autre',                     'wellness', 99, FALSE, FALSE, TRUE, FALSE, FALSE, FALSE, FALSE, 'Comptes-rendus de séance et suivi objectifs')
ON CONFLICT (profession_key) DO NOTHING;
