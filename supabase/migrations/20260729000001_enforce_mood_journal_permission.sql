-- QA finding : la case "Journal d'humeur" que le patient peut décocher dans
-- ses permissions (patient_data_permissions.allow_mood_journal) n'était
-- vérifiée nulle part côté base — practitioners_can_view_patient_mood /
-- _journal accordaient l'accès à tout praticien ayant eu un RDV confirmé
-- avec le patient, indépendamment de ce que le patient avait autorisé. La
-- case à cocher était purement cosmétique. Un trigger crée automatiquement
-- une ligne patient_data_permissions (allow_mood_journal = FALSE par défaut)
-- dès qu'un RDV est confirmé (20260608000004_patient_data_permissions.sql),
-- donc l'exigence d'existence d'une ligne autorisant explicitement l'accès
-- est sûre par défaut (refuse l'accès si aucune permission n'a été accordée).

DROP POLICY IF EXISTS "practitioners_can_view_patient_mood" ON public.mood_entries;
CREATE POLICY "practitioners_can_view_patient_mood" ON public.mood_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      JOIN public.practitioners p ON p.id = a.practitioner_id
      WHERE a.patient_id = mood_entries.patient_id
        AND p.user_id = auth.uid()
        AND a.status IN ('confirmed', 'completed')
    )
    AND EXISTS (
      SELECT 1 FROM public.patient_data_permissions pdp
      JOIN public.practitioners p2 ON p2.id = pdp.practitioner_id
      WHERE pdp.patient_id = mood_entries.patient_id
        AND p2.user_id = auth.uid()
        AND pdp.allow_mood_journal = TRUE
        AND (pdp.expires_at IS NULL OR pdp.expires_at > NOW())
    )
  );

DROP POLICY IF EXISTS "practitioners_can_view_patient_journal" ON public.journal_entries;
CREATE POLICY "practitioners_can_view_patient_journal" ON public.journal_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      JOIN public.practitioners p ON p.id = a.practitioner_id
      WHERE a.patient_id = journal_entries.patient_id
        AND p.user_id = auth.uid()
        AND a.status IN ('confirmed', 'completed')
    )
    AND EXISTS (
      SELECT 1 FROM public.patient_data_permissions pdp
      JOIN public.practitioners p2 ON p2.id = pdp.practitioner_id
      WHERE pdp.patient_id = journal_entries.patient_id
        AND p2.user_id = auth.uid()
        AND pdp.allow_mood_journal = TRUE
        AND (pdp.expires_at IS NULL OR pdp.expires_at > NOW())
    )
  );
