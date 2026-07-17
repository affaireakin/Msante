-- Practitioners had no way to set how late a patient can cancel a booked
-- consultation — added as a booking setting alongside the existing
-- min_booking_delay_h etc. NULL means "no deadline" (cancel any time).
ALTER TABLE public.practitioner_booking_settings
  ADD COLUMN IF NOT EXISTS cancellation_deadline_hours INT;
