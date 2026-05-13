-- Remplace le cron d'appointment-reminders pour utiliser le Vault
-- (cohérent avec run-cron-workflows dans 20260503000004).
-- Prérequis : ajouter le secret "service_role_key" dans le Vault Supabase
--   Dashboard → Vault → New Secret → name: service_role_key

-- 1. Stocker l'URL du projet dans le Vault (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets WHERE name = 'supabase_url'
  ) THEN
    PERFORM vault.create_secret(
      'https://jilpynvkpkepusvwcqch.supabase.co',
      'supabase_url',
      'URL publique du projet Supabase M-Santé'
    );
  END IF;
END $$;

-- 2. Supprimer l'ancien job (qui utilisait current_setting, non disponible sans superuser)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'msante-appointment-reminders') THEN
    PERFORM cron.unschedule('msante-appointment-reminders');
  END IF;
END $$;

-- 3. Replanifier avec le Vault (toutes les heures)
SELECT cron.schedule(
  'msante-appointment-reminders',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url')
           || '/functions/v1/send-appointment-reminders',
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
