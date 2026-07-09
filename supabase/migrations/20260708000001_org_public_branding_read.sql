-- Patients need to read an org's name/logo when browsing/booking an
-- org-affiliated practitioner, but org_select (20260704000006) only grants
-- read to super admins, org members, and the org creator — any other patient
-- got organizations: null on every embed, silently hiding the badge feature.
-- Additive/permissive policy: expose branding for active orgs only.
CREATE POLICY "org_select_public_active" ON public.organizations
  FOR SELECT USING (status = 'active');
