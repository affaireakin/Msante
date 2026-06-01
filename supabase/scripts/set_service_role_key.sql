-- ⚠️  NE PAS COMMITTER CE FICHIER AVEC LA VRAIE CLÉ.
-- À exécuter UNE SEULE FOIS dans le SQL Editor de ton projet Supabase :
--   Dashboard → SQL Editor → New Query → Coller → Run
--
-- Remplace <TA_SERVICE_ROLE_KEY> par la clé trouvée dans :
--   Dashboard → Project Settings → API → service_role (secret)

ALTER DATABASE postgres SET "app.service_role_key" = '<TA_SERVICE_ROLE_KEY>';

-- Vérification (optionnel) :
-- SELECT current_setting('app.service_role_key', true);
