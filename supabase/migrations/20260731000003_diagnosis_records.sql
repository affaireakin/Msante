-- Association d'un diagnostic (DSM ou CIM) à une consultation / un dossier
-- patient, gérée par le praticien pendant son parcours de consultation.
CREATE TABLE public.diagnosis_records (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id       UUID NOT NULL REFERENCES public.users(id),
  practitioner_id  UUID NOT NULL REFERENCES public.practitioners(id),
  consultation_id  UUID REFERENCES public.consultations(id),
  appointment_id   UUID REFERENCES public.appointments(id),
  source           TEXT NOT NULL CHECK (source IN ('dsm', 'cim')),
  code             TEXT NOT NULL,
  label            TEXT NOT NULL,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_diagnosis_records_patient ON public.diagnosis_records(patient_id, created_at DESC);
CREATE INDEX idx_diagnosis_records_practitioner ON public.diagnosis_records(practitioner_id, created_at DESC);

ALTER TABLE public.diagnosis_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patients_read_own_diagnosis_records" ON public.diagnosis_records
  FOR SELECT USING (auth.uid() = patient_id);

CREATE POLICY "practitioners_select_own_diagnosis_records" ON public.diagnosis_records
  FOR SELECT
  USING (auth.uid() = (SELECT user_id FROM practitioners WHERE id = practitioner_id));

CREATE POLICY "practitioners_insert_own_diagnosis_records" ON public.diagnosis_records
  FOR INSERT
  WITH CHECK (
    practitioner_id IN (SELECT id FROM practitioners WHERE user_id = auth.uid())
    AND public.practitioner_has_diagnostic_permission(auth.uid(), 'can_associate_diagnosis')
  );

CREATE POLICY "practitioners_delete_own_diagnosis_records" ON public.diagnosis_records
  FOR DELETE
  USING (auth.uid() = (SELECT user_id FROM practitioners WHERE id = practitioner_id));

CREATE POLICY "admins_all_diagnosis_records" ON public.diagnosis_records
  FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- QA finding (section 27 scoping): audit_logs' INSERT policy only ever
-- allowed role='admin' as actor, yet several practitioner-facing client
-- pages (e.g. practitioner/profile speciality-change logging) already
-- insert audit_logs rows directly — those inserts were silently rejected
-- by RLS. The new "DSM/CIM search" audit trail needs practitioners to be
-- able to log their own actions, so this closes that gap generally rather
-- than special-casing just the new action type.
CREATE POLICY "practitioners_insert_own_audit_logs" ON public.audit_logs
  FOR INSERT
  WITH CHECK (actor_id = auth.uid());
