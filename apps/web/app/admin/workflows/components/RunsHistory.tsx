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

const RUN_STATUS_COLORS: Record<string, string> = {
  running: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
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
          {log.duration_ms !== null && (
            <span className="text-xs text-[#6f787e]">{log.duration_ms}ms</span>
          )}
          {log.status === 'error' && log.error_details && (
            <span className="text-xs text-red-500 truncate max-w-xs">
              {String((log.error_details as Record<string, unknown>).message ?? 'Erreur')}
            </span>
          )}
        </div>
      ))}
      {(logs ?? []).length === 0 && (
        <p className="text-xs text-[#6f787e]">Aucun log disponible</p>
      )}
    </div>
  )
}

interface RunsHistoryProps {
  runs: WorkflowRun[]
}

export function RunsHistory({ runs }: RunsHistoryProps) {
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null)

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
        <h3 className="text-xs font-bold text-[#82d8ff] uppercase tracking-widest">Historique des exécutions</h3>
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
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
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
