'use client'
import { useRouter } from 'next/navigation'
import type { Workflow, TriggerType, TriggerConfig } from '@/types/workflows'
import { useCreateWorkflow } from '../useWorkflows'

interface PresetTemplate {
  id: string
  name: string
  description: string
  icon: string
  iconColor: string
  badgeColor: string
  badgeText: string
  trigger_type: TriggerType
  trigger_config: TriggerConfig
  nodes: Workflow['nodes']
  edges: Workflow['edges']
}

const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    id: 'appointment-reminder',
    name: 'Rappel RDV 24h avant',
    description: 'Envoie un push à chaque patient et praticien 24h avant leur consultation.',
    icon: 'event_available',
    iconColor: '#006685',
    badgeColor: '#e5eeff',
    badgeText: 'Cron quotidien',
    trigger_type: 'schedule.cron',
    trigger_config: { cron: '0 9 * * *', send_hour: 9 },
    nodes: [
      { id: 'trigger', type: 'triggerNode', position: { x: 80, y: 160 }, data: { label: 'Cron 09h00', nodeType: 'schedule.cron' } },
      { id: 'action1', type: 'actionNode', position: { x: 300, y: 160 }, data: { label: 'Push rappel RDV', nodeType: 'send_push', config: { template: 'appointment_reminder' } } },
      { id: 'end', type: 'endNode', position: { x: 520, y: 160 }, data: { label: 'Terminé', nodeType: 'end' } },
    ],
    edges: [
      { id: 'e1', source: 'trigger', target: 'action1' },
      { id: 'e2', source: 'action1', target: 'end' },
    ],
  },
  {
    id: 'mood-alert',
    name: 'Alerte bien-être patient',
    description: 'Notifie le patient et recommande un RDV quand son humeur est basse 3 jours de suite.',
    icon: 'favorite',
    iconColor: '#be185d',
    badgeColor: '#fce7f3',
    badgeText: 'Temps réel',
    trigger_type: 'postgres_changes',
    trigger_config: { table: 'mood_entries', event: 'INSERT', mood_threshold: 4, streak_days: 3 },
    nodes: [
      { id: 'trigger', type: 'triggerNode', position: { x: 80, y: 160 }, data: { label: 'Mood bas 3j', nodeType: 'postgres_changes' } },
      { id: 'action1', type: 'actionNode', position: { x: 300, y: 100 }, data: { label: 'Push bien-être', nodeType: 'send_push', config: { template: 'mood_low_streak' } } },
      { id: 'action2', type: 'actionNode', position: { x: 300, y: 220 }, data: { label: 'Recommander RDV', nodeType: 'recommend_appointment' } },
      { id: 'end', type: 'endNode', position: { x: 520, y: 160 }, data: { label: 'Terminé', nodeType: 'end' } },
    ],
    edges: [
      { id: 'e1', source: 'trigger', target: 'action1' },
      { id: 'e2', source: 'trigger', target: 'action2' },
      { id: 'e3', source: 'action1', target: 'end' },
      { id: 'e4', source: 'action2', target: 'end' },
    ],
  },
  {
    id: 'payment-retry',
    name: 'Récupération paiement échoué',
    description: 'Attend 2h puis notifie le patient de réessayer son paiement (max 3 tentatives).',
    icon: 'payments',
    iconColor: '#92400e',
    badgeColor: '#fef3c7',
    badgeText: 'Événement DB',
    trigger_type: 'postgres_changes',
    trigger_config: { table: 'payments', event: 'UPDATE', status_filter: 'failed', delay_hours: 2, max_retries: 3 },
    nodes: [
      { id: 'trigger', type: 'triggerNode', position: { x: 80, y: 160 }, data: { label: 'Paiement échoué', nodeType: 'postgres_changes' } },
      { id: 'action1', type: 'actionNode', position: { x: 300, y: 160 }, data: { label: 'Délai 2h', nodeType: 'delay', config: { duration: '2h' } } },
      { id: 'action2', type: 'actionNode', position: { x: 480, y: 160 }, data: { label: 'Push retry', nodeType: 'send_push', config: { template: 'payment_failed' } } },
      { id: 'end', type: 'endNode', position: { x: 660, y: 160 }, data: { label: 'Terminé', nodeType: 'end' } },
    ],
    edges: [
      { id: 'e1', source: 'trigger', target: 'action1' },
      { id: 'e2', source: 'action1', target: 'action2' },
      { id: 'e3', source: 'action2', target: 'end' },
    ],
  },
]

interface Props {
  installedWorkflows: Workflow[]
}

export function WorkflowTemplatesSection({ installedWorkflows }: Props) {
  const router = useRouter()
  const createWorkflow = useCreateWorkflow()

  const handleActivate = (tpl: PresetTemplate) => {
    createWorkflow.mutate(
      {
        name: tpl.name,
        description: tpl.description,
        trigger_type: tpl.trigger_type,
        trigger_config: tpl.trigger_config,
        nodes: tpl.nodes,
        edges: tpl.edges,
        is_active: true,
      },
      {
        onSuccess: ({ id }) => router.push(`/admin/workflows/${id}`),
      }
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <span className="material-symbols-outlined text-[#006685]" style={{ fontSize: 20 }}>auto_awesome</span>
        <h2 className="text-base font-bold text-[#0b1c30]">Templates prêts à l&apos;emploi</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PRESET_TEMPLATES.map((tpl) => {
          const installed = installedWorkflows.find(
            (w) => w.name === tpl.name
          )

          return (
            <div
              key={tpl.id}
              className="rounded-2xl p-5 flex flex-col gap-3"
              style={{
                backgroundColor: 'rgba(255,255,255,0.70)',
                border: '1px solid rgba(255,255,255,0.80)',
                backdropFilter: 'blur(16px)',
                boxShadow: '0 4px 16px rgba(0,102,133,0.06)',
              }}
            >
              {/* Header */}
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: tpl.badgeColor }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 20, color: tpl.iconColor }}>
                    {tpl.icon}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#0b1c30] leading-tight">{tpl.name}</p>
                  <span
                    className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{ backgroundColor: tpl.badgeColor, color: tpl.iconColor }}
                  >
                    {tpl.badgeText}
                  </span>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-[#6f787e] leading-relaxed">{tpl.description}</p>

              {/* Node flow preview */}
              <div className="flex items-center gap-1 overflow-hidden">
                {tpl.nodes.slice(0, 4).map((node, idx) => (
                  <div key={node.id} className="flex items-center gap-1 min-w-0">
                    {idx > 0 && (
                      <span className="text-[#bec8ce] text-xs flex-shrink-0">→</span>
                    )}
                    <span
                      className="px-1.5 py-0.5 rounded text-xs font-medium truncate"
                      style={{
                        backgroundColor:
                          node.type === 'triggerNode' ? '#e5eeff' :
                          node.type === 'endNode' ? '#f0fdf4' : '#f8f9ff',
                        color:
                          node.type === 'triggerNode' ? '#006685' :
                          node.type === 'endNode' ? '#166534' : '#0b1c30',
                        border: '1px solid',
                        borderColor:
                          node.type === 'triggerNode' ? '#c7d9ff' :
                          node.type === 'endNode' ? '#bbf7d0' : '#e2e8f0',
                      }}
                    >
                      {node.data.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Action */}
              {installed ? (
                <div className="flex items-center gap-2 mt-auto">
                  <span
                    className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full"
                    style={{
                      backgroundColor: installed.is_active ? '#dcfce7' : '#f1f5f9',
                      color: installed.is_active ? '#166534' : '#64748b',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
                      {installed.is_active ? 'check_circle' : 'pause_circle'}
                    </span>
                    {installed.is_active ? 'Actif' : 'Inactif'}
                  </span>
                  <button
                    onClick={() => router.push(`/admin/workflows/${installed.id}`)}
                    className="ml-auto text-xs font-bold text-[#006685] hover:underline"
                  >
                    Configurer →
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleActivate(tpl)}
                  disabled={createWorkflow.isPending}
                  className="mt-auto w-full py-2 rounded-full text-xs font-bold text-white transition-all hover:shadow-md disabled:opacity-50"
                  style={{ backgroundColor: '#006685' }}
                >
                  {createWorkflow.isPending ? 'Installation…' : '⚡ Installer et activer'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
