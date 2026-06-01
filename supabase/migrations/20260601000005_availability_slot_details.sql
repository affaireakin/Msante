-- Ajouter type de session, durée et tarif sur chaque créneau de disponibilité
ALTER TABLE public.availabilities
  ADD COLUMN IF NOT EXISTS session_type TEXT NOT NULL DEFAULT 'video'
    CHECK (session_type IN ('video', 'presentiel')),
  ADD COLUMN IF NOT EXISTS duration_min INT NOT NULL DEFAULT 60
    CHECK (duration_min >= 15),
  ADD COLUMN IF NOT EXISTS price NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'XOF';
