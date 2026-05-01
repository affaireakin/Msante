-- mood_entries table
CREATE TABLE IF NOT EXISTS public.mood_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  score INT NOT NULL CHECK (score BETWEEN 1 AND 10),
  emotions TEXT[] DEFAULT '{}',
  note TEXT,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mood_entries_patient_date
  ON mood_entries(patient_id, entry_date DESC);

ALTER TABLE public.mood_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "patients_own_mood" ON public.mood_entries
  FOR ALL USING (auth.uid() = patient_id);

-- journal_entries table
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT NOT NULL,
  mood_score INT CHECK (mood_score BETWEEN 1 AND 10),
  emotions TEXT[] DEFAULT '{}',
  ai_sentiment TEXT,
  ai_themes TEXT[] DEFAULT '{}',
  ai_suggestion TEXT,
  is_private BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_patient
  ON journal_entries(patient_id, created_at DESC);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "patients_own_journal" ON public.journal_entries
  FOR ALL USING (auth.uid() = patient_id);
