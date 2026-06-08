CREATE TABLE public.schedule_blocks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id UUID NOT NULL REFERENCES public.practitioners(id) ON DELETE CASCADE,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  reason          TEXT NOT NULL CHECK (reason IN ('vacances', 'formation', 'maladie', 'indisponibilite', 'autre')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

CREATE INDEX idx_schedule_blocks_practitioner ON schedule_blocks(practitioner_id, start_date);

ALTER TABLE public.schedule_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "practitioners_own_blocks" ON public.schedule_blocks
  FOR ALL
  USING (auth.uid() = (SELECT user_id FROM practitioners WHERE id = practitioner_id))
  WITH CHECK (auth.uid() = (SELECT user_id FROM practitioners WHERE id = practitioner_id));

CREATE POLICY "admins_all_blocks" ON public.schedule_blocks
  FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
