-- practitioners.languages defaulted to ARRAY['fr'] (a raw code), but the
-- onboarding/profile UI only lets practitioners toggle full labels
-- ('Français', 'Wolof', ...). 'fr' never matches any toggle button, so it
-- can never be removed from the UI — it just sits there forever, and every
-- patient sees a stray "fr" badge alongside whatever the practitioner
-- actually selected. Confirmed in production: 100% of practitioner rows
-- carry this leftover 'fr' entry.

-- 1. Backfill: normalize known raw codes to their canonical label and dedupe.
UPDATE public.practitioners
SET languages = sub.mapped
FROM (
  SELECT p.id, COALESCE(array_agg(DISTINCT
    CASE lang
      WHEN 'fr' THEN 'Français'
      WHEN 'en' THEN 'Anglais'
      WHEN 'ar' THEN 'Arabe'
      WHEN 'wo' THEN 'Wolof'
      ELSE lang
    END
  ), ARRAY[]::text[]) AS mapped
  FROM public.practitioners p, unnest(p.languages) AS lang
  GROUP BY p.id
) sub
WHERE practitioners.id = sub.id;

-- 2. Prevent recurrence: new rows now default to the canonical label.
ALTER TABLE public.practitioners
  ALTER COLUMN languages SET DEFAULT ARRAY['Français'];
