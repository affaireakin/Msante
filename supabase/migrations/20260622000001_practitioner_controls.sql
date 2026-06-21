-- Colonne "accepte de nouveaux patients" sur les praticiens
ALTER TABLE public.practitioners
  ADD COLUMN IF NOT EXISTS accepting_new_patients BOOLEAN NOT NULL DEFAULT TRUE;
