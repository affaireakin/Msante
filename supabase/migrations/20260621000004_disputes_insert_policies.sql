-- Patients peuvent ouvrir un litige
CREATE POLICY "patients_insert_disputes" ON public.disputes
  FOR INSERT WITH CHECK (auth.uid() = patient_id);

-- Les parties (patient + praticien) peuvent ajouter un commentaire/événement
CREATE POLICY "parties_insert_dispute_events" ON public.dispute_events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.disputes d
      WHERE d.id = dispute_id
        AND (d.patient_id = auth.uid() OR d.practitioner_id = auth.uid())
    )
  );
