'use client'
import { use, useState } from 'react'
import Link from 'next/link'
import { useWorkflow, useWorkflowRuns, useUpdateWorkflow, useRunWorkflow } from '../useWorkflows'
import { WorkflowCanvas } from '../components/WorkflowCanvas'
import { WorkflowEditor } from '../components/WorkflowEditor'
import { ConfigPanel } from '../components/ConfigPanel'
import { RunsHistory } from '../components/RunsHistory'
import { StatusBadge } from '../components/StatusBadge'
import type { TriggerConfig, WorkflowNode, WorkflowEdge } from '@/types/workflows'

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span className="material-symbols-outlined" style={{ fontSize: '18px', ...style }}>{name}</span>
}

export default function WorkflowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: workflow, isLoading } = useWorkflow(id)
  const { data: runs } = useWorkflowRuns(id)
  const updateWorkflow = useUpdateWorkflow()
  const runWorkflow = useRunWorkflow()
  const [runResult, setRunResult] = useState<{ ran: number } | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  const handleSaveConfig = (trigger_config: TriggerConfig) => {
    updateWorkflow.mutate({ id, trigger_config })
  }

  const handleToggleActive = () => {
    if (!workflow) return
    updateWorkflow.mutate({ id, is_active: !workflow.is_active })
  }

  const handleRunNow = () => {
    setRunResult(null)
    runWorkflow.mutate(
      { workflowId: id, force: true },
      { onSuccess: (data) => setRunResult(data) }
    )
  }

  const handleSaveCanvas = (nodes: WorkflowNode[], edges: WorkflowEdge[]) => {
    updateWorkflow.mutate(
      { id, nodes, edges },
      { onSuccess: () => setIsEditing(false) }
    )
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
        <Link href="/admin/workflows" className="text-[#82d8ff] text-sm mt-2 inline-block">← Retour</Link>
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
        <div className="flex items-center gap-3">
          <StatusBadge isActive={workflow.is_active} lastRunStatus={runs?.[0]?.status} />
          {!isEditing && (
            <button
              onClick={handleRunNow}
              disabled={runWorkflow.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-white transition-all disabled:opacity-50"
              style={{ backgroundColor: '#82d8ff', boxShadow: runWorkflow.isPending ? 'none' : '0 4px 12px rgba(0,102,133,0.25)' }}
            >
              <Icon name={runWorkflow.isPending ? 'progress_activity' : 'play_arrow'} style={{ color: '#fff', fontSize: '18px' }} />
              {runWorkflow.isPending ? 'En cours…' : 'Déclencher'}
            </button>
          )}
        </div>
      </div>

      {/* Run result banner */}
      {runResult !== null && (
        <div className={`flex items-center gap-3 px-5 py-3 rounded-xl text-sm font-semibold ${runResult.ran > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
          <Icon name={runResult.ran > 0 ? 'check_circle' : 'info'} style={{ fontSize: '18px', color: runResult.ran > 0 ? '#1d7a3a' : '#b45309' }} />
          {runResult.ran > 0
            ? `Workflow déclenché avec succès — ${runResult.ran} exécution(s) lancée(s).`
            : 'Aucune exécution lancée (workflow inactif ou conditions non remplies).'}
          <button onClick={() => setRunResult(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Canvas section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-[#82d8ff] uppercase tracking-widest">Flux d&apos;exécution</p>
          <button
            onClick={() => setIsEditing((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors"
            style={isEditing
              ? { borderColor: '#cbd5e1', color: '#6f787e', backgroundColor: 'rgba(255,255,255,0.6)' }
              : { borderColor: '#82d8ff', color: '#82d8ff', backgroundColor: 'rgba(0,102,133,0.04)' }
            }
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
              {isEditing ? 'close' : 'edit'}
            </span>
            {isEditing ? 'Annuler' : 'Modifier le flux'}
          </button>
        </div>

        {isEditing ? (
          <WorkflowEditor
            initialNodes={workflow.nodes}
            initialEdges={workflow.edges}
            onSave={handleSaveCanvas}
            isSaving={updateWorkflow.isPending}
          />
        ) : (
          <WorkflowCanvas
            nodes={workflow.nodes}
            edges={workflow.edges}
            isActive={workflow.is_active}
          />
        )}
      </div>

      {/* Config Panel (only in view mode) */}
      {!isEditing && (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          <div className="xl:col-span-2 xl:col-start-4">
            <ConfigPanel
              workflow={workflow}
              onSaveConfig={handleSaveConfig}
              onToggleActive={handleToggleActive}
              isPending={updateWorkflow.isPending}
            />
          </div>
        </div>
      )}

      {/* Runs history */}
      {!isEditing && <RunsHistory runs={runs ?? []} />}
    </div>
  )
}
