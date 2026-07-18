-- The new admin urgent-items panel subscribes to postgres_changes on several
-- tables not yet in the supabase_realtime publication fixed in
-- 20260717000004 (that pass only covered appointments/messages/notifications/
-- consultations/payments/mood_entries/practitioners) — without this, the
-- subscriptions below would silently never fire, same bug as before.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'organizations',
    'invitations',
    'practitioner_secretaries',
    'disputes',
    'practitioner_appeals',
    'users'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
