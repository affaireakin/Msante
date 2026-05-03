# Workflow Builder V1 — Design Document

**Date :** 2026-05-03
**Statut :** Approuvé
**Périmètre :** Web Next.js 15 — Dashboard admin `/admin/workflows` — 3 templates pré-configurés

---

## Objectif

Permettre à l'admin M-Santé d'activer et configurer des workflows d'automatisation santé depuis le dashboard web : rappel RDV 24h, alerte mood bas, retry paiement échoué. Exécution sans infra externe via pg_cron + Supabase Edge Functions.

---

## Architecture

### Approche retenue : Monolithique dans `/admin/workflows`

```
apps/web/app/admin/
├── workflows/
│   ├── page.tsx                  # Liste des workflows (templates + actifs)
│   ├── [id]/
│   │   └── page.tsx              # Canvas React Flow + panneau config
│   └── components/
│       ├── WorkflowCard.tsx      # Carte template dans la liste
│       ├── WorkflowCanvas.tsx    # React Flow read-only
│       ├── ConfigPanel.tsx       # Formulaire de configuration droite
│       └── StatusBadge.tsx       # Badge active/inactive/running

supabase/
├── migrations/
│   └── 20260503000003_workflows.sql   # workflows + workflow_runs + workflow_logs + seed
└── functions/
    └── run-workflow/
        └── index.ts              # Edge Function orchestrateur
```

### Package à installer

```bash
pnpm --filter web add @xyflow/react
```

---

## Base de données

### Migration `20260503000003_workflows.sql`

```sql
-- Table workflows
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

-- Table workflow_runs
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

-- Table workflow_logs
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

-- Index
CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow ON workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_logs_run ON workflow_logs(run_id);

-- RLS
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_workflows" ON public.workflows FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_workflow_runs" ON public.workflow_runs FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

ALTER TABLE public.workflow_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_workflow_logs" ON public.workflow_logs FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
```

### Seed — 3 templates pré-configurés

**Template 1 : Rappel RDV 24h avant**
```json
{
  "name": "Rappel RDV 24h avant",
  "trigger_type": "schedule.cron",
  "trigger_config": { "cron": "0 9 * * *", "send_hour": 9 },
  "nodes": [
    { "id": "trigger", "type": "triggerNode", "data": { "label": "Cron 9h", "type": "schedule.cron" } },
    { "id": "query", "type": "actionNode", "data": { "label": "Chercher RDV demain", "type": "query_upcoming_appointments" } },
    { "id": "push", "type": "actionNode", "data": { "label": "Envoyer Push", "type": "send_push", "template": "appointment_reminder" } },
    { "id": "sms", "type": "actionNode", "data": { "label": "Envoyer SMS", "type": "send_sms", "template": "sms_reminder" } },
    { "id": "end", "type": "endNode", "data": { "label": "Fin" } }
  ],
  "edges": [
    { "id": "e1", "source": "trigger", "target": "query" },
    { "id": "e2", "source": "query", "target": "push" },
    { "id": "e3", "source": "push", "target": "sms" },
    { "id": "e4", "source": "sms", "target": "end" }
  ]
}
```

**Template 2 : Alerte mood bas**
```json
{
  "name": "Alerte mood bas",
  "trigger_type": "postgres_changes",
  "trigger_config": { "table": "mood_entries", "event": "INSERT", "mood_threshold": 4, "streak_days": 3 },
  "nodes": [
    { "id": "trigger", "type": "triggerNode", "data": { "label": "Nouvelle entrée mood", "type": "postgres_changes" } },
    { "id": "check", "type": "actionNode", "data": { "label": "Vérifier streak", "type": "check_mood_streak" } },
    { "id": "push", "type": "actionNode", "data": { "label": "Envoyer Push bien-être", "type": "send_push", "template": "wellness_check" } },
    { "id": "end", "type": "endNode", "data": { "label": "Fin" } }
  ],
  "edges": [
    { "id": "e1", "source": "trigger", "target": "check" },
    { "id": "e2", "source": "check", "target": "push" },
    { "id": "e3", "source": "push", "target": "end" }
  ]
}
```

**Template 3 : Retry paiement échoué**
```json
{
  "name": "Retry paiement échoué",
  "trigger_type": "postgres_changes",
  "trigger_config": { "table": "payments", "event": "UPDATE", "status_filter": "failed", "delay_hours": 2, "max_retries": 3 },
  "nodes": [
    { "id": "trigger", "type": "triggerNode", "data": { "label": "Paiement échoué", "type": "postgres_changes" } },
    { "id": "check", "type": "actionNode", "data": { "label": "Vérifier retries", "type": "check_retry_count" } },
    { "id": "push", "type": "actionNode", "data": { "label": "Notifier patient", "type": "send_push", "template": "payment_retry" } },
    { "id": "retry", "type": "actionNode", "data": { "label": "Retry paiement", "type": "retry_payment" } },
    { "id": "end", "type": "endNode", "data": { "label": "Fin" } }
  ],
  "edges": [
    { "id": "e1", "source": "trigger", "target": "check" },
    { "id": "e2", "source": "check", "target": "push" },
    { "id": "e3", "source": "push", "target": "retry" },
    { "id": "e4", "source": "retry", "target": "end" }
  ]
}
```

---

## Backend — Edge Function `run-workflow`

### Rôle

Orchestrateur appelé :
- Par pg_cron (toutes les minutes) pour les workflows `schedule.cron` actifs
- Par un trigger Postgres `AFTER INSERT OR UPDATE` pour les workflows `postgres_changes`

### Logique

```
1. Charger le workflow (nodes + trigger_config)
2. Créer un workflow_run (status='running')
3. Pour chaque node (séquentiel) :
   a. Créer workflow_log (status='running')
   b. Exécuter le handler du node_type
   c. Mettre à jour workflow_log (status='success'|'error', duration_ms)
4. Mettre à jour workflow_run (status='completed'|'failed', ended_at)
```

### Node handlers

| node_type | Logique |
|-----------|---------|
| `query_upcoming_appointments` | `SELECT appointments WHERE scheduled_at BETWEEN now()+23h AND now()+25h AND status='confirmed'` |
| `send_push` | Appelle Expo Push API avec le template |
| `send_sms` | Log uniquement en V1 (SMS provider non configuré) |
| `check_mood_streak` | `SELECT mood_entries WHERE score <= threshold ORDER BY entry_date DESC LIMIT streak_days` — skip si streak non atteint |
| `check_retry_count` | `SELECT retry_count FROM payments WHERE id=X` — skip si retry_count >= max_retries |
| `retry_payment` | `UPDATE payments SET retry_count=retry_count+1, status='processing'` |

### pg_cron setup

```sql
SELECT cron.schedule('run-cron-workflows', '* * * * *',
  $$SELECT net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/run-workflow',
    headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>"}',
    body := '{"trigger_type": "schedule.cron"}'
  )$$
);
```

---

## Frontend

### `/admin/workflows` — Liste

- Grille 3 cartes glassmorphiques
- Chaque carte : nom · description · badge trigger type · badge statut (inactif/actif/en cours) · date dernière exécution · bouton "Configurer →"
- TanStack Query `queryKey: ['admin-workflows']`, `staleTime: 30_000`

### `/admin/workflows/[id]` — Détail

Layout 2 colonnes :

**Canvas React Flow (60%)**
- Nodes read-only, positionnés automatiquement (layout dagre ou positions fixes)
- 3 types custom : `triggerNode` (sky), `actionNode` (white), `endNode` (emerald)
- Edges animés si `is_active = true`
- MiniMap + Controls désactivés (V1 read-only)

**Config Panel (40%)**
- Formulaire React Hook Form + Zod, champs selon `trigger_type`
- `onSubmit` → `UPDATE workflows SET trigger_config=..., updated_at=now()`
- Bouton Activer/Désactiver → `UPDATE workflows SET is_active=!is_active`

**Historique (bas de page)**
- Tableau 10 derniers `workflow_runs` (TanStack Query)
- Expand row → timeline `workflow_logs` node par node

---

## Stack technique

| Outil | Usage |
|-------|-------|
| Next.js 15 App Router | Framework |
| @xyflow/react | Canvas React Flow read-only |
| TanStack Query v5 | Cache + mutations |
| React Hook Form + Zod | Config panel formulaires |
| Supabase SSR + Realtime | Données + live updates |
| pg_cron | Déclenchement cron workflows |
| Supabase Edge Function | Orchestrateur `run-workflow` |

---

## Sécurité

- RLS sur `workflows`, `workflow_runs`, `workflow_logs` : admins uniquement
- Edge Function `run-workflow` : appelée avec `service_role` key (pg_cron) ou vérification JWT admin
- Nodes `retry_payment` : rate-limité par `max_retries` dans `trigger_config`
