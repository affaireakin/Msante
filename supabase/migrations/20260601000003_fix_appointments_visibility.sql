-- Allow patients to read user profiles of practitioners they have appointments with
CREATE POLICY "users_readable_by_appointment_patients" ON public.users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      JOIN public.practitioners p ON p.id = a.practitioner_id
      WHERE p.user_id = public.users.id
        AND a.patient_id = auth.uid()
    )
  );

-- Allow practitioners to read patient user profiles for their appointments
CREATE POLICY "users_readable_by_appointment_practitioners" ON public.users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      JOIN public.practitioners p ON p.id = a.practitioner_id
      WHERE a.patient_id = public.users.id
        AND p.user_id = auth.uid()
    )
  );

-- Allow patients to read ALL practitioners they have appointments with (regardless of verification)
CREATE POLICY "practitioners_readable_by_appointment_patients" ON public.practitioners
  FOR SELECT USING (
    id IN (
      SELECT practitioner_id FROM public.appointments
      WHERE patient_id = auth.uid()
    )
  );
