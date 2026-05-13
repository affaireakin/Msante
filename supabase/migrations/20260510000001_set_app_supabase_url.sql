-- Configure l'URL du projet Supabase comme paramètre de base de données.
-- Utilisé par pg_cron + pg_net dans les migrations précédentes
-- (send-appointment-reminders, run-cron-workflows).
--
-- La service_role_key est un SECRET : ne jamais la mettre ici.
-- Exécuter le script supabase/scripts/set_service_role_key.sql
-- manuellement dans le SQL Editor Supabase.

ALTER DATABASE postgres SET "app.supabase_url" = 'https://jilpynvkpkepusvwcqch.supabase.co';
