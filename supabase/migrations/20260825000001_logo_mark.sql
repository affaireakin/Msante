-- Nouveau logo : un seul graphique combiné (icône + "-Santé") remplace
-- l'ancien pattern icône + texte codé en dur séparément. On garde aussi une
-- variante "icône seule" (sans texte), utilisée sur les pages d'authentification
-- (inspiré de Doctolib, qui n'affiche que son "D" sur ces écrans).
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS logo_mark_url TEXT;
