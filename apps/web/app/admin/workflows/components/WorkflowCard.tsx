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
            Dernière exécution :{' '}
            {new Date(lastRun.started_at).toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })}
            {' '}
            <span className={
              lastRun.status === 'completed' ? 'text-emerald-600' :
              lastRun.status === 'failed' ? 'text-red-600' :
              'text-blue-600'
            }>
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
