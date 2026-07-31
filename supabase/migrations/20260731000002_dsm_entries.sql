-- Référentiel DSM léger : nom du diagnostic, code, catégorie, mots-clés de
-- recherche. Ne reproduit PAS les critères diagnostiques du DSM-5 (protégés
-- par le droit d'auteur de l'American Psychiatric Association, licence non
-- détenue) — seulement les noms et codes, qui relèvent du fait et non de la
-- création protégeable. L'UI doit systématiquement afficher un renvoi vers
-- le manuel officiel pour les critères complets.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE public.dsm_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL UNIQUE,
  label       TEXT NOT NULL,
  category    TEXT NOT NULL,
  icd_code    TEXT,
  keywords    TEXT[] NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dsm_entries_category ON public.dsm_entries(category);
CREATE INDEX idx_dsm_entries_keywords ON public.dsm_entries USING GIN(keywords);
CREATE INDEX idx_dsm_entries_label_trgm ON public.dsm_entries USING GIN(label gin_trgm_ops);

ALTER TABLE public.dsm_entries ENABLE ROW LEVEL SECURITY;

-- Lecture réservée aux praticiens autorisés (voir can_use_dsm) + admins.
CREATE POLICY "authorized_read_dsm_entries" ON public.dsm_entries
  FOR SELECT USING (
    public.practitioner_has_diagnostic_permission(auth.uid(), 'can_use_dsm')
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "admins_manage_dsm_entries" ON public.dsm_entries
  FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

INSERT INTO public.dsm_entries (code, label, category, icd_code, keywords) VALUES
  ('296.20', 'Trouble dépressif caractérisé, épisode isolé', 'Troubles dépressifs', 'F32', ARRAY['dépression','tristesse','anhédonie','fatigue']),
  ('296.30', 'Trouble dépressif caractérisé, épisodes récurrents', 'Troubles dépressifs', 'F33', ARRAY['dépression','rechute','récidive']),
  ('300.4',  'Trouble dépressif persistant (dysthymie)', 'Troubles dépressifs', 'F34.1', ARRAY['dysthymie','dépression chronique']),
  ('296.89', 'Trouble bipolaire de type II', 'Troubles bipolaires', 'F31.81', ARRAY['bipolaire','hypomanie']),
  ('296.4-296.7', 'Trouble bipolaire de type I', 'Troubles bipolaires', 'F31', ARRAY['bipolaire','manie','épisode maniaque']),
  ('300.02', 'Trouble anxieux généralisé', 'Troubles anxieux', 'F41.1', ARRAY['anxiété','inquiétude','tension']),
  ('300.01', 'Trouble panique', 'Troubles anxieux', 'F41.0', ARRAY['panique','crise d''angoisse','attaque de panique']),
  ('300.22', 'Agoraphobie', 'Troubles anxieux', 'F40.00', ARRAY['agoraphobie','évitement','espaces publics']),
  ('300.23', 'Anxiété sociale (phobie sociale)', 'Troubles anxieux', 'F40.10', ARRAY['phobie sociale','anxiété sociale','timidité pathologique']),
  ('300.29', 'Phobie spécifique', 'Troubles anxieux', 'F40.2', ARRAY['phobie','peur spécifique']),
  ('309.81', 'État de stress post-traumatique (ESPT)', 'Troubles liés à des traumatismes', 'F43.1', ARRAY['trauma','ptsd','stress post-traumatique','flashback']),
  ('308.3',  'Trouble stress aigu', 'Troubles liés à des traumatismes', 'F43.0', ARRAY['stress aigu','trauma récent']),
  ('309.0',  'Trouble de l''adaptation avec humeur dépressive', 'Troubles liés à des traumatismes', 'F43.21', ARRAY['adaptation','stress situationnel']),
  ('300.3',  'Trouble obsessionnel-compulsif (TOC)', 'Troubles obsessionnels-compulsifs', 'F42', ARRAY['toc','obsession','compulsion','rituel']),
  ('300.7',  'Peur excessive d''une maladie (anxiété liée à la santé)', 'Troubles à symptomatologie somatique', 'F45.21', ARRAY['hypocondrie','anxiété santé']),
  ('295.90', 'Schizophrénie', 'Troubles du spectre de la schizophrénie', 'F20.9', ARRAY['schizophrénie','psychose','hallucination','délire']),
  ('295.70', 'Trouble schizo-affectif', 'Troubles du spectre de la schizophrénie', 'F25', ARRAY['schizo-affectif']),
  ('297.1',  'Trouble délirant', 'Troubles du spectre de la schizophrénie', 'F22', ARRAY['délire persistant']),
  ('301.0',  'Personnalité paranoïaque', 'Troubles de la personnalité', 'F60.0', ARRAY['personnalité','méfiance','paranoïaque']),
  ('301.83', 'Personnalité borderline (état-limite)', 'Troubles de la personnalité', 'F60.3', ARRAY['borderline','état-limite','instabilité émotionnelle']),
  ('301.7',  'Personnalité antisociale', 'Troubles de la personnalité', 'F60.2', ARRAY['antisocial','sociopathie']),
  ('301.81', 'Personnalité narcissique', 'Troubles de la personnalité', 'F60.81', ARRAY['narcissique','grandiosité']),
  ('301.6',  'Personnalité dépendante', 'Troubles de la personnalité', 'F60.7', ARRAY['dépendante','soumission']),
  ('301.4',  'Personnalité obsessionnelle-compulsive', 'Troubles de la personnalité', 'F60.5', ARRAY['perfectionnisme','rigidité']),
  ('307.1',  'Anorexie mentale', 'Troubles des conduites alimentaires', 'F50.0', ARRAY['anorexie','restriction alimentaire','poids']),
  ('307.51', 'Boulimie', 'Troubles des conduites alimentaires', 'F50.2', ARRAY['boulimie','vomissement','crise alimentaire']),
  ('307.51-BED', 'Accès hyperphagique (binge-eating)', 'Troubles des conduites alimentaires', 'F50.81', ARRAY['hyperphagie','binge eating','compulsion alimentaire']),
  ('780.52', 'Insomnie', 'Troubles du sommeil-éveil', 'G47.00', ARRAY['insomnie','sommeil']),
  ('347.00', 'Narcolepsie', 'Troubles du sommeil-éveil', 'G47.419', ARRAY['narcolepsie','somnolence']),
  ('314.01', 'TDAH (trouble déficit de l''attention/hyperactivité)', 'Troubles neurodéveloppementaux', 'F90.9', ARRAY['tdah','attention','hyperactivité','impulsivité']),
  ('299.00', 'Trouble du spectre de l''autisme', 'Troubles neurodéveloppementaux', 'F84.0', ARRAY['autisme','tsa','spectre autistique']),
  ('315.00', 'Trouble spécifique des apprentissages (lecture)', 'Troubles neurodéveloppementaux', 'F81.0', ARRAY['dyslexie','apprentissage']),
  ('303.90', 'Trouble de l''usage de l''alcool', 'Troubles liés à une substance', 'F10.20', ARRAY['alcool','addiction','dépendance']),
  ('304.20', 'Trouble de l''usage de la cocaïne', 'Troubles liés à une substance', 'F14.20', ARRAY['cocaïne','stimulant']),
  ('304.30', 'Trouble de l''usage du cannabis', 'Troubles liés à une substance', 'F12.20', ARRAY['cannabis']),
  ('312.31', 'Trouble du jeu (addiction aux jeux d''argent)', 'Troubles liés à une substance et addictions', 'F63.0', ARRAY['jeu pathologique','addiction jeu']),
  ('300.11', 'Trouble de conversion (symptômes neurologiques fonctionnels)', 'Troubles à symptomatologie somatique', 'F44.4', ARRAY['conversion','symptôme fonctionnel']),
  ('300.12', 'Amnésie dissociative', 'Troubles dissociatifs', 'F44.0', ARRAY['amnésie','dissociation']),
  ('300.14', 'Trouble dissociatif de l''identité', 'Troubles dissociatifs', 'F44.81', ARRAY['dissociatif','identité multiple']),
  ('302.71', 'Trouble du désir sexuel hypoactif', 'Dysfonctions sexuelles', 'F52.0', ARRAY['désir sexuel','libido']),
  ('312.34', 'Trouble explosif intermittent', 'Troubles disruptifs, du contrôle des impulsions et des conduites', 'F63.81', ARRAY['colère','impulsivité','agressivité']),
  ('313.81', 'Trouble oppositionnel avec provocation', 'Troubles disruptifs, du contrôle des impulsions et des conduites', 'F91.3', ARRAY['opposition','provocation','enfant']),
  ('331.0',  'Maladie d''Alzheimer avec trouble neurocognitif majeur', 'Troubles neurocognitifs', 'G30.9', ARRAY['alzheimer','démence','trouble cognitif']),
  ('294.1',  'Trouble neurocognitif majeur (autre cause)', 'Troubles neurocognitifs', 'F02', ARRAY['démence','cognitif']),
  ('316',    'Facteurs psychologiques influençant une affection médicale', 'Autres troubles', 'F54', ARRAY['psychosomatique']),
  ('V61.20', 'Problème relationnel parent-enfant', 'Autres situations pouvant faire l''objet d''un examen clinique', 'Z62.820', ARRAY['relation parent-enfant','famille']),
  ('V61.10', 'Problème relationnel avec le conjoint', 'Autres situations pouvant faire l''objet d''un examen clinique', 'Z63.0', ARRAY['couple','conjoint','relation']),
  ('V62.3',  'Problème scolaire ou universitaire', 'Autres situations pouvant faire l''objet d''un examen clinique', 'Z55.9', ARRAY['scolaire','apprentissage','échec scolaire']),
  ('V62.29', 'Problème lié à l''environnement professionnel', 'Autres situations pouvant faire l''objet d''un examen clinique', 'Z56.9', ARRAY['travail','burnout','professionnel'])
ON CONFLICT DO NOTHING;
