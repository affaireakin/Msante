'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCreateWorkflow } from '../useWorkflows'
import type { TriggerType, WorkflowNode, WorkflowEdge } from '@/types/workflows'

interface TemplateOption {
  triggerType: TriggerType
  label: string
  description: string
  icon: string
  color: string
  defaultName: string
  defaultDescription: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  triggerConfig: any
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

const TEMPLATES: TemplateOption[] = [
  {
    triggerType: 'schedule.cron',
    label: 'Planifié (Cron)',
    description: 'Rappels RDV, check-ins bien-être quotidiens',
    icon: 'schedule',
    color: 'sky',
    defaultName: 'Rappel rendez-vous 24h',
    defaultDescription: 'Envoie un rappel push 24h avant chaque rendez-vous',
    triggerConfig: { cron: '0 9 * * *', send_hour: 9 },
    nodes: [
      { id: 'trigger', type: 'triggerNode', position: { x: 80, y: 160 }, data: { label: 'Cron 09h00', nodeType: 'schedule.cron' } },
      { id: 'action1', type: 'actionNode', position: { x: 300, y: 160 }, data: { label: 'Envoyer push', nodeType: 'send_push' } },
      { id: 'end', type: 'endNode', position: { x: 520, y: 160 }, data: { label: 'Terminé', nodeType: 'end' } },
    ],
    edges: [
      { id: 'e1', source: 'trigger', target: 'action1' },
      { id: 'e2', source: 'action1', target: 'end' },
    ],
  },
  {
    triggerType: 'postgres_changes',
    label: 'Alerte temps réel',
    description: 'Réagit aux événements mood bas, paiements échoués',
    icon: 'database',
    color: 'violet',
    defaultName: 'Alerte bien-être patient',
    defaultDescription: 'Notifie le patient quand son score mood est bas 3 jours de suite',
    triggerConfig: { table: 'mood_entries', event: 'INSERT', mood_threshold: 4, streak_days: 3 },
    nodes: [
      { id: 'trigger', type: 'triggerNode', position: { x: 80, y: 160 }, data: { label: 'Mood bas', nodeType: 'postgres_changes' } },
      { id: 'action1', type: 'actionNode', position: { x: 300, y: 100 }, data: { label: 'Push bien-être', nodeType: 'send_push' } },
      { id: 'action2', type: 'actionNode', position: { x: 300, y: 220 }, data: { label: 'SMS urgence', nodeType: 'send_sms' } },
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
    triggerType: 'webhook',
    label: 'Webhook externe',
    description: 'Intègre des outils tiers via HTTP POST',
    icon: 'webhook',
    color: 'amber',
    defaultName: 'Webhook entrant',
    defaultDescription: 'Reçoit des événements externes et déclenche des actions',
    triggerConfig: {},
    nodes: [
      { id: 'trigger', type: 'triggerNode', position: { x: 80, y: 160 }, data: { label: 'Webhook', nodeType: 'webhook' } },
      { id: 'action1', type: 'actionNode', position: { x: 300, y: 160 }, data: { label: 'Condition', nodeType: 'condition' } },
      { id: 'end', type: 'endNode', position: { x: 520, y: 160 }, data: { label: 'Terminé', nodeType: 'end' } },
    ],
    edges: [
      { id: 'e1', source: 'trigger', target: 'action1' },
      { id: 'e2', source: 'action1', target: 'end' },
    ],
  },
]

const COLOR_CLASSES: Record<string, { bg: string; border: string; text: string; ring: string }> = {
  sky:    { bg: 'bg-sky-50',    border: 'border-sky-300',    text: 'text-sky-700',    ring: 'ring-sky-400' },
  violet: { bg: 'bg-violet-50', border: 'border-violet-300', text: 'text-violet-700', ring: 'ring-violet-400' },
  amber:  { bg: 'bg-amber-50',  border: 'border-amber-300',  text: 'text-amber-700',  ring: 'ring-amber-400' },
}

interface CreateWorkflowModalProps {
  onClose: () => void
}

export function CreateWorkflowModal({ onClose }: CreateWorkflowModalProps) {
  const router = useRouter()
  const createWorkflow = useCreateWorkflow()
  const [step, setStep] = useState<'template' | 'details'>('template')
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateOption | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const handleSelectTemplate = (tpl: TemplateOption) => {
    setSelectedTemplate(tpl)
    setName(tpl.defaultName)
    setDescription(tpl.defaultDescription)
    setStep('details')
  }

  const handleCreate = () => {
    if (!selectedTemplate || !name.trim()) return
    createWorkflow.mutate(
      {
        name: name.trim(),
        description: description.trim(),
        trigger_type: selectedTemplate.triggerType,
        trigger_config: selectedTemplate.triggerConfig,
        nodes: selectedTemplate.nodes,
        edges: selectedTemplate.edges,
      },
      {
        onSuccess: ({ id }) => {
          onClose()
          router.push(`/admin/workflows/${id}`)
        },
      }
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(11,28,48,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-xl rounded-2xl p-7 flex flex-col gap-6"
        style={{
          backgroundColor: '#fff',
          boxShadow: '0 20px 60px rgba(0,102,133,0.18)',
          border: '1px solid rgba(190,200,206,0.35)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Modal header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#0b1c30]">
              {step === 'template' ? 'Créer un workflow' : 'Configurer le workflow'}
            </h2>
            <p className="text-sm text-[#6f787e] mt-0.5">
              {step === 'template' ? 'Choisissez un type de déclencheur' : 'Nommez et décrivez votre workflow'}
            </p>
          </div>
          <button onClick={onClose} className="text-[#6f787e] hover:text-[#0b1c30] transition-colors p-1">
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>

        {step === 'template' && (
          <div className="space-y-3">
            {TEMPLATES.map((tpl) => {
              const c = COLOR_CLASSES[tpl.color]
              return (
                <button
                  key={tpl.triggerType}
                  onClick={() => handleSelectTemplate(tpl)}
                  className={`w-full text-left flex items-center gap-4 p-4 rounded-xl border-2 ${c.bg} ${c.border} hover:ring-2 ${c.ring} transition-all`}
                >
                  <div className={`w-10 h-10 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center flex-shrink-0`}>
                    <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#006685' }}>{tpl.icon}</span>
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-bold ${c.text}`}>{tpl.label}</p>
                    <p className="text-xs text-[#6f787e] mt-0.5">{tpl.description}</p>
                  </div>
                  <span className="material-symbols-outlined text-[#6f787e]" style={{ fontSize: 18 }}>chevron_right</span>
                </button>
              )
            })}
          </div>
        )}

        {step === 'details' && selectedTemplate && (
          <div className="space-y-5">
            {/* Back */}
            <button
              onClick={() => setStep('template')}
              className="flex items-center gap-1 text-xs text-[#6f787e] hover:text-[#0b1c30] transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_back</span>
              Changer de type
            </button>

            {/* Selected template badge */}
            {(() => {
              const c = COLOR_CLASSES[selectedTemplate.color]
              return (
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${c.bg} border ${c.border}`}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#006685' }}>{selectedTemplate.icon}</span>
                  <span className={`text-xs font-semibold ${c.text}`}>{selectedTemplate.label}</span>
                </div>
              )
            })()}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#006685] uppercase tracking-widest">Nom *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Rappel rendez-vous 24h"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200/60 bg-white/60 text-sm text-[#0b1c30] outline-none focus:border-[#006685] transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#006685] uppercase tracking-widest">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Décrivez ce que fait ce workflow…"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200/60 bg-white/60 text-sm text-[#0b1c30] outline-none focus:border-[#006685] transition-colors resize-none"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-full border border-slate-200 text-sm font-semibold text-[#6f787e] hover:bg-slate-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleCreate}
                disabled={!name.trim() || createWorkflow.isPending}
                className="flex-1 py-2.5 rounded-full text-sm font-bold text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: '#006685' }}
              >
                {createWorkflow.isPending ? 'Création…' : 'Créer le workflow →'}
              </button>
            </div>

            {createWorkflow.isError && (
              <p className="text-xs text-red-500 text-center">{String(createWorkflow.error)}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
