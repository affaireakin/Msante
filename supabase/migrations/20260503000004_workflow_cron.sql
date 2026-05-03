-- supabase/migrations/20260503000004_workflow_cron.sql
-- Schedule the run-workflow Edge Function every minute for cron-based workflows.
-- Requires pg_cron + pg_net extensions and vault secrets:
--   supabase_url      → your Supabase project URL
--   service_role_key  → your service role key

-- Enable extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove existing job if present (idempotent re-run)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'run-cron-workflows') THEN
    PERFORM cron.unschedule('run-cron-workflows');
  END IF;
END $$;

-- Schedule: every minute, call run-workflow for schedule.cron workflows
SELECT cron.schedule(
  'run-cron-workflows',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') || '/functions/v1/run-workflow',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{"trigger_type": "schedule.cron"}'::jsonb
  )
  $$
);
