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
          <p className="text-xs font-bold text-[#006685] uppercase tracking-widest">Flux d&apos;exécution</p>
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
