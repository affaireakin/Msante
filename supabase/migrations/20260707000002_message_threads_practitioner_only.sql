-- Enforce "only the practitioner can close/reopen a conversation" server-side.
--
-- The original policies only checked participant_a/participant_b = auth.uid(),
-- despite the comment "Only practitioners can close a conversation" — meaning
-- a PATIENT (also a participant) could call the client SDK directly to
-- close their own thread, or worse, silently reopen one the practitioner had
-- deliberately closed. Web/mobile UIs never exposed this to patients, but
-- nothing server-side actually prevented it.

DROP POLICY IF EXISTS "thread_participants_write" ON public.message_threads;
CREATE POLICY "thread_practitioner_insert" ON public.message_threads
  FOR INSERT WITH CHECK (
    (participant_a = auth.uid() OR participant_b = auth.uid())
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'practitioner')
  );

DROP POLICY IF EXISTS "thread_close_update" ON public.message_threads;
CREATE POLICY "thread_practitioner_update" ON public.message_threads
  FOR UPDATE USING (
    (participant_a = auth.uid() OR participant_b = auth.uid())
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'practitioner')
  );
