-- Retour terrain (2026-09-07) : un praticien (ex: infirmier) doit pouvoir
-- demander un changement de profession/préfixe, soumis à l'aval d'un admin
-- — pas de modification directe par le praticien lui-même. Nouvelle table,
-- aucune colonne existante touchée ; approbation = mise à jour explicite de
-- practitioners.speciality / users.prefix_id par l'admin via ce flux.

CREATE TABLE public.profession_change_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id     UUID NOT NULL REFERENCES public.practitioners(id) ON DELETE CASCADE,
  current_speciality  TEXT NOT NULL,
  requested_speciality TEXT NOT NULL,
  current_prefix_id   UUID REFERENCES public.professional_prefixes(id) ON DELETE SET NULL,
  requested_prefix_id UUID REFERENCES public.professional_prefixes(id) ON DELETE SET NULL,
  reason              TEXT,
  status              TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note          TEXT,
  reviewed_by         UUID REFERENCES public.users(id),
  reviewed_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profession_change_requests_practitioner ON public.profession_change_requests(practitioner_id);
CREATE INDEX idx_profession_change_requests_status ON public.profession_change_requests(status);

ALTER TABLE public.profession_change_requests ENABLE ROW LEVEL SECURITY;

-- Le praticien voit et crée ses propres demandes (pas de modification/
-- suppression : une fois soumise, seul un admin peut la faire évoluer).
CREATE POLICY "practitioner_own_requests_select" ON public.profession_change_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.practitioners p WHERE p.id = practitioner_id AND p.user_id = auth.uid())
  );

CREATE POLICY "practitioner_own_requests_insert" ON public.profession_change_requests
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.practitioners p WHERE p.id = practitioner_id AND p.user_id = auth.uid())
  );

-- Admins avec la permission déjà utilisée pour la validation des praticiens
-- (cf. 20260722000002_private_documents_bucket.sql) — pas de nouvelle
-- permission à créer, ce workflow est le même périmètre métier.
CREATE POLICY "admin_manage_requests" ON public.profession_change_requests
  FOR ALL USING (
    public.has_admin_permission('practitioners.validate')
  );
