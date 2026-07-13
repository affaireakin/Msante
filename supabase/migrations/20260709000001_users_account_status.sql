-- practitioners.account_status has existed since 20260513000003, but the
-- suspension enforcement added across set-account-status, join-consultation,
-- create-consultation-room, update-practitioner-status and the practitioner/
-- patient portal layouts all read/write users.account_status — a column that
-- was never added to `users`. That gap is why a suspended account kept full
-- access: the check always resolved to `undefined` and never matched
-- 'suspended'/'blocked'.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('active', 'suspended', 'blocked'));

CREATE INDEX IF NOT EXISTS idx_users_account_status ON public.users(account_status);

-- Backfill: a practitioner already suspended/blocked before this migration
-- must not be silently reset to 'active' on users.
UPDATE public.users u
SET account_status = p.account_status
FROM public.practitioners p
WHERE p.user_id = u.id AND p.account_status IN ('suspended', 'blocked');
