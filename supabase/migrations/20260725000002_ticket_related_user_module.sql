-- Section 22 ("Création manuelle") : la création manuelle d'un ticket ne
-- permettait pas de préciser l'utilisateur concerné ni le module concerné,
-- deux champs demandés dans le cahier des charges.

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS related_user_id UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS module TEXT;

CREATE INDEX IF NOT EXISTS idx_tickets_related_user ON public.tickets(related_user_id);
