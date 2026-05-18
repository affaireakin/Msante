-- Allow practitioners to read mood entries for their patients
-- (patients who have a confirmed/completed appointment with this practitioner)
CREATE POLICY "practitioners_can_view_patient_mood" ON public.mood_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      JOIN public.practitioners p ON p.id = a.practitioner_id
      WHERE a.patient_id = mood_entries.patient_id
        AND p.user_id = auth.uid()
        AND a.status IN ('confirmed', 'completed')
    )
  );

CREATE POLICY "practitioners_can_view_patient_journal" ON public.journal_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      JOIN public.practitioners p ON p.id = a.practitioner_id
      WHERE a.patient_id = journal_entries.patient_id
        AND p.user_id = auth.uid()
        AND a.status IN ('confirmed', 'completed')
    )
  );

CREATE POLICY "practitioners_can_view_patient_meditation" ON public.meditation_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      JOIN public.practitioners p ON p.id = a.practitioner_id
      WHERE a.patient_id = meditation_sessions.patient_id
        AND p.user_id = auth.uid()
        AND a.status IN ('confirmed', 'completed')
    )
  );
