# Workflow Builder V1 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implémenter le Workflow Builder V1 dans le dashboard admin M-Santé — 3 templates pré-configurés (rappel RDV, alerte mood, retry paiement), canvas React Flow read-only, panneau de configuration, historique d'exécutions, orchestrateur Edge Function + pg_cron.

**Architecture:** Monolithique dans `/admin/workflows`. TanStack Query pour le cache. Canvas React Flow read-only avec nodes custom. Edge Function `run-workflow` comme orchestrateur universel appelé par pg_cron (cron) et trigger Postgres (postgres_changes). Toutes les tables ont RLS admins-only.

**Tech Stack:** Next.js 15 App Router, @xyflow/react, React Hook Form + Zod, TanStack Query v5, Supabase SSR + Edge Functions (Deno), pg_cron.

---

### Task 1: Migration DB — workflows + workflow_runs + workflow_logs + seed

**Files:**
- Create: `supabase/migrations/20260503000003_workflows.sql`

**Step 1: Create the migration file**

```sql
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
```

**Step 2: Commit**

```bash
git add supabase/migrations/20260503000003_workflows.sql
git commit -m "feat(workflows): add workflows + workflow_runs + workflow_logs tables with seed"
```

---

### Task 2: Install packages + add Workflows nav item

**Files:**
- Modify: `apps/web/package.json` (via pnpm)
- Modify: `apps/web/app/admin/layout.tsx`

**Step 1: Install @xyflow/react + react-hook-form + zod**

```bash
cd "c:/Users/Khodiaou/Desktop/m-santé app"
pnpm --filter web add @xyflow/react react-hook-form zod
```

**Step 2: Verify**

```bash
grep -E "@xyflow|react-hook-form|\"zod\"" apps/web/package.json
```

Expected: all 3 packages present.

**Step 3: Add Workflows to admin sidebar nav**

In `apps/web/app/admin/layout.tsx`, add a 5th nav item to the `navItems` array (after Paiements):

```typescript
{
  href: '/admin/workflows',
  label: 'Workflows',
  icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  ),
},
```

**Step 4: Commit**

```bash
git add apps/web/package.json apps/web/app/admin/layout.tsx
git commit -m "feat(workflows): install xyflow + react-hook-form + zod, add Workflows nav item"
```

---

### Task 3: TypeScript types for workflows

**Files:**
- Create: `apps/web/types/workflows.ts`

**Step 1: Create the types file**

```typescript
// apps/web/types/workflows.ts

export type TriggerType = 'schedule.cron' | 'postgres_changes' | 'webhook'
export type WorkflowStatus = 'running' | 'completed' | 'failed' | 'cancelled'
export type NodeLogStatus = 'pending' | 'running' | 'success' | 'error' | 'skipped'
export type WorkflowNodeType = 'triggerNode' | 'actionNode' | 'endNode'

export interface WorkflowNodeData {
  label: string
  nodeType: string
  template?: string
}

export interface WorkflowNode {
  id: string
  type: WorkflowNodeType
  position: { x: number; y: number }
  data: WorkflowNodeData
}

export interface WorkflowEdge {
  id: string
  source: string
  target: string
  animated?: boolean
}

export interface CronTriggerConfig {
  cron: string
  send_hour: number
}

export interface MoodTriggerConfig {
  table: 'mood_entries'
  event: 'INSERT'
  mood_threshold: number
  streak_days: number
}

export interface PaymentTriggerConfig {
  table: 'payments'
  event: 'UPDATE'
  status_filter: string
  delay_hours: number
  max_retries: number
}

export type TriggerConfig = CronTriggerConfig | MoodTriggerConfig | PaymentTriggerConfig

export interface Workflow {
  id: string
  name: string
  description: string | null
  trigger_type: TriggerType
  trigger_config: TriggerConfig
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface WorkflowRun {
  id: string
  workflow_id: string
  trigger_data: Record<string, unknown>
  status: WorkflowStatus
  started_at: string
  ended_at: string | null
  error_message: string | null
}

export interface WorkflowLog {
  id: string
  run_id: string
  node_id: string
  node_type: string
  status: NodeLogStatus
  input_data: Record<string, unknown>
  output_data: Record<string, unknown>
  error_details: Record<string, unknown> | null
  duration_ms: number | null
  executed_at: string
}
```

**Step 2: Commit**

```bash
git add apps/web/types/workflows.ts
git commit -m "feat(workflows): add TypeScript types"
```

---

### Task 4: TanStack Query hooks for workflows

**Files:**
- Create: `apps/web/app/admin/workflows/useWorkflows.ts`

**Step 1: Create the hooks file**

```typescript
// apps/web/app/admin/workflows/useWorkflows.ts
'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Workflow, WorkflowRun, WorkflowLog, TriggerConfig } from '@/types/workflows'

export function useWorkflows() {
  return useQuery({
    queryKey: ['admin-workflows'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as Workflow[]
    },
    staleTime: 30_000,
  })
}

export function useWorkflow(id: string) {
  return useQuery({
    queryKey: ['admin-workflow', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as Workflow
    },
    staleTime: 30_000,
  })
}

export function useWorkflowRuns(workflowId: string) {
  return useQuery({
    queryKey: ['admin-workflow-runs', workflowId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workflow_runs')
        .select('*')
        .eq('workflow_id', workflowId)
        .order('started_at', { ascending: false })
        .limit(10)
      if (error) throw error
      return (data ?? []) as WorkflowRun[]
    },
    staleTime: 15_000,
  })
}

export function useWorkflowLogs(runId: string | null) {
  return useQuery({
    queryKey: ['admin-workflow-logs', runId],
    queryFn: async () => {
      if (!runId) return []
      const { data, error } = await supabase
        .from('workflow_logs')
        .select('*')
        .eq('run_id', runId)
        .order('executed_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as WorkflowLog[]
    },
    enabled: !!runId,
    staleTime: 15_000,
  })
}

export function useUpdateWorkflow() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      trigger_config,
      is_active,
    }: {
      id: string
      trigger_config?: TriggerConfig
      is_active?: boolean
    }) => {
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (trigger_config !== undefined) updates.trigger_config = trigger_config
      if (is_active !== undefined) updates.is_active = is_active
      const { error } = await supabase.from('workflows').update(updates).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-workflows'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-workflow', id] })
    },
  })
}
```

**Step 2: Commit**

```bash
git add apps/web/app/admin/workflows/useWorkflows.ts
git commit -m "feat(workflows): add TanStack Query hooks"
```

---

### Task 5: StatusBadge + WorkflowCard components

**Files:**
- Create: `apps/web/app/admin/workflows/components/StatusBadge.tsx`
- Create: `apps/web/app/admin/workflows/components/WorkflowCard.tsx`

**Step 1: Create StatusBadge**

```typescript
// apps/web/app/admin/workflows/components/StatusBadge.tsx
interface StatusBadgeProps {
  isActive: boolean
  lastRunStatus?: string | null
}

export function StatusBadge({ isActive, lastRunStatus }: StatusBadgeProps) {
  if (lastRunStatus === 'running') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
        En cours
      </span>
    )
  }
  if (isActive) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Actif
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
      Inactif
    </span>
  )
}
```

**Step 2: Create WorkflowCard**

```typescript
// apps/web/app/admin/workflows/components/WorkflowCard.tsx
import Link from 'next/link'
import { StatusBadge } from './StatusBadge'
import type { Workflow, WorkflowRun } from '@/types/workflows'

const TRIGGER_LABELS: Record<string, string> = {
  'schedule.cron': 'Cron',
  'postgres_changes': 'Realtime',
  'webhook': 'Webhook',
}

const TRIGGER_COLORS: Record<string, string> = {
  'schedule.cron': 'bg-sky-100 text-sky-700',
  'postgres_changes': 'bg-violet-100 text-violet-700',
  'webhook': 'bg-amber-100 text-amber-700',
}

interface WorkflowCardProps {
  workflow: Workflow
  lastRun?: WorkflowRun | null
}

export function WorkflowCard({ workflow, lastRun }: WorkflowCardProps) {
  return (
    <div
      className="rounded-2xl p-6 flex flex-col gap-4"
      style={{
        backgroundColor: 'rgba(255,255,255,0.60)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.80)',
        boxShadow: '0 10px 30px -10px rgba(0,102,133,0.05)',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h3 className="font-bold text-[#0b1c30] text-base">{workflow.name}</h3>
          <p className="text-sm text-[#6f787e] mt-1 line-clamp-2">{workflow.description}</p>
        </div>
        <StatusBadge isActive={workflow.is_active} lastRunStatus={lastRun?.status} />
      </div>

      {/* Meta */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${TRIGGER_COLORS[workflow.trigger_type] ?? 'bg-gray-100 text-gray-600'}`}>
          {TRIGGER_LABELS[workflow.trigger_type] ?? workflow.trigger_type}
        </span>
        {lastRun && (
          <span className="text-xs text-[#6f787e]">
            Dernière exécution : {new Date(lastRun.started_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            {' '}
            <span className={lastRun.status === 'completed' ? 'text-emerald-600' : lastRun.status === 'failed' ? 'text-red-600' : 'text-blue-600'}>
              ({lastRun.status})
            </span>
          </span>
        )}
        {!lastRun && <span className="text-xs text-[#6f787e]">Jamais exécuté</span>}
      </div>

      {/* Action */}
      <Link
        href={`/admin/workflows/${workflow.id}`}
        className="self-start px-5 py-2 bg-[#006685] text-white text-sm font-semibold rounded-full hover:bg-[#005070] transition-colors"
      >
        Configurer →
      </Link>
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add apps/web/app/admin/workflows/components/
git commit -m "feat(workflows): add StatusBadge and WorkflowCard components"
```

---

### Task 6: Workflows list page `/admin/workflows`

**Files:**
- Create: `apps/web/app/admin/workflows/page.tsx`

**Step 1: Create the page**

```typescript
// apps/web/app/admin/workflows/page.tsx
'use client'
import { useWorkflows, useWorkflowRuns } from './useWorkflows'
import { WorkflowCard } from './components/WorkflowCard'
import type { Workflow } from '@/types/workflows'

function WorkflowCardWithRun({ workflow }: { workflow: Workflow }) {
  const { data: runs } = useWorkflowRuns(workflow.id)
  return <WorkflowCard workflow={workflow} lastRun={runs?.[0] ?? null} />
}

export default function WorkflowsPage() {
  const { data: workflows, isLoading } = useWorkflows()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#0b1c30]">Workflows</h1>
        <p className="text-sm text-[#6f787e] mt-1">Automatisations santé — activer et configurer les templates</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl h-48 animate-pulse bg-white/40" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(workflows ?? []).map((wf) => (
            <WorkflowCardWithRun key={wf.id} workflow={wf} />
          ))}
        </div>
      )}

      {!isLoading && (workflows ?? []).length === 0 && (
        <div className="text-center py-20 text-[#6f787e]">
          <p className="text-lg font-medium">Aucun workflow disponible</p>
          <p className="text-sm mt-1">Vérifiez que la migration SQL a bien été appliquée.</p>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add apps/web/app/admin/workflows/page.tsx
git commit -m "feat(workflows): add workflows list page"
```

---

### Task 7: Custom React Flow nodes

**Files:**
- Create: `apps/web/app/admin/workflows/components/WorkflowCanvas.tsx`

**Step 1: Create the canvas component**

```typescript
// apps/web/app/admin/workflows/components/WorkflowCanvas.tsx
'use client'
import { ReactFlow, Handle, Position, type NodeProps } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { WorkflowNode, WorkflowEdge } from '@/types/workflows'

// ── Custom nodes ──────────────────────────────────────────────────────────────

function TriggerNode({ data }: NodeProps) {
  const d = data as { label: string; nodeType: string }
  return (
    <div
      className="px-4 py-3 rounded-xl border-2 border-sky-400 min-w-[140px] text-center"
      style={{ backgroundColor: 'rgba(224,242,254,0.9)', backdropFilter: 'blur(8px)' }}
    >
      <p className="text-xs font-bold text-sky-600 uppercase tracking-widest mb-1">Trigger</p>
      <p className="text-sm font-semibold text-sky-900">{d.label}</p>
      <p className="text-xs text-sky-600 mt-0.5">{d.nodeType}</p>
      <Handle type="source" position={Position.Right} className="!bg-sky-400" />
    </div>
  )
}

function ActionNode({ data }: NodeProps) {
  const d = data as { label: string; nodeType: string }
  return (
    <div
      className="px-4 py-3 rounded-xl border-2 border-slate-200 min-w-[140px] text-center"
      style={{ backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)' }}
    >
      <p className="text-xs font-bold text-[#006685] uppercase tracking-widest mb-1">Action</p>
      <p className="text-sm font-semibold text-[#0b1c30]">{d.label}</p>
      <p className="text-xs text-[#6f787e] mt-0.5">{d.nodeType}</p>
      <Handle type="target" position={Position.Left} className="!bg-slate-300" />
      <Handle type="source" position={Position.Right} className="!bg-slate-300" />
    </div>
  )
}

function EndNode({ data }: NodeProps) {
  const d = data as { label: string }
  return (
    <div
      className="px-4 py-3 rounded-xl border-2 border-emerald-400 min-w-[100px] text-center"
      style={{ backgroundColor: 'rgba(209,250,229,0.9)', backdropFilter: 'blur(8px)' }}
    >
      <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">End</p>
      <p className="text-sm font-semibold text-emerald-900">{d.label}</p>
      <Handle type="target" position={Position.Left} className="!bg-emerald-400" />
    </div>
  )
}

const nodeTypes = {
  triggerNode: TriggerNode,
  actionNode: ActionNode,
  endNode: EndNode,
}

// ── Canvas ────────────────────────────────────────────────────────────────────

interface WorkflowCanvasProps {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  isActive: boolean
}

export function WorkflowCanvas({ nodes, edges, isActive }: WorkflowCanvasProps) {
  const flowEdges = edges.map((e) => ({ ...e, animated: isActive }))

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        height: 320,
        backgroundColor: 'rgba(248,249,255,0.8)',
        border: '1px solid rgba(255,255,255,0.80)',
        boxShadow: '0 10px 30px -10px rgba(0,102,133,0.05)',
      }}
    >
      <ReactFlow
        nodes={nodes as never[]}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
      />
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add apps/web/app/admin/workflows/components/WorkflowCanvas.tsx
git commit -m "feat(workflows): add read-only React Flow canvas with custom nodes"
```

---

### Task 8: ConfigPanel component

**Files:**
- Create: `apps/web/app/admin/workflows/components/ConfigPanel.tsx`

**Step 1: Create the config panel**

```typescript
// apps/web/app/admin/workflows/components/ConfigPanel.tsx
'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useEffect } from 'react'
import type { Workflow, CronTriggerConfig, MoodTriggerConfig, PaymentTriggerConfig } from '@/types/workflows'

// ── Zod schemas ───────────────────────────────────────────────────────────────

const cronSchema = z.object({
  send_hour: z.number().int().min(0).max(23),
})

const moodSchema = z.object({
  mood_threshold: z.number().int().min(1).max(10),
  streak_days: z.number().int().min(1).max(14),
})

const paymentSchema = z.object({
  delay_hours: z.number().int().min(1).max(48),
  max_retries: z.number().int().min(1).max(10),
})

type CronForm = z.infer<typeof cronSchema>
type MoodForm = z.infer<typeof moodSchema>
type PaymentForm = z.infer<typeof paymentSchema>

// ── Input component ───────────────────────────────────────────────────────────

function FieldRow({
  label,
  children,
  error,
}: {
  label: string
  children: React.ReactNode
  error?: string
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-[#006685] uppercase tracking-widest">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

function NumberInput({ value, onChange, min, max }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full px-4 py-2.5 rounded-xl border border-slate-200/60 bg-white/60 text-sm text-[#0b1c30] outline-none focus:border-[#006685] transition-colors"
    />
  )
}

// ── Sub-forms per trigger type ────────────────────────────────────────────────

function CronConfigForm({
  config,
  onSave,
  isPending,
}: {
  config: CronTriggerConfig
  onSave: (data: CronTriggerConfig) => void
  isPending: boolean
}) {
  const { register, handleSubmit, formState: { errors }, reset } = useForm<CronForm>({
    resolver: zodResolver(cronSchema),
    defaultValues: { send_hour: config.send_hour },
  })
  useEffect(() => { reset({ send_hour: config.send_hour }) }, [config, reset])

  return (
    <form onSubmit={handleSubmit((d) => onSave({ ...config, send_hour: d.send_hour }))} className="space-y-5">
      <FieldRow label="Heure d'envoi (0–23h)" error={errors.send_hour?.message}>
        <input
          type="number"
          min={0}
          max={23}
          {...register('send_hour', { valueAsNumber: true })}
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200/60 bg-white/60 text-sm text-[#0b1c30] outline-none focus:border-[#006685] transition-colors"
        />
      </FieldRow>
      <button type="submit" disabled={isPending} className="w-full py-2.5 bg-[#006685] text-white text-sm font-semibold rounded-full hover:bg-[#005070] disabled:opacity-50 transition-colors">
        {isPending ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </form>
  )
}

function MoodConfigForm({
  config,
  onSave,
  isPending,
}: {
  config: MoodTriggerConfig
  onSave: (data: MoodTriggerConfig) => void
  isPending: boolean
}) {
  const { register, handleSubmit, formState: { errors }, reset } = useForm<MoodForm>({
    resolver: zodResolver(moodSchema),
    defaultValues: { mood_threshold: config.mood_threshold, streak_days: config.streak_days },
  })
  useEffect(() => { reset({ mood_threshold: config.mood_threshold, streak_days: config.streak_days }) }, [config, reset])

  return (
    <form onSubmit={handleSubmit((d) => onSave({ ...config, ...d }))} className="space-y-5">
      <FieldRow label="Seuil score mood (≤)" error={errors.mood_threshold?.message}>
        <input type="number" min={1} max={10} {...register('mood_threshold', { valueAsNumber: true })}
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200/60 bg-white/60 text-sm text-[#0b1c30] outline-none focus:border-[#006685] transition-colors" />
      </FieldRow>
      <FieldRow label="Streak (jours consécutifs)" error={errors.streak_days?.message}>
        <input type="number" min={1} max={14} {...register('streak_days', { valueAsNumber: true })}
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200/60 bg-white/60 text-sm text-[#0b1c30] outline-none focus:border-[#006685] transition-colors" />
      </FieldRow>
      <button type="submit" disabled={isPending} className="w-full py-2.5 bg-[#006685] text-white text-sm font-semibold rounded-full hover:bg-[#005070] disabled:opacity-50 transition-colors">
        {isPending ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </form>
  )
}

function PaymentConfigForm({
  config,
  onSave,
  isPending,
}: {
  config: PaymentTriggerConfig
  onSave: (data: PaymentTriggerConfig) => void
  isPending: boolean
}) {
  const { register, handleSubmit, formState: { errors }, reset } = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { delay_hours: config.delay_hours, max_retries: config.max_retries },
  })
  useEffect(() => { reset({ delay_hours: config.delay_hours, max_retries: config.max_retries }) }, [config, reset])

  return (
    <form onSubmit={handleSubmit((d) => onSave({ ...config, ...d }))} className="space-y-5">
      <FieldRow label="Délai avant retry (heures)" error={errors.delay_hours?.message}>
        <input type="number" min={1} max={48} {...register('delay_hours', { valueAsNumber: true })}
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200/60 bg-white/60 text-sm text-[#0b1c30] outline-none focus:border-[#006685] transition-colors" />
      </FieldRow>
      <FieldRow label="Max retries" error={errors.max_retries?.message}>
        <input type="number" min={1} max={10} {...register('max_retries', { valueAsNumber: true })}
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200/60 bg-white/60 text-sm text-[#0b1c30] outline-none focus:border-[#006685] transition-colors" />
      </FieldRow>
      <button type="submit" disabled={isPending} className="w-full py-2.5 bg-[#006685] text-white text-sm font-semibold rounded-full hover:bg-[#005070] disabled:opacity-50 transition-colors">
        {isPending ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </form>
  )
}

// ── Main ConfigPanel ──────────────────────────────────────────────────────────

interface ConfigPanelProps {
  workflow: Workflow
  onSaveConfig: (config: Workflow['trigger_config']) => void
  onToggleActive: () => void
  isPending: boolean
}

export function ConfigPanel({ workflow, onSaveConfig, onToggleActive, isPending }: ConfigPanelProps) {
  return (
    <div
      className="rounded-2xl p-6 flex flex-col gap-6 h-full"
      style={{
        backgroundColor: 'rgba(255,255,255,0.60)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.80)',
        boxShadow: '0 10px 30px -10px rgba(0,102,133,0.05)',
      }}
    >
      <div>
        <h2 className="text-xs font-bold text-[#006685] uppercase tracking-widest mb-1">Configuration</h2>
        <p className="text-sm text-[#6f787e]">{workflow.name}</p>
      </div>

      {/* Form by trigger type */}
      {workflow.trigger_type === 'schedule.cron' && (
        <CronConfigForm
          config={workflow.trigger_config as CronTriggerConfig}
          onSave={onSaveConfig}
          isPending={isPending}
        />
      )}
      {workflow.trigger_type === 'postgres_changes' && (workflow.trigger_config as MoodTriggerConfig).mood_threshold !== undefined && (
        <MoodConfigForm
          config={workflow.trigger_config as MoodTriggerConfig}
          onSave={onSaveConfig}
          isPending={isPending}
        />
      )}
      {workflow.trigger_type === 'postgres_changes' && (workflow.trigger_config as PaymentTriggerConfig).max_retries !== undefined && (
        <PaymentConfigForm
          config={workflow.trigger_config as PaymentTriggerConfig}
          onSave={onSaveConfig}
          isPending={isPending}
        />
      )}

      {/* Toggle active */}
      <div className="mt-auto pt-4 border-t border-slate-100/60">
        <button
          onClick={onToggleActive}
          disabled={isPending}
          className={`w-full py-3 rounded-full text-sm font-bold transition-colors disabled:opacity-50 ${
            workflow.is_active
              ? 'bg-red-100 text-red-700 hover:bg-red-200'
              : 'bg-emerald-500 text-white hover:bg-emerald-600'
          }`}
        >
          {workflow.is_active ? 'Désactiver le workflow' : 'Activer le workflow'}
        </button>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add apps/web/app/admin/workflows/components/ConfigPanel.tsx
git commit -m "feat(workflows): add ConfigPanel with React Hook Form + Zod per trigger type"
```

---

### Task 9: Workflow runs history component

**Files:**
- Create: `apps/web/app/admin/workflows/components/RunsHistory.tsx`

**Step 1: Create the history component**

```typescript
// apps/web/app/admin/workflows/components/RunsHistory.tsx
'use client'
import { useState } from 'react'
import { useWorkflowLogs } from '../useWorkflows'
import type { WorkflowRun, WorkflowLog, NodeLogStatus } from '@/types/workflows'

const LOG_STATUS_COLORS: Record<NodeLogStatus, string> = {
  pending: 'bg-slate-100 text-slate-500',
  running: 'bg-blue-100 text-blue-700',
  success: 'bg-emerald-100 text-emerald-700',
  error: 'bg-red-100 text-red-700',
  skipped: 'bg-gray-100 text-gray-500',
}

function RunLogs({ runId }: { runId: string }) {
  const { data: logs, isLoading } = useWorkflowLogs(runId)

  if (isLoading) {
    return <div className="pl-6 py-3 text-xs text-[#6f787e] animate-pulse">Chargement des logs…</div>
  }

  return (
    <div className="pl-6 py-3 border-l-2 border-slate-100 ml-6 space-y-2">
      {(logs ?? []).map((log: WorkflowLog) => (
        <div key={log.id} className="flex items-center gap-3">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${LOG_STATUS_COLORS[log.status]}`}>
            {log.status}
          </span>
          <span className="text-xs font-medium text-[#0b1c30]">{log.node_type}</span>
          {log.duration_ms && (
            <span className="text-xs text-[#6f787e]">{log.duration_ms}ms</span>
          )}
          {log.status === 'error' && log.error_details && (
            <span className="text-xs text-red-500 truncate max-w-xs">
              {String((log.error_details as Record<string, unknown>).message ?? 'Erreur')}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

interface RunsHistoryProps {
  runs: WorkflowRun[]
}

export function RunsHistory({ runs }: RunsHistoryProps) {
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null)

  const RUN_STATUS_COLORS: Record<string, string> = {
    running: 'bg-blue-100 text-blue-700',
    completed: 'bg-emerald-100 text-emerald-700',
    failed: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-500',
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        backgroundColor: 'rgba(255,255,255,0.60)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.80)',
        boxShadow: '0 10px 30px -10px rgba(0,102,133,0.05)',
      }}
    >
      <div className="px-6 py-4 border-b border-slate-100/60">
        <h3 className="text-xs font-bold text-[#006685] uppercase tracking-widest">Historique des exécutions</h3>
      </div>

      {runs.length === 0 ? (
        <div className="px-6 py-8 text-center text-sm text-[#6f787e]">Aucune exécution enregistrée</div>
      ) : (
        <div className="divide-y divide-slate-50/60">
          {runs.map((run) => (
            <div key={run.id}>
              <button
                onClick={() => setExpandedRunId(expandedRunId === run.id ? null : run.id)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/30 transition-colors text-left"
              >
                <div className="flex items-center gap-4">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${RUN_STATUS_COLORS[run.status] ?? 'bg-gray-100'}`}>
                    {run.status}
                  </span>
                  <span className="text-sm text-[#0b1c30]">
                    {new Date(run.started_at).toLocaleDateString('fr-FR', {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                  {run.ended_at && (
                    <span className="text-xs text-[#6f787e]">
                      {Math.round((new Date(run.ended_at).getTime() - new Date(run.started_at).getTime()) / 1000)}s
                    </span>
                  )}
                </div>
                <span className="text-[#6f787e] text-sm">{expandedRunId === run.id ? '▲' : '▼'}</span>
              </button>
              {expandedRunId === run.id && <RunLogs runId={run.id} />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add apps/web/app/admin/workflows/components/RunsHistory.tsx
git commit -m "feat(workflows): add RunsHistory component with expandable node logs"
```

---

### Task 10: Workflow detail page `/admin/workflows/[id]`

**Files:**
- Create: `apps/web/app/admin/workflows/[id]/page.tsx`

**Step 1: Create the detail page**

```typescript
// apps/web/app/admin/workflows/[id]/page.tsx
'use client'
import { use } from 'react'
import Link from 'next/link'
import { useWorkflow, useWorkflowRuns, useUpdateWorkflow } from '../useWorkflows'
import { WorkflowCanvas } from '../components/WorkflowCanvas'
import { ConfigPanel } from '../components/ConfigPanel'
import { RunsHistory } from '../components/RunsHistory'
import { StatusBadge } from '../components/StatusBadge'
import type { TriggerConfig } from '@/types/workflows'

export default function WorkflowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: workflow, isLoading } = useWorkflow(id)
  const { data: runs } = useWorkflowRuns(id)
  const updateWorkflow = useUpdateWorkflow()

  const handleSaveConfig = (trigger_config: TriggerConfig) => {
    updateWorkflow.mutate({ id, trigger_config })
  }

  const handleToggleActive = () => {
    if (!workflow) return
    updateWorkflow.mutate({ id, is_active: !workflow.is_active })
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-white/40 rounded animate-pulse" />
        <div className="h-80 bg-white/40 rounded-2xl animate-pulse" />
      </div>
    )
  }

  if (!workflow) {
    return (
      <div className="text-center py-20">
        <p className="text-[#6f787e]">Workflow introuvable.</p>
        <Link href="/admin/workflows" className="text-[#006685] text-sm mt-2 inline-block">← Retour</Link>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin/workflows" className="text-[#6f787e] hover:text-[#0b1c30] transition-colors text-sm">
            ← Workflows
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[#0b1c30]">{workflow.name}</h1>
            <p className="text-sm text-[#6f787e] mt-0.5">{workflow.description}</p>
          </div>
        </div>
        <StatusBadge isActive={workflow.is_active} lastRunStatus={runs?.[0]?.status} />
      </div>

      {/* Canvas + Config — 2 columns */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Canvas — 60% */}
        <div className="xl:col-span-3 space-y-3">
          <p className="text-xs font-bold text-[#006685] uppercase tracking-widest">Flux d'exécution</p>
          <WorkflowCanvas
            nodes={workflow.nodes}
            edges={workflow.edges}
            isActive={workflow.is_active}
          />
        </div>

        {/* Config Panel — 40% */}
        <div className="xl:col-span-2">
          <ConfigPanel
            workflow={workflow}
            onSaveConfig={handleSaveConfig}
            onToggleActive={handleToggleActive}
            isPending={updateWorkflow.isPending}
          />
        </div>
      </div>

      {/* Runs history */}
      <RunsHistory runs={runs ?? []} />
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add apps/web/app/admin/workflows/[id]/page.tsx
git commit -m "feat(workflows): add workflow detail page with canvas, config panel and runs history"
```

---

### Task 11: Edge Function `run-workflow`

**Files:**
- Create: `supabase/functions/run-workflow/index.ts`

**Step 1: Create the Edge Function**

```typescript
// supabase/functions/run-workflow/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WorkflowNodeDef {
  id: string
  type: string
  data: { nodeType: string; template?: string }
}

interface RunContext {
  supabase: ReturnType<typeof createClient>
  triggerData: Record<string, unknown>
  workflowConfig: Record<string, unknown>
}

// ── Node handlers ─────────────────────────────────────────────────────────────

async function handleQueryUpcomingAppointments(ctx: RunContext): Promise<Record<string, unknown>> {
  const now = new Date()
  const from = new Date(now.getTime() + 23 * 3600 * 1000).toISOString()
  const to = new Date(now.getTime() + 25 * 3600 * 1000).toISOString()

  const { data: appointments } = await ctx.supabase
    .from('appointments')
    .select('id, patient_id, practitioner_id, scheduled_at')
    .eq('status', 'confirmed')
    .gte('scheduled_at', from)
    .lte('scheduled_at', to)

  return { appointments: appointments ?? [], count: (appointments ?? []).length }
}

async function handleSendPush(
  ctx: RunContext,
  template: string,
  inputData: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const appointments = (inputData.appointments as { patient_id: string }[] | undefined) ?? []
  const sent: string[] = []

  for (const apt of appointments) {
    const { data: user } = await ctx.supabase
      .from('users')
      .select('push_token, full_name')
      .eq('id', apt.patient_id)
      .single()

    if (!user?.push_token) continue

    const messages: Record<string, string> = {
      appointment_reminder: 'Rappel : vous avez un rendez-vous demain.',
      wellness_check: 'Comment allez-vous ? Prenez soin de vous.',
      payment_retry: 'Votre paiement a échoué. Nous réessayons.',
    }

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: user.push_token,
        title: 'M-Santé',
        body: messages[template] ?? 'Notification M-Santé',
        data: { template },
      }),
    })
    sent.push(apt.patient_id)
  }

  return { sent_count: sent.length }
}

async function handleSendSms(_ctx: RunContext): Promise<Record<string, unknown>> {
  // SMS provider not configured in V1 — log only
  return { status: 'sms_skipped_v1' }
}

async function handleCheckMoodStreak(
  ctx: RunContext,
  inputData: Record<string, unknown>
): Promise<{ should_continue: boolean }> {
  const patientId = (ctx.triggerData.record as Record<string, unknown> | undefined)?.patient_id as string | undefined
  if (!patientId) return { should_continue: false }

  const threshold = (ctx.workflowConfig.mood_threshold as number | undefined) ?? 4
  const streakDays = (ctx.workflowConfig.streak_days as number | undefined) ?? 3

  const { data: entries } = await ctx.supabase
    .from('mood_entries')
    .select('score, entry_date')
    .eq('patient_id', patientId)
    .lte('score', threshold)
    .order('entry_date', { ascending: false })
    .limit(streakDays)

  const hasStreak = (entries ?? []).length >= streakDays
  // Pass patient info downstream
  if (hasStreak) {
    (inputData as Record<string, unknown>).appointments = [{ patient_id: patientId }]
  }
  return { should_continue: hasStreak }
}

async function handleCheckRetryCount(
  ctx: RunContext,
  inputData: Record<string, unknown>
): Promise<{ should_continue: boolean }> {
  const paymentId = (ctx.triggerData.record as Record<string, unknown> | undefined)?.id as string | undefined
  if (!paymentId) return { should_continue: false }

  const maxRetries = (ctx.workflowConfig.max_retries as number | undefined) ?? 3

  const { data: payment } = await ctx.supabase
    .from('payments')
    .select('retry_count, patient_id')
    .eq('id', paymentId)
    .single()

  if (!payment || payment.retry_count >= maxRetries) return { should_continue: false }
  ;(inputData as Record<string, unknown>).appointments = [{ patient_id: payment.patient_id }]
  ;(inputData as Record<string, unknown>).payment_id = paymentId
  return { should_continue: true }
}

async function handleRetryPayment(
  ctx: RunContext,
  inputData: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const paymentId = inputData.payment_id as string | undefined
  if (!paymentId) return { skipped: true }

  await ctx.supabase
    .from('payments')
    .update({ retry_count: ctx.supabase.rpc as unknown, status: 'processing', updated_at: new Date().toISOString() })
    .eq('id', paymentId)

  // Simpler: increment via raw update
  const { data: payment } = await ctx.supabase.from('payments').select('retry_count').eq('id', paymentId).single()
  await ctx.supabase.from('payments')
    .update({ retry_count: ((payment?.retry_count as number) ?? 0) + 1, status: 'processing', updated_at: new Date().toISOString() })
    .eq('id', paymentId)

  return { retried: true, payment_id: paymentId }
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json() as { trigger_type?: string; workflow_id?: string; trigger_data?: Record<string, unknown> }
    const { trigger_type, workflow_id, trigger_data = {} } = body

    // Load active workflows matching this trigger type
    let query = supabase.from('workflows').select('*').eq('is_active', true)
    if (trigger_type) query = query.eq('trigger_type', trigger_type)
    if (workflow_id) query = query.eq('id', workflow_id)

    const { data: workflows } = await query
    if (!workflows || workflows.length === 0) {
      return new Response(JSON.stringify({ ok: true, ran: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let ran = 0

    for (const workflow of workflows) {
      // For cron: check if current hour matches send_hour
      if (workflow.trigger_type === 'schedule.cron') {
        const sendHour = (workflow.trigger_config as Record<string, unknown>).send_hour as number | undefined
        const currentHour = new Date().getUTCHours()
        if (sendHour !== undefined && currentHour !== sendHour) continue
      }

      // For postgres_changes: check status_filter
      if (workflow.trigger_type === 'postgres_changes') {
        const statusFilter = (workflow.trigger_config as Record<string, unknown>).status_filter as string | undefined
        if (statusFilter) {
          const recordStatus = (trigger_data.record as Record<string, unknown> | undefined)?.status
          if (recordStatus !== statusFilter) continue
        }
      }

      // Create run
      const { data: run } = await supabase.from('workflow_runs').insert({
        workflow_id: workflow.id,
        trigger_data,
        status: 'running',
      }).select().single()

      if (!run) continue

      const ctx: RunContext = {
        supabase,
        triggerData: trigger_data,
        workflowConfig: workflow.trigger_config as Record<string, unknown>,
      }

      let runFailed = false
      let prevOutput: Record<string, unknown> = {}

      for (const node of (workflow.nodes as WorkflowNodeDef[])) {
        if (node.type === 'triggerNode' || node.type === 'endNode') continue

        const { data: log } = await supabase.from('workflow_logs').insert({
          run_id: run.id,
          node_id: node.id,
          node_type: node.data.nodeType,
          status: 'running',
          input_data: prevOutput,
        }).select().single()

        const startMs = Date.now()
        let status: string = 'success'
        let output: Record<string, unknown> = {}
        let errorDetails: Record<string, unknown> | null = null

        try {
          switch (node.data.nodeType) {
            case 'query_upcoming_appointments':
              output = await handleQueryUpcomingAppointments(ctx)
              break
            case 'send_push':
              output = await handleSendPush(ctx, node.data.template ?? '', prevOutput)
              break
            case 'send_sms':
              output = await handleSendSms(ctx)
              break
            case 'check_mood_streak': {
              const result = await handleCheckMoodStreak(ctx, prevOutput)
              output = result
              if (!result.should_continue) status = 'skipped'
              break
            }
            case 'check_retry_count': {
              const result = await handleCheckRetryCount(ctx, prevOutput)
              output = result
              if (!result.should_continue) status = 'skipped'
              break
            }
            case 'retry_payment':
              output = await handleRetryPayment(ctx, prevOutput)
              break
            default:
              output = { skipped: true, reason: 'unknown_node_type' }
          }
        } catch (e) {
          status = 'error'
          errorDetails = { message: (e as Error).message }
          runFailed = true
        }

        await supabase.from('workflow_logs').update({
          status,
          output_data: output,
          error_details: errorDetails,
          duration_ms: Date.now() - startMs,
        }).eq('id', log?.id)

        if (status === 'error') break
        prevOutput = { ...prevOutput, ...output }
      }

      await supabase.from('workflow_runs').update({
        status: runFailed ? 'failed' : 'completed',
        ended_at: new Date().toISOString(),
      }).eq('id', run.id)

      ran++
    }

    return new Response(JSON.stringify({ ok: true, ran }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
```

**Step 2: Commit**

```bash
git add supabase/functions/run-workflow/index.ts
git commit -m "feat(workflows): add run-workflow Edge Function orchestrator"
```

---

### Task 12: pg_cron setup migration

**Files:**
- Create: `supabase/migrations/20260503000004_workflow_cron.sql`

**Step 1: Create the migration**

```sql
-- supabase/migrations/20260503000004_workflow_cron.sql
-- Schedule the run-workflow Edge Function every minute for cron-based workflows.
-- Replace <YOUR_SUPABASE_PROJECT_REF> with your actual project ref.
-- This requires pg_cron + pg_net extensions to be enabled on your Supabase project.

-- Enable extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove existing job if present (idempotent re-run)
SELECT cron.unschedule('run-cron-workflows') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'run-cron-workflows'
);

-- Schedule: every minute, call run-workflow for schedule.cron workflows
SELECT cron.schedule(
  'run-cron-workflows',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') || '/functions/v1/run-workflow',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{"trigger_type": "schedule.cron"}'::jsonb
  )
  $$
);
```

**Step 2: Commit**

```bash
git add supabase/migrations/20260503000004_workflow_cron.sql
git commit -m "feat(workflows): add pg_cron schedule for run-workflow Edge Function"
```

---

### Task 13: Final typecheck

**Step 1: Run typecheck**

```bash
cd "c:/Users/Khodiaou/Desktop/m-santé app"
npx tsc --project apps/web/tsconfig.json --noEmit 2>&1 | grep -v node_modules | grep "error TS" | head -30
```

Expected: no errors.

**Step 2: Fix any errors and commit**

```bash
git add -A apps/web/
git commit -m "fix(workflows): typecheck fixes"
```
