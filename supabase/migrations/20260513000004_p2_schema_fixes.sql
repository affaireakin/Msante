-- Fix I3: split practitioner_appeals policy into INSERT + SELECT only
DROP POLICY IF EXISTS "practitioner_own_appeals" ON public.practitioner_appeals;

CREATE POLICY "practitioner_insert_own_appeals" ON public.practitioner_appeals
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.practitioners p WHERE p.id = practitioner_id AND p.user_id = auth.uid())
  );

CREATE POLICY "practitioner_read_own_appeals" ON public.practitioner_appeals
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.practitioners p WHERE p.id = practitioner_id AND p.user_id = auth.uid())
  );

-- Fix I4: index on practitioner_status_history
CREATE INDEX IF NOT EXISTS idx_status_history_practitioner ON public.practitioner_status_history(practitioner_id);

-- Fix I5: indexes on practitioner_appeals
CREATE INDEX IF NOT EXISTS idx_appeals_practitioner ON public.practitioner_appeals(practitioner_id);
CREATE INDEX IF NOT EXISTS idx_appeals_status ON public.practitioner_appeals(status);

-- Fix M2: day_rules_public_read should filter suspended/blocked practitioners
DROP POLICY IF EXISTS "day_rules_public_read" ON public.availability_day_rules;
CREATE POLICY "day_rules_public_read" ON public.availability_day_rules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.practitioners p
      WHERE p.id = practitioner_id AND p.account_status = 'active'
    )
  );

-- Fix M4: index on practitioner_services
CREATE INDEX IF NOT EXISTS idx_services_practitioner ON public.practitioner_services(practitioner_id);
