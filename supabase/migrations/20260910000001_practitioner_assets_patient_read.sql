-- Cachet et signature praticien : lecture par le patient concerné.
--
-- Le bucket `practitioner-assets` est privé et sa seule policy SELECT limite
-- la lecture au propriétaire du dossier (le praticien lui-même). Conséquence :
-- une ordonnance affichée côté patient ne pouvait jamais montrer le cachet ni
-- la signature — le patient n'a pas le droit d'émettre une URL signée dessus.
--
-- On ouvre donc la lecture, strictement, aux patients qui ont (ou ont eu) un
-- rendez-vous avec ce praticien : exactement l'ensemble des personnes
-- susceptibles d'avoir reçu une ordonnance de sa part. Policy additive et
-- permissive : elle s'ajoute par OU à celle du propriétaire, qui est inchangée.
--
-- Le nom de l'objet est de la forme '<user_id du praticien>/stamp.png', donc
-- (storage.foldername(name))[1] est bien le user_id du praticien.

DROP POLICY IF EXISTS "practitioner_assets_patient_read" ON storage.objects;

CREATE POLICY "practitioner_assets_patient_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'practitioner-assets'
    AND EXISTS (
      SELECT 1
      FROM public.appointments a
      JOIN public.practitioners p ON p.id = a.practitioner_id
      WHERE a.patient_id = auth.uid()
        AND p.user_id::text = (storage.foldername(storage.objects.name))[1]
    )
  );
