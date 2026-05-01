-- Availabilities : lecture publique
ALTER TABLE public.availabilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "availabilities_public_read" ON public.availabilities
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY "practitioners_manage_own_availabilities" ON public.availabilities
  FOR ALL USING (
    practitioner_id IN (
      SELECT id FROM public.practitioners WHERE user_id = auth.uid()
    )
  );

-- Appointments : patient voit les siens, praticien voit les siens
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patients_own_appointments" ON public.appointments
  FOR SELECT USING (auth.uid() = patient_id);

CREATE POLICY "patients_create_appointments" ON public.appointments
  FOR INSERT WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "practitioners_own_appointments" ON public.appointments
  FOR SELECT USING (
    practitioner_id IN (
      SELECT id FROM public.practitioners WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "edge_functions_manage_appointments" ON public.appointments
  FOR ALL USING (auth.role() = 'service_role');

-- Payments : patient voit les siens
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patients_own_payments" ON public.payments
  FOR SELECT USING (auth.uid() = patient_id);

CREATE POLICY "edge_functions_manage_payments" ON public.payments
  FOR ALL USING (auth.role() = 'service_role');
