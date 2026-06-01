-- Fix appointment type constraint: remove 'chat', add 'presentiel'
ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_type_check;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_type_check
    CHECK (type IN ('video', 'audio', 'presentiel'));

-- Migrate any existing 'chat' appointments to 'video'
UPDATE public.appointments SET type = 'video' WHERE type = 'chat';

-- Waiting list table
CREATE TABLE IF NOT EXISTS public.waiting_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  practitioner_id UUID NOT NULL REFERENCES public.practitioners(id) ON DELETE CASCADE,
  preferred_type TEXT NOT NULL DEFAULT 'video'
    CHECK (preferred_type IN ('video', 'audio', 'presentiel')),
  notes TEXT,
  notified_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'notified', 'booked', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(patient_id, practitioner_id)
);

ALTER TABLE public.waiting_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patients_own_waitlist" ON public.waiting_list
  FOR ALL USING (auth.uid() = patient_id);

CREATE POLICY "practitioners_read_waitlist" ON public.waiting_list
  FOR SELECT USING (
    practitioner_id IN (
      SELECT id FROM public.practitioners WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "admins_full_waitlist" ON public.waiting_list
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX idx_waiting_list_practitioner ON public.waiting_list(practitioner_id, status);
CREATE INDEX idx_waiting_list_patient ON public.waiting_list(patient_id);
