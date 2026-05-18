-- Migration: mood low-streak alert cron job
-- Runs every day at 08:00 Dakar time (UTC+0 = 08:00 UTC)
-- Sends push notification to patients with 3+ consecutive days of mood score < 4

-- 1. Helper function: returns patients with low mood streak + no recent alert
CREATE OR REPLACE FUNCTION public.get_low_mood_streak_patients()
RETURNS TABLE (id uuid, full_name text, push_token text)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    u.id,
    u.full_name,
    u.push_token
  FROM public.users u
  WHERE
    u.role = 'patient'
    -- At least 3 mood entries in the last 3 days all with score < 4
    AND (
      SELECT COUNT(*)
      FROM public.mood_entries me
      WHERE me.patient_id = u.id
        AND me.entry_date >= CURRENT_DATE - INTERVAL '2 days'
        AND me.score < 4
    ) >= 3
    -- No mood_low_streak notification sent in the past 24h (anti-duplicate)
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = u.id
        AND n.type = 'mood_low_streak'
        AND n.created_at > NOW() - INTERVAL '24 hours'
    );
$$;

-- 2. Schedule cron: every day at 08:00 UTC
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'msante-mood-alerts') THEN
    PERFORM cron.unschedule('msante-mood-alerts');
  END IF;
END $$;

SELECT cron.schedule(
  'msante-mood-alerts',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url')
           || '/functions/v1/send-mood-alerts',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'
      )
    ),
    body := '{}'::jsonb
  )
  $$
);
