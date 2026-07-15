-- A practitioner-invited secretary became fully active the instant they
-- accepted their email invite — no super admin oversight at all. Add a
-- 'pending' state (new default) that keeps them locked out of everything
-- (is_practitioner_secretary() already only matches status = 'active'),
-- plus a distinct 'rejected' state so the admin's decision is visible
-- without conflating it with a later revocation of a once-active secretary.
ALTER TABLE public.practitioner_secretaries
  DROP CONSTRAINT IF EXISTS practitioner_secretaries_status_check;
ALTER TABLE public.practitioner_secretaries
  ADD CONSTRAINT practitioner_secretaries_status_check
    CHECK (status IN ('pending', 'active', 'revoked', 'rejected'));
ALTER TABLE public.practitioner_secretaries
  ALTER COLUMN status SET DEFAULT 'pending';
