-- Generalize practitioner_invitations to cover any organization collaborator
-- (secretary, accountant, moderator, secondary admin...), not just practitioners.
-- "Même processus" per user request: reuse the exact same OTP invite/accept
-- mechanism, branching by account_type.

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('patient','practitioner','admin','organization_admin','organization_member'));

ALTER TABLE public.practitioner_invitations
  ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'practitioner'
    CHECK (account_type IN ('practitioner','collaborator'));

ALTER TABLE public.practitioner_invitations
  ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES public.org_roles(id);

COMMENT ON TABLE public.practitioner_invitations IS
  'Org-scoped OTP invitations. account_type=practitioner creates a practitioners row; account_type=collaborator creates a plain organization_member account, optionally pre-assigned to role_id.';

-- Bug fix: the existing "users_practitioners_public_readable" policy only
-- exposes users behind an is_verified=true practitioner row. An org admin
-- listing their OWN pending practitioners or collaborators (organization_member,
-- never in practitioners at all) would see a blank name — the users!user_id(...)
-- embed silently returns null for rows the caller can't read. Grant org admins
-- read on any user row that belongs to their own organization.
CREATE POLICY "org_admin_read_org_members" ON public.users
  FOR SELECT USING (public.is_org_admin(organization_id));
