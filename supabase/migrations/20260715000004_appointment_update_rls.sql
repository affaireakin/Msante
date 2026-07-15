-- Neither patients nor base (non-secretary, non-org) practitioners ever had
-- an UPDATE policy on appointments — only edge_functions_manage_appointments
-- (service_role) and the secretary/org-permission-scoped policies could
-- write. A plain independent practitioner's "Confirmer/Annuler/Terminé"
-- buttons therefore updated 0 rows under RLS (Postgres silently matches
-- nothing rather than erroring), which the client-side code had no way to
-- detect — it looked like the buttons simply didn't work.
--
-- Patients get a narrower WITH CHECK: they can only ever move a pending
-- request they own to 'confirmed' (accept) or 'cancelled' (decline/cancel)
-- — never 'completed'/'no_show', which stay practitioner/system-controlled.
--
-- Turns out a "practitioners_update_own_appointments" policy already existed
-- on the remote database (added outside of migration history, same drift
-- pattern as users.account_status earlier) — drop and recreate it so its
-- definition is known and matches WITH CHECK, instead of assuming.
DROP POLICY IF EXISTS "practitioners_update_own_appointments" ON public.appointments;
CREATE POLICY "practitioners_update_own_appointments" ON public.appointments
  FOR UPDATE
  USING (practitioner_id IN (SELECT id FROM public.practitioners WHERE user_id = auth.uid()))
  WITH CHECK (practitioner_id IN (SELECT id FROM public.practitioners WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "patients_update_own_appointments" ON public.appointments;
CREATE POLICY "patients_update_own_appointments" ON public.appointments
  FOR UPDATE
  USING (auth.uid() = patient_id)
  WITH CHECK (auth.uid() = patient_id AND status IN ('confirmed', 'cancelled'));
