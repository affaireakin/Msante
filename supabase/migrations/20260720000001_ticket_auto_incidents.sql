-- Section 18 : les erreurs système détectées automatiquement (paiement,
-- visioconférence, crash client...) créent un ticket type='incident' sans
-- créateur humain — created_by doit donc devenir optionnel. `source`
-- identifie l'origine technique de l'anomalie pour la déduplication (ne pas
-- réouvrir un ticket tant que le précédent pour la même source n'est pas
-- résolu).
ALTER TABLE public.tickets ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS source TEXT;
CREATE INDEX IF NOT EXISTS idx_tickets_source ON public.tickets(source) WHERE source IS NOT NULL;
