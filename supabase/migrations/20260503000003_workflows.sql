-- supabase/migrations/20260503000003_workflows.sql

-- ── Tables ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL
    CHECK (trigger_type IN ('schedule.cron', 'postgres_changes', 'webhook')),
  trigger_config JSONB DEFAULT '{}',
  nodes JSONB NOT NULL DEFAULT '[]',
  edges JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  trigger_data JSONB DEFAULT '{}',
  status TEXT DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS public.workflow_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  node_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'success', 'error', 'skipped')),
  input_data JSONB DEFAULT '{}',
  output_data JSONB DEFAULT '{}',
  error_details JSONB,
  duration_ms INT,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow ON workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_logs_run ON workflow_logs(run_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_workflows" ON public.workflows FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_workflow_runs" ON public.workflow_runs FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

ALTER TABLE public.workflow_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_workflow_logs" ON public.workflow_logs FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- ── Seed — 3 templates ───────────────────────────────────────────────────────

INSERT INTO public.workflows (name, description, trigger_type, trigger_config, nodes, edges, is_active)
VALUES
(
  'Rappel RDV 24h avant',
  'Envoie un rappel push + SMS aux patients 24h avant leur rendez-vous confirmé.',
  'schedule.cron',
  '{"cron": "0 9 * * *", "send_hour": 9}',
  '[
    {"id":"trigger","type":"triggerNode","position":{"x":50,"y":150},"data":{"label":"Cron 9h","nodeType":"schedule.cron"}},
    {"id":"query","type":"actionNode","position":{"x":250,"y":150},"data":{"label":"Chercher RDV demain","nodeType":"query_upcoming_appointments"}},
    {"id":"push","type":"actionNode","position":{"x":450,"y":100},"data":{"label":"Envoyer Push","nodeType":"send_push","template":"appointment_reminder"}},
    {"id":"sms","type":"actionNode","position":{"x":450,"y":200},"data":{"label":"Envoyer SMS","nodeType":"send_sms","template":"sms_reminder"}},
    {"id":"end","type":"endNode","position":{"x":650,"y":150},"data":{"label":"Fin"}}
  ]',
  '[
    {"id":"e1","source":"trigger","target":"query","animated":false},
    {"id":"e2","source":"query","target":"push","animated":false},
    {"id":"e3","source":"query","target":"sms","animated":false},
    {"id":"e4","source":"push","target":"end","animated":false},
    {"id":"e5","source":"sms","target":"end","animated":false}
  ]',
  false
),
(
  'Alerte mood bas',
  'Détecte un streak de mood bas (score ≤ seuil pendant N jours) et envoie une notification bien-être.',
  'postgres_changes',
  '{"table": "mood_entries", "event": "INSERT", "mood_threshold": 4, "streak_days": 3}',
  '[
    {"id":"trigger","type":"triggerNode","position":{"x":50,"y":150},"data":{"label":"Nouvelle entrée mood","nodeType":"postgres_changes"}},
    {"id":"check","type":"actionNode","position":{"x":250,"y":150},"data":{"label":"Vérifier streak","nodeType":"check_mood_streak"}},
    {"id":"push","type":"actionNode","position":{"x":450,"y":150},"data":{"label":"Push bien-être","nodeType":"send_push","template":"wellness_check"}},
    {"id":"end","type":"endNode","position":{"x":650,"y":150},"data":{"label":"Fin"}}
  ]',
  '[
    {"id":"e1","source":"trigger","target":"check","animated":false},
    {"id":"e2","source":"check","target":"push","animated":false},
    {"id":"e3","source":"push","target":"end","animated":false}
  ]',
  false
),
(
  'Retry paiement échoué',
  'Réessaie automatiquement un paiement échoué après un délai, en notifiant le patient.',
  'postgres_changes',
  '{"table": "payments", "event": "UPDATE", "status_filter": "failed", "delay_hours": 2, "max_retries": 3}',
  '[
    {"id":"trigger","type":"triggerNode","position":{"x":50,"y":150},"data":{"label":"Paiement échoué","nodeType":"postgres_changes"}},
    {"id":"check","type":"actionNode","position":{"x":250,"y":150},"data":{"label":"Vérifier retries","nodeType":"check_retry_count"}},
    {"id":"push","type":"actionNode","position":{"x":450,"y":100},"data":{"label":"Notifier patient","nodeType":"send_push","template":"payment_retry"}},
    {"id":"retry","type":"actionNode","position":{"x":450,"y":200},"data":{"label":"Retry paiement","nodeType":"retry_payment"}},
    {"id":"end","type":"endNode","position":{"x":650,"y":150},"data":{"label":"Fin"}}
  ]',
  '[
    {"id":"e1","source":"trigger","target":"check","animated":false},
    {"id":"e2","source":"check","target":"push","animated":false},
    {"id":"e3","source":"check","target":"retry","animated":false},
    {"id":"e4","source":"push","target":"end","animated":false},
    {"id":"e5","source":"retry","target":"end","animated":false}
  ]',
  false
);
