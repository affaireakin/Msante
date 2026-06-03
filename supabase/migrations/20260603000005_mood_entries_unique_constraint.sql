-- Fix wellness mood tracker: upsert requires a unique constraint on (patient_id, entry_date)
ALTER TABLE public.mood_entries
  ADD CONSTRAINT mood_entries_patient_date_unique UNIQUE (patient_id, entry_date);
