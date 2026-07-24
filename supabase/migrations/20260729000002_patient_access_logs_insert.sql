-- QA finding : "journal d'accès" (patient_access_logs) était lu par le
-- patient et écrit par... personne. Aucune policy INSERT n'existait même
-- pour permettre à un praticien d'y écrire. Un praticien ne peut journaliser
-- un accès que sous sa propre identité, pour un patient avec lequel il a
-- effectivement une relation de suivi (RDV confirmé/terminé) — même
-- contrainte que les policies de lecture mood/journal/notes.
CREATE POLICY "practitioners_insert_own_access_logs" ON public.patient_access_logs
  FOR INSERT WITH CHECK (
    practitioner_id IN (SELECT id FROM public.practitioners WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.patient_id = patient_access_logs.patient_id
        AND a.practitioner_id = patient_access_logs.practitioner_id
        AND a.status IN ('confirmed', 'completed')
    )
  );
