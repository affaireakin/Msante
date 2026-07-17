-- Cancelling an appointment (from either side) previously required no
-- reason at all, and a practitioner's per-practitioner cancellation
-- deadline had nowhere to be enforced. Enforce both at the DB level (not
-- just client-side) so a direct API call can't bypass either rule:
--   1. A reason is always required when status transitions to 'cancelled'.
--   2. If the PATIENT is the one cancelling (auth.uid() = patient_id) and
--      the practitioner has set a cancellation_deadline_hours, block the
--      cancellation once that window has passed. The practitioner cancelling
--      their own appointment is never subject to this deadline.
CREATE OR REPLACE FUNCTION public.enforce_appointment_cancellation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  deadline_hours INT;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    IF NEW.cancellation_reason IS NULL OR btrim(NEW.cancellation_reason) = '' THEN
      RAISE EXCEPTION 'cancellation_reason_required';
    END IF;

    IF auth.uid() = OLD.patient_id THEN
      SELECT cancellation_deadline_hours INTO deadline_hours
      FROM public.practitioner_booking_settings
      WHERE practitioner_id = OLD.practitioner_id;

      IF deadline_hours IS NOT NULL
         AND OLD.scheduled_at - (deadline_hours || ' hours')::interval < NOW() THEN
        RAISE EXCEPTION 'cancellation_deadline_passed';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_appointment_cancellation ON public.appointments;
CREATE TRIGGER trg_enforce_appointment_cancellation
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_appointment_cancellation();
