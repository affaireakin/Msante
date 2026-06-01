-- Update practitioner_type constraint to use 'healthcare' and 'wellness' categories
ALTER TABLE public.practitioners
  DROP CONSTRAINT IF EXISTS practitioners_practitioner_type_check;

ALTER TABLE public.practitioners
  ALTER COLUMN practitioner_type SET DEFAULT 'healthcare',
  ADD CONSTRAINT practitioners_practitioner_type_check
    CHECK (practitioner_type IN ('healthcare', 'wellness'));

-- Migrate existing values
UPDATE public.practitioners
  SET practitioner_type = 'healthcare'
  WHERE practitioner_type IN ('doctor', 'psychologist', 'nutritionist', 'other');

UPDATE public.practitioners
  SET practitioner_type = 'wellness'
  WHERE practitioner_type IN ('coach');
