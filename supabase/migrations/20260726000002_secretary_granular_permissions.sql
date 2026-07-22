-- Section 23 (dernier point) : le praticien doit pouvoir attribuer des
-- rôles/permissions granulaires à ses secrétaires, dans les limites fixées
-- par l'administrateur général — jusqu'ici l'accès secrétaire était
-- binaire (actif/révoqué) avec un droit fixe "gérer les rendez-vous".
--
-- Catalogue volontairement restreint aux deux permissions qui correspondent
-- à une fonctionnalité réellement existante côté secrétaire (agenda) — pas
-- de permissions "patients"/"messages" fictives tant que ces écrans
-- n'existent pas pour ce rôle. Le catalogue reste extensible (nouvelle ligne
-- = nouvelle permission délégable dès qu'une fonctionnalité correspondante
-- existe).

CREATE TABLE public.secretary_permissions_catalog (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT UNIQUE NOT NULL,
  label       TEXT NOT NULL,
  description TEXT,
  delegatable BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO public.secretary_permissions_catalog (key, label, description) VALUES
  ('appointments.view',   'Voir l''agenda',    'Consulter les rendez-vous du praticien.'),
  ('appointments.manage', 'Gérer les rendez-vous', 'Confirmer, reporter ou annuler un rendez-vous.');

CREATE TABLE public.practitioner_secretary_permissions (
  secretary_id   UUID NOT NULL REFERENCES public.practitioner_secretaries(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES public.secretary_permissions_catalog(key) ON DELETE CASCADE,
  granted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (secretary_id, permission_key)
);

ALTER TABLE public.secretary_permissions_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practitioner_secretary_permissions ENABLE ROW LEVEL SECURITY;

-- Le catalogue est lisible par tous les utilisateurs authentifiés (nécessaire
-- pour que praticien et secrétaire sachent ce qui est délégable/accordé) ;
-- seul un admin peut changer ce qui est délégable.
CREATE POLICY "secretary_permissions_catalog_read" ON public.secretary_permissions_catalog
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "secretary_permissions_catalog_admin_write" ON public.secretary_permissions_catalog
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- Le praticien propriétaire de la relation gère les permissions accordées ;
-- la secrétaire concernée peut lire les siennes (pour adapter son propre
-- écran) ; l'admin voit tout.
CREATE POLICY "practitioner_manage_secretary_permissions" ON public.practitioner_secretary_permissions
  FOR ALL USING (
    secretary_id IN (
      SELECT ps.id FROM public.practitioner_secretaries ps
      JOIN public.practitioners p ON p.id = ps.practitioner_id
      WHERE p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    secretary_id IN (
      SELECT ps.id FROM public.practitioner_secretaries ps
      JOIN public.practitioners p ON p.id = ps.practitioner_id
      WHERE p.user_id = auth.uid()
    )
    -- Un praticien ne peut jamais accorder une permission que l'admin a
    -- retirée de la liste délégable, même s'il l'avait déjà accordée avant.
    AND permission_key IN (SELECT key FROM public.secretary_permissions_catalog WHERE delegatable = TRUE)
  );

CREATE POLICY "secretary_read_own_permissions" ON public.practitioner_secretary_permissions
  FOR SELECT USING (
    secretary_id IN (SELECT id FROM public.practitioner_secretaries WHERE user_id = auth.uid())
  );

CREATE POLICY "admin_read_all_secretary_permissions" ON public.practitioner_secretary_permissions
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- Par défaut, une nouvelle relation secrétaire reçoit les deux permissions
-- (comportement identique à l'existant : "confirmer, reporter, annuler")
-- pour ne rien casser pour les relations déjà en place au moment du
-- déploiement.
INSERT INTO public.practitioner_secretary_permissions (secretary_id, permission_key)
SELECT ps.id, spc.key
FROM public.practitioner_secretaries ps
CROSS JOIN public.secretary_permissions_catalog spc
ON CONFLICT DO NOTHING;

-- Sans ceci, un(e) secrétaire n'ayant reçu que "appointments.view" pouvait
-- quand même modifier un rendez-vous via un appel direct à l'API — la
-- distinction voir/gérer n'était appliquée que côté interface (boutons
-- masqués), jamais côté base. "Les secrétaires ne doivent accéder qu'aux
-- fonctionnalités explicitement autorisées" (section 23) exige un vrai
-- verrou RLS, pas seulement visuel.
CREATE OR REPLACE FUNCTION public.is_practitioner_secretary_with_permission(target_practitioner_id UUID, perm_key TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.practitioner_secretaries ps
    JOIN public.practitioner_secretary_permissions psp ON psp.secretary_id = ps.id
    WHERE ps.practitioner_id = target_practitioner_id
      AND ps.user_id = auth.uid()
      AND ps.status = 'active'
      AND psp.permission_key = perm_key
  );
$$;

DROP POLICY IF EXISTS "secretary_read_appointments" ON public.appointments;
CREATE POLICY "secretary_read_appointments" ON public.appointments
  FOR SELECT USING (public.is_practitioner_secretary_with_permission(practitioner_id, 'appointments.view'));

DROP POLICY IF EXISTS "secretary_update_appointments" ON public.appointments;
CREATE POLICY "secretary_update_appointments" ON public.appointments
  FOR UPDATE USING (public.is_practitioner_secretary_with_permission(practitioner_id, 'appointments.manage'))
  WITH CHECK (public.is_practitioner_secretary_with_permission(practitioner_id, 'appointments.manage'));
