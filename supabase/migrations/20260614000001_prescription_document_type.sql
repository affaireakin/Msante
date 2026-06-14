-- Add document_type to distinguish medical prescriptions from wellness recommendations
ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS document_type TEXT NOT NULL DEFAULT 'ordonnance'
    CHECK (document_type IN ('ordonnance', 'recommandation'));

-- Backfill: wellness practitioners' existing prescriptions become recommendations
UPDATE public.prescriptions p
SET document_type = 'recommandation'
FROM public.practitioners pr
WHERE p.practitioner_id = pr.id
  AND pr.practitioner_type = 'wellness';

-- Index for filtering by document_type
CREATE INDEX IF NOT EXISTS idx_prescriptions_document_type ON public.prescriptions(document_type);
