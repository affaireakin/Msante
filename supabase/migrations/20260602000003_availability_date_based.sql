-- Replace day_of_week with specific slot_date
-- Each availability row = a specific date's schedule (not recurring weekly)
ALTER TABLE public.availabilities
  ADD COLUMN IF NOT EXISTS slot_date DATE;

-- Drop existing day_of_week rows since they're now invalid (no date attached)
DELETE FROM public.availabilities WHERE slot_date IS NULL;

ALTER TABLE public.availabilities
  ALTER COLUMN slot_date SET NOT NULL;

ALTER TABLE public.availabilities
  DROP COLUMN IF EXISTS day_of_week;

-- Index for fast lookup by practitioner + upcoming dates
DROP INDEX IF EXISTS idx_avail_pract_date;
CREATE INDEX idx_avail_pract_date ON public.availabilities(practitioner_id, slot_date);
