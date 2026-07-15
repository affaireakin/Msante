-- Nothing on appointments distinguished a patient-initiated booking (already
-- implicitly accepted by the patient, awaiting the practitioner) from a
-- practitioner-initiated one (should await the PATIENT's acceptance instead).
-- Without this, a practitioner-created appointment could only ever be
-- auto-confirmed or require the practitioner to "confirm" their own booking,
-- with no way for the patient to actually accept it.
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS created_by TEXT NOT NULL DEFAULT 'patient'
    CHECK (created_by IN ('patient', 'practitioner'));
