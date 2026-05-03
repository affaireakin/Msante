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
