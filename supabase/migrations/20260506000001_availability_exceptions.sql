CREATE TABLE public.availability_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id UUID NOT NULL REFERENCES public.practitioners(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_availability_exceptions_practitioner ON public.availability_exceptions(practitioner_id);

ALTER TABLE public.availability_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "practitioners_manage_own_exceptions" ON public.availability_exceptions
  FOR ALL USING (
    auth.uid() = (SELECT user_id FROM public.practitioners WHERE id = practitioner_id)
  );

CREATE POLICY "exceptions_public_read" ON public.availability_exceptions
  FOR SELECT USING (true);
