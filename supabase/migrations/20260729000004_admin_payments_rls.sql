-- The payments table only ever granted SELECT to the owning patient
-- (patients_own_payments) and to service-role edge functions
-- (edge_functions_manage_payments) — org admins got a scoped read via
-- org_admin_read, but no policy ever granted the Super Admin role broad
-- access. admin/payments (web) and its new mobile equivalent both query
-- ALL payments regardless of patient/org, which RLS was silently
-- rejecting down to zero rows for a real 'admin'-role session.
CREATE POLICY "admins_full_access_payments" ON public.payments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
