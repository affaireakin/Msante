-- Patient can read their own block status on a practitioner's profile
CREATE POLICY "patient_read_own_block" ON public.practitioner_patient_blocks
  FOR SELECT USING (patient_id = auth.uid());
