'use client'
import { useState } from 'react'
import { useWorkflows, useWorkflowRuns } from './useWorkflows'
import { WorkflowCard } from './components/WorkflowCard'
import { CreateWorkflowModal } from './components/CreateWorkflowModal'
import { WorkflowTemplatesSection } from './components/WorkflowTemplatesSection'
import type { Workflow } from '@/types/workflows'

function WorkflowCardWithRun({ workflow }: { workflow: Workflow }) {
  const { data: runs } = useWorkflowRuns(workflow.id)
  return <WorkflowCard workflow={workflow} lastRun={runs?.[0] ?? null} />
}

export default function WorkflowsPage() {
  const { data: workflows, isLoading } = useWorkflows()
  const [showCreate, setShowCreate] = useState(false)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1c30]">Workflows</h1>
          <p className="text-sm text-[#6f787e] mt-1">Automatisations santé — activer et configurer les templates</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-full transition-colors"
          style={{ backgroundColor: '#006685', boxShadow: '0 4px 14px rgba(0,102,133,0.25)' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
          Créer un workflow
        </button>
      </div>

      {/* Pre-configured templates */}
      <WorkflowTemplatesSection installedWorkflows={workflows ?? []} />

      {/* Divider */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-[#6f787e]" style={{ fontSize: 18 }}>account_tree</span>
          <h2 className="text-base font-bold text-[#0b1c30]">Mes workflows</h2>
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
          <div className="text-center py-12 text-[#6f787e]">
            <span className="material-symbols-outlined" style={{ fontSize: 40, opacity: 0.3, display: 'block', marginBottom: 10 }}>account_tree</span>
            <p className="text-base font-medium">Aucun workflow personnalisé</p>
            <p className="text-sm mt-1">Activez un template ci-dessus ou créez le vôtre.</p>
          </div>
        )}
      </div>

      {showCreate && <CreateWorkflowModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
