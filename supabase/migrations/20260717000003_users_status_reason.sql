-- Only practitioners had a status_reason column (drove the practitioner
-- portal's suspension banner) — patients, secretaries and org admins had
-- nowhere to store why their account was suspended, so set-account-status
-- could never surface a motif to them.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS status_reason TEXT;
