-- Practitioners could only add recurring weekly availability slots (by
-- day_of_week) — there was no way to open a slot for one specific calendar
-- date without it repeating every week. Add an alternative, mutually
-- exclusive column so a row targets either a recurring weekday or a single
-- date.
ALTER TABLE public.weekly_availabilities
  ALTER COLUMN day_of_week DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS specific_date DATE,
  ADD CONSTRAINT weekly_availabilities_day_xor_date
    CHECK (
      (day_of_week IS NOT NULL AND specific_date IS NULL)
      OR (day_of_week IS NULL AND specific_date IS NOT NULL)
    );

CREATE INDEX IF NOT EXISTS idx_weekly_availabilities_specific_date
  ON public.weekly_availabilities(practitioner_id, specific_date)
  WHERE specific_date IS NOT NULL;
