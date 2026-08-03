-- Base de Données Publique des Médicaments (BDPM) — remplace la liste
-- statique de médicaments codée en dur (l'ancien "pré-VIDAL"). Données
-- publiques officielles de l'ANSM (base-donnees-publique.medicaments.gouv.fr),
-- réutilisation libre. Alimentée par l'edge function bdpm-import, qui
-- télécharge et indexe le fichier CIS_bdpm.txt (notre environnement de build
-- n'a pas d'accès réseau direct pour le faire nous-mêmes).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE public.bdpm_medications (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cis_code              TEXT NOT NULL UNIQUE,
  denomination          TEXT NOT NULL,
  forme_pharmaceutique  TEXT,
  voies_administration  TEXT,
  statut_amm            TEXT,
  etat_commercialisation TEXT,
  titulaire             TEXT,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bdpm_denomination_trgm ON public.bdpm_medications USING GIN(denomination gin_trgm_ops);

ALTER TABLE public.bdpm_medications ENABLE ROW LEVEL SECURITY;

-- Lecture ouverte à tout praticien authentifié (même gouvernance que
-- l'ancienne liste statique : aucune permission dédiée, seul can_prescribe
-- gate l'acte de prescrire, pas la recherche du médicament).
CREATE POLICY "practitioners_read_bdpm" ON public.bdpm_medications
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('practitioner', 'admin'))
  );

-- Écriture réservée au service role (edge function bdpm-import uniquement).
CREATE POLICY "service_role_manage_bdpm" ON public.bdpm_medications
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
