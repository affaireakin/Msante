-- Section 24 : les admins d'organisation peuvent aujourd'hui accorder
-- N'IMPORTE QUELLE permission du catalogue (y compris users.manage,
-- roles.manage) à un rôle de leur organisation, sans plafond fixé par
-- l'administrateur général — contrairement au catalogue équivalent pour les
-- secrétaires de praticiens (secretary_permissions_catalog.delegatable,
-- 20260726000002). On applique ici le même mécanisme de plafond.

ALTER TABLE public.permissions ADD COLUMN IF NOT EXISTS delegatable BOOLEAN NOT NULL DEFAULT TRUE;

-- Seul un admin général (permissions_super_admin_write, déjà en place) peut
-- changer ce qui est délégable ; ce n'est pas une nouvelle policy, juste une
-- colonne supplémentaire couverte par la policy existante.

-- Un admin d'organisation ne peut désormais accorder (INSERT dans
-- role_permissions) que des permissions marquées delegatable = TRUE, même
-- s'il les avait déjà accordées avant qu'un admin général ne retire ce
-- droit. La révocation (DELETE) reste toujours possible, gouvernée par
-- USING et non par WITH CHECK.
DROP POLICY IF EXISTS "role_permissions_write" ON public.role_permissions;
CREATE POLICY "role_permissions_write" ON public.role_permissions
  FOR ALL USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.org_roles r
      WHERE r.id = role_id
        AND public.is_org_admin(r.organization_id)
        AND public.user_has_permission('roles.manage')
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      EXISTS (
        SELECT 1 FROM public.org_roles r
        WHERE r.id = role_id
          AND public.is_org_admin(r.organization_id)
          AND public.user_has_permission('roles.manage')
      )
      AND permission_id IN (SELECT id FROM public.permissions WHERE delegatable = TRUE)
    )
  );
