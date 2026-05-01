-- Seed : disponibilités pour les praticiens déjà en base (test uniquement)
-- Ce script sera exécuté uniquement en dev via supabase db seed
-- En prod, les praticiens configurent leurs disponibilités via l'app

-- Exemple de disponibilités pour tests
-- INSERT INTO public.availabilities (practitioner_id, day_of_week, start_time, end_time)
-- SELECT id, unnest(ARRAY[1,2,3,4,5]), '09:00', '17:00'
-- FROM public.practitioners
-- WHERE verification_status = 'approved'
-- LIMIT 3;
-- (Commenté — à décommenter uniquement pour seeds de dev)
SELECT 1; -- no-op placeholder
