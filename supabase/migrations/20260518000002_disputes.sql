-- Disputes table
CREATE TABLE IF NOT EXISTS public.disputes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number     TEXT NOT NULL UNIQUE,
  payment_id      UUID REFERENCES public.payments(id),
  patient_id      UUID NOT NULL REFERENCES public.users(id),
  practitioner_id UUID NOT NULL REFERENCES public.users(id),
  reason          TEXT NOT NULL,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'under_review', 'resolved', 'closed')),
  priority        TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('normal', 'urgent')),
  assigned_to     UUID REFERENCES public.users(id),
  resolution_notes TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Case number sequence + auto-generate trigger
CREATE SEQUENCE IF NOT EXISTS disputes_case_seq START 1000;

CREATE OR REPLACE FUNCTION generate_dispute_case_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.case_number := 'DPT-' || to_char(NOW(), 'YYYY') || '-' || LPAD(nextval('disputes_case_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_dispute_case_number
  BEFORE INSERT ON public.disputes
  FOR EACH ROW
  WHEN (NEW.case_number IS NULL OR NEW.case_number = '')
  EXECUTE FUNCTION generate_dispute_case_number();

-- Auto-mark as urgent after 48h
CREATE OR REPLACE FUNCTION auto_flag_urgent_disputes()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.disputes
  SET priority = 'urgent', updated_at = NOW()
  WHERE status = 'open'
    AND priority = 'normal'
    AND created_at < NOW() - INTERVAL '48 hours';
END;
$$;

-- Timeline events
CREATE TABLE IF NOT EXISTS public.dispute_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id  UUID NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('created', 'status_changed', 'comment', 'action_taken', 'evidence_added')),
  actor_id    UUID REFERENCES public.users(id),
  actor_role  TEXT CHECK (actor_role IN ('admin', 'patient', 'practitioner', 'system')),
  content     TEXT NOT NULL,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-insert creation event
CREATE OR REPLACE FUNCTION log_dispute_created()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.dispute_events (dispute_id, type, actor_role, content)
  VALUES (NEW.id, 'created', 'system', 'Litige ouvert : ' || NEW.reason);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_dispute_created
  AFTER INSERT ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION log_dispute_created();

-- Auto-log status changes
CREATE OR REPLACE FUNCTION log_dispute_status_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.dispute_events (dispute_id, type, actor_role, content, metadata)
    VALUES (
      NEW.id, 'status_changed', 'admin',
      'Statut changé : ' || OLD.status || ' → ' || NEW.status,
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
    );
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_dispute_status_change
  BEFORE UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION log_dispute_status_change();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_disputes_status    ON public.disputes(status);
CREATE INDEX IF NOT EXISTS idx_disputes_priority  ON public.disputes(priority);
CREATE INDEX IF NOT EXISTS idx_disputes_patient   ON public.disputes(patient_id);
CREATE INDEX IF NOT EXISTS idx_dispute_events_dispute ON public.dispute_events(dispute_id, created_at);

-- RLS
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispute_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_full_disputes" ON public.disputes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "patients_own_disputes" ON public.disputes
  FOR SELECT USING (auth.uid() = patient_id);

CREATE POLICY "practitioners_own_disputes" ON public.disputes
  FOR SELECT USING (auth.uid() = practitioner_id);

CREATE POLICY "admins_full_dispute_events" ON public.dispute_events
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "parties_own_dispute_events" ON public.dispute_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.disputes d
      WHERE d.id = dispute_id
        AND (d.patient_id = auth.uid() OR d.practitioner_id = auth.uid())
    )
  );
