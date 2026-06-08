-- Extend appointment type CHECK constraint to add 'suivi' and 'urgence'

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_type_check;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_type_check
    CHECK (type IN ('video', 'audio', 'presentiel', 'suivi', 'urgence'));

-- Also extend the waiting_list preferred_type constraint if it exists
DO $$ BEGIN
  ALTER TABLE public.waiting_list
    DROP CONSTRAINT IF EXISTS waiting_list_preferred_type_check;
  ALTER TABLE public.waiting_list
    ADD CONSTRAINT waiting_list_preferred_type_check
      CHECK (preferred_type IN ('video', 'audio', 'presentiel', 'suivi', 'urgence'));
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
