-- Appointment reminders were sent on a hardcoded 24h-before schedule for
-- everyone. Patients can now choose their own lead time.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS reminder_hours_before INT NOT NULL DEFAULT 24;
