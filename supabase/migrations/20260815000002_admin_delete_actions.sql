-- Permet à un admin de supprimer un compte utilisateur ou une organisation
-- directement depuis le back-office (sans passer par Supabase), avec le
-- même comportement RGPD que la suppression volontaire par l'utilisateur
-- lui-même (delete-account) : blocage immédiat, effacement sous 30 jours.
ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_status_check;
ALTER TABLE public.organizations ADD CONSTRAINT organizations_status_check
  CHECK (status IN ('pending','active','suspended','rejected','archived','deleted'));
