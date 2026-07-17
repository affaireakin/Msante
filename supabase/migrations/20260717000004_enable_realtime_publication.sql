-- The app has been subscribing to `postgres_changes` on several tables (appointments,
-- messages, message_threads, notifications, consultations, payments, mood_entries,
-- practitioners) for months, but the `supabase_realtime` publication on this project
-- has zero tables in it — meaning none of those subscriptions have ever actually
-- delivered a live event. Every "realtime" feature has silently been relying on
-- component mount / manual refresh / mutation-triggered invalidation only.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'appointments',
    'messages',
    'message_threads',
    'notifications',
    'consultations',
    'payments',
    'mood_entries',
    'practitioners'
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
