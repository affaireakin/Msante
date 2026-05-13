-- Planifie send-consultation-alerts toutes les 5 minutes via pg_cron + Vault.
-- Cette fonction envoie une notification push à patient + praticien
-- 15 minutes avant le début d'une consultation confirmée.
-- Prérequis : secrets 'supabase_url' et 'service_role_key' déjà présents dans le Vault.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'msante-consultation-alerts') THEN
    PERFORM cron.unschedule('msante-consultation-alerts');
  END IF;
END $$;

SELECT cron.schedule(
  'msante-consultation-alerts',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url')
           || '/functions/v1/send-consultation-alerts',
    headers := jsonb_build_object(
      'Content-Type',   'application/json',
      'Authorization',  'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'
      )
    ),
    body := '{}'::jsonb
  )
  $$
);
