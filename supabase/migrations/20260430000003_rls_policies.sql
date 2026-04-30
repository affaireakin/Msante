-- === users ===
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_self_read" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_self_update" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "admins_full_access_users" ON public.users
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u2 WHERE u2.id = auth.uid() AND u2.role = 'admin')
  );

-- === practitioners ===
ALTER TABLE public.practitioners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "practitioners_public_read" ON public.practitioners
  FOR SELECT USING (is_verified = TRUE OR user_id = auth.uid());

CREATE POLICY "practitioners_self_insert" ON public.practitioners
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "practitioners_self_update" ON public.practitioners
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "admins_full_access_practitioners" ON public.practitioners
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u2 WHERE u2.id = auth.uid() AND u2.role = 'admin')
  );

-- === verification_documents ===
ALTER TABLE public.verification_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "docs_practitioner_own" ON public.verification_documents
  FOR ALL USING (
    practitioner_id IN (
      SELECT id FROM public.practitioners WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "docs_admin_all" ON public.verification_documents
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u2 WHERE u2.id = auth.uid() AND u2.role = 'admin')
  );
