-- Permet aux utilisateurs authentifiés d'insérer des notifications pour d'autres users
-- (ex: praticien → patient lors d'un message, patient → praticien, etc.)
CREATE POLICY "authenticated_insert_notifications" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
