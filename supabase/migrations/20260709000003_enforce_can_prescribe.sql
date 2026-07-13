-- The admin "Ordonnances" toggle (practitioners.permissions.can_prescribe) was
-- persisted and reflected in the practitioner UI, but never enforced server-
-- side: any practitioner could still INSERT into prescriptions regardless of
-- the flag via a direct API call. Split the old FOR ALL policy so SELECT/
-- UPDATE/DELETE on one's own prescriptions are unaffected, and only INSERT
-- additionally requires can_prescribe (wellness practitioners, whose entries
-- are "recommandations" rather than medical ordonnances, are exempt).
DROP POLICY IF EXISTS "practitioners_manage_own_prescriptions" ON public.prescriptions;

CREATE POLICY "practitioners_select_own_prescriptions" ON public.prescriptions
  FOR SELECT
  USING (auth.uid() = (SELECT user_id FROM practitioners WHERE id = practitioner_id));

CREATE POLICY "practitioners_update_own_prescriptions" ON public.prescriptions
  FOR UPDATE
  USING (auth.uid() = (SELECT user_id FROM practitioners WHERE id = practitioner_id))
  WITH CHECK (auth.uid() = (SELECT user_id FROM practitioners WHERE id = practitioner_id));

CREATE POLICY "practitioners_delete_own_prescriptions" ON public.prescriptions
  FOR DELETE
  USING (auth.uid() = (SELECT user_id FROM practitioners WHERE id = practitioner_id));

CREATE POLICY "practitioners_insert_own_prescriptions" ON public.prescriptions
  FOR INSERT
  WITH CHECK (
    practitioner_id IN (
      SELECT id FROM practitioners
      WHERE user_id = auth.uid()
        AND (
          practitioner_type = 'wellness'
          OR COALESCE((permissions->>'can_prescribe')::boolean, true) = true
        )
    )
  );
