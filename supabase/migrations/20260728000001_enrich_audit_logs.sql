-- Section 25 : les journaux d'activité sont incohérents et difficiles à
-- interpréter — auteur (actor_id, déjà présent) et date/heure (created_at,
-- déjà présent) existaient, mais "utilisateur concerné", "rôle concerné" et
-- "motif" n'étaient jamais que des clés ad hoc et incohérentes noyées dans
-- old_values/new_values (ex. `reason` ici, `note` là pour le même concept),
-- et "module" n'existait pas du tout. On les promeut en colonnes de premier
-- rang pour permettre filtrage et affichage homogènes.

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS module TEXT,
  ADD COLUMN IF NOT EXISTS target_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS target_role TEXT,
  ADD COLUMN IF NOT EXISTS reason TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_logs_target_user ON public.audit_logs(target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON public.audit_logs(module, created_at DESC);

-- Les triggers existants (rbac_audit, org_creation_audit) sont mis à jour
-- séparément (voir 20260728000002) pour renseigner ces nouvelles colonnes.
