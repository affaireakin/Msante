-- Section 23 : le praticien pouvait suivre et commenter ses litiges mais ne
-- pouvait pas en ouvrir un lui-même — seule "patients_insert_disputes"
-- existait (20260621000004). Ajoute le pendant symétrique pour les
-- praticiens.
CREATE POLICY "practitioners_insert_disputes" ON public.disputes
  FOR INSERT WITH CHECK (auth.uid() = practitioner_id);
