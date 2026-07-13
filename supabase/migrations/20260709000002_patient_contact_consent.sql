-- A practitioner could read a patient's phone number (patients list + fiche
-- patient) purely because they shared an appointment together, with no
-- consent step. Add an explicit, patient-controlled opt-in, default off.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS share_contact_with_practitioners BOOLEAN NOT NULL DEFAULT false;
