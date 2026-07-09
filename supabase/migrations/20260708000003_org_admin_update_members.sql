-- The collaborators page lets an org admin (re)assign a collaborator's org
-- role via user_roles (already allowed by user_roles_write). It now also
-- needs to sync users.role to 'secretary' / 'organization_member' so the
-- member's dashboard routing stays correct after a role change — but no
-- policy ever granted an org admin UPDATE on the users table itself.
CREATE POLICY "org_admin_update_org_members" ON public.users
  FOR UPDATE USING (
    public.is_org_admin(organization_id) AND public.user_has_permission('users.manage')
  )
  WITH CHECK (
    public.is_org_admin(organization_id) AND public.user_has_permission('users.manage')
  );
