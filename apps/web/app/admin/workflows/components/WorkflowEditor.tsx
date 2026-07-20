'use client'
import { useCallback, useEffect, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  addEdge,
  Background,
  Controls,
  Handle,
  Position,
  useReactFlow,
  type NodeProps,
  type Connection,
  type Node as RFNode,
  type Edge as RFEdge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { WorkflowNode, WorkflowEdge } from '@/types/workflows'

// ── Node data types ───────────────────────────────────────────────────────────

interface NodeConfig {
  template?: string       // send_push / send_email
  message?: string        // send_push custom message
  subject?: string        // send_email subject
  hours?: number          // delay hours
  field?: string          // condition field
  operator?: string       // condition operator
  value?: string          // condition value
}

interface NodeData {
  label: string
  nodeType: string
  config?: NodeConfig
}

// ── Custom nodes ──────────────────────────────────────────────────────────────

function TriggerNode({ data, selected }: NodeProps) {
  const d = data as unknown as NodeData
  return (
    <div
      className={`px-4 py-3 rounded-xl border-2 min-w-[140px] text-center transition-all ${selected ? 'border-sky-500 shadow-lg' : 'border-sky-400'}`}
      style={{ backgroundColor: 'rgba(224,242,254,0.95)', backdropFilter: 'blur(8px)' }}
    >
      <p className="text-xs font-bold text-sky-600 uppercase tracking-widest mb-1">Trigger</p>
      <p className="text-sm font-semibold text-sky-900">{d.label}</p>
      <p className="text-xs text-sky-600 mt-0.5">{d.nodeType}</p>
      <Handle type="source" position={Position.Right} className="!bg-sky-400 !w-3 !h-3" />
    </div>
  )
}

function ActionNode({ data, selected }: NodeProps) {
  const d = data as unknown as NodeData
  return (
    <div
      className={`px-4 py-3 rounded-xl border-2 min-w-[140px] text-center transition-all ${selected ? 'border-[#82d8ff] shadow-lg' : 'border-slate-200'}`}
      style={{ backgroundColor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)' }}
    >
      <p className="text-xs font-bold text-[#82d8ff] uppercase tracking-widest mb-1">Action</p>
      <p className="text-sm font-semibold text-[#0b1c30]">{d.label}</p>
      {d.config?.template && (
        <p className="text-xs text-[#82d8ff] mt-0.5 font-medium">{d.config.template}</p>
      )}
      {d.config?.hours && (
        <p className="text-xs text-[#82d8ff] mt-0.5 font-medium">{d.config.hours}h</p>
      )}
      {!d.config?.template && !d.config?.hours && (
        <p className="text-xs text-[#6f787e] mt-0.5">{d.nodeType}</p>
      )}
      <Handle type="target" position={Position.Left} className="!bg-slate-300 !w-3 !h-3" />
      <Handle type="source" position={Position.Right} className="!bg-slate-300 !w-3 !h-3" />
    </div>
  )
}

function EndNode({ data, selected }: NodeProps) {
  const d = data as unknown as NodeData
  return (
    <div
      className={`px-4 py-3 rounded-xl border-2 min-w-[100px] text-center transition-all ${selected ? 'border-emerald-500 shadow-lg' : 'border-emerald-400'}`}
      style={{ backgroundColor: 'rgba(209,250,229,0.95)', backdropFilter: 'blur(8px)' }}
    >
      <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">End</p>
      <p className="text-sm font-semibold text-emerald-900">{d.label}</p>
      <Handle type="target" position={Position.Left} className="!bg-emerald-400 !w-3 !h-3" />
    </div>
  )
}

const nodeTypes = { triggerNode: TriggerNode, actionNode: ActionNode, endNode: EndNode }

// ── Palette ───────────────────────────────────────────────────────────────────

const PALETTE_SECTIONS = [
  {
    category: 'Triggers',
    items: [
      { rfType: 'triggerNode', nodeType: 'schedule.cron', label: 'Cron', icon: 'schedule' },
      { rfType: 'triggerNode', nodeType: 'postgres_changes', label: 'Realtime', icon: 'database' },
      { rfType: 'triggerNode', nodeType: 'webhook', label: 'Webhook', icon: 'webhook' },
    ],
  },
  {
    category: 'Actions',
    items: [
      { rfType: 'actionNode', nodeType: 'send_push', label: 'Push notif', icon: 'notifications' },
      { rfType: 'actionNode', nodeType: 'send_sms', label: 'SMS', icon: 'sms' },
      { rfType: 'actionNode', nodeType: 'send_email', label: 'Email', icon: 'email' },
      { rfType: 'actionNode', nodeType: 'delay', label: 'Délai', icon: 'timer' },
      { rfType: 'actionNode', nodeType: 'condition', label: 'Condition', icon: 'call_split' },
      { rfType: 'actionNode', nodeType: 'ai_analysis', label: 'Analyse IA', icon: 'psychology', color: '#7c3aed' },
      { rfType: 'actionNode', nodeType: 'recommend_appointment', label: 'Reco. RDV', icon: 'event_available' },
      { rfType: 'actionNode', nodeType: 'send_whatsapp', label: 'WhatsApp', icon: 'chat', color: '#1d7a3a' },
    ],
  },
  {
    category: 'Fin',
    items: [
      { rfType: 'endNode', nodeType: 'end', label: 'Fin', icon: 'stop_circle' },
    ],
  },
]

function PaletteItem({ item }: { item: (typeof PALETTE_SECTIONS)[0]['items'][0] }) {
  const bg = item.rfType === 'triggerNode' ? 'rgba(224,242,254,0.9)' : item.rfType === 'endNode' ? 'rgba(209,250,229,0.9)' : 'rgba(255,255,255,0.9)'
  const border = item.rfType === 'triggerNode' ? '#38bdf8' : item.rfType === 'endNode' ? '#34d399' : '#e2e8f0'

  const onDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('rf/type', item.rfType)
    e.dataTransfer.setData('rf/nodeType', item.nodeType)
    e.dataTransfer.setData('rf/label', item.label)
    e.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border cursor-grab active:cursor-grabbing hover:shadow-sm transition-shadow select-none"
      style={{ backgroundColor: bg, borderColor: border, fontSize: 12, fontWeight: 600, color: '#0b1c30' }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 13, color: item.color ?? '#82d8ff' }}>{item.icon}</span>
      {item.label}
    </div>
  )
}

// ── Node config panel ─────────────────────────────────────────────────────────

const PUSH_TEMPLATES = [
  { value: 'appointment_reminder', label: 'Rappel RDV' },
  { value: 'wellness_check', label: 'Check bien-être' },
  { value: 'payment_retry', label: 'Retry paiement' },
  { value: 'mood_low_streak', label: 'Alerte mood bas' },
]

const WHATSAPP_TEMPLATES = [
  { value: 'appointment_reminder', label: 'Rappel RDV' },
  { value: 'wellness_check',       label: 'Check bien-être' },
  { value: 'payment_retry',        label: 'Relance paiement' },
]

const EMAIL_TEMPLATES = [
  { value: 'appointment_confirm', label: 'Confirmation RDV' },
  { value: 'appointment_reminder', label: 'Rappel RDV' },
  { value: 'payment_failed', label: 'Paiement échoué' },
]

const CONDITION_OPERATORS = [
  { value: 'eq', label: '= égal' },
  { value: 'lt', label: '< inférieur à' },
  { value: 'lte', label: '≤ inf. ou égal' },
  { value: 'gt', label: '> supérieur à' },
  { value: 'gte', label: '≥ sup. ou égal' },
]

const inputCls = "w-full px-3 py-2 rounded-lg border border-slate-200/60 bg-white/60 text-xs text-[#0b1c30] outline-none focus:border-[#82d8ff] transition-colors"
const selectCls = inputCls

interface NodeConfigPanelProps {
  node: RFNode
  onUpdate: (id: string, config: NodeConfig) => void
  onClose: () => void
}

function NodeConfigPanel({ node, onUpdate, onClose }: NodeConfigPanelProps) {
  const data = node.data as unknown as NodeData
  const [config, setConfig] = useState<NodeConfig>(data.config ?? {})

  const handleSave = () => {
    onUpdate(node.id, config)
    onClose()
  }

  const set = (partial: Partial<NodeConfig>) => setConfig(c => ({ ...c, ...partial }))

  return (
    <div
      className="w-52 flex-shrink-0 flex flex-col border-l overflow-y-auto"
      style={{ backgroundColor: 'rgba(248,249,255,0.98)', borderColor: 'rgba(190,200,206,0.35)' }}
    >
      <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b" style={{ borderColor: 'rgba(190,200,206,0.35)' }}>
        <p className="text-[9px] font-bold text-[#82d8ff] uppercase tracking-widest">Config nœud</p>
        <button onClick={onClose} className="text-[#6f787e] hover:text-[#0b1c30] transition-colors text-xs leading-none">✕</button>
      </div>

      <div className="p-3 space-y-4 flex-1">
        <div>
          <p className="text-xs font-semibold text-[#0b1c30] mb-0.5">{data.label}</p>
          <p className="text-[10px] text-[#6f787e]">{data.nodeType}</p>
        </div>

        {/* send_push config */}
        {data.nodeType === 'send_push' && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#82d8ff] uppercase tracking-widest">Template</label>
              <select
                value={config.template ?? ''}
                onChange={e => set({ template: e.target.value })}
                className={selectCls}
              >
                <option value="">Choisir…</option>
                {PUSH_TEMPLATES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#82d8ff] uppercase tracking-widest">Message personnalisé</label>
              <textarea
                value={config.message ?? ''}
                onChange={e => set({ message: e.target.value })}
                placeholder="Laisser vide pour le template par défaut"
                rows={3}
                className={inputCls + ' resize-none'}
              />
            </div>
          </div>
        )}

        {/* send_email config */}
        {data.nodeType === 'send_email' && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#82d8ff] uppercase tracking-widest">Template</label>
              <select
                value={config.template ?? ''}
                onChange={e => set({ template: e.target.value })}
                className={selectCls}
              >
                <option value="">Choisir…</option>
                {EMAIL_TEMPLATES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#82d8ff] uppercase tracking-widest">Sujet</label>
              <input
                type="text"
                value={config.subject ?? ''}
                onChange={e => set({ subject: e.target.value })}
                placeholder="Ex : Votre RDV M-Santé"
                className={inputCls}
              />
            </div>
          </div>
        )}

        {/* delay config */}
        {data.nodeType === 'delay' && (
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[#82d8ff] uppercase tracking-widest">Délai (heures)</label>
            <input
              type="number"
              min={1}
              max={168}
              value={config.hours ?? 2}
              onChange={e => set({ hours: Number(e.target.value) })}
              className={inputCls}
            />
            <p className="text-[10px] text-[#6f787e]">Le nœud suivant s'exécutera après ce délai.</p>
          </div>
        )}

        {/* condition config */}
        {data.nodeType === 'condition' && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#82d8ff] uppercase tracking-widest">Champ</label>
              <input
                type="text"
                value={config.field ?? ''}
                onChange={e => set({ field: e.target.value })}
                placeholder="Ex : retry_count"
                className={inputCls}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#82d8ff] uppercase tracking-widest">Opérateur</label>
              <select
                value={config.operator ?? 'eq'}
                onChange={e => set({ operator: e.target.value })}
                className={selectCls}
              >
                {CONDITION_OPERATORS.map(op => (
                  <option key={op.value} value={op.value}>{op.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#82d8ff] uppercase tracking-widest">Valeur</label>
              <input
                type="text"
                value={config.value ?? ''}
                onChange={e => set({ value: e.target.value })}
                placeholder="Ex : 3"
                className={inputCls}
              />
            </div>
          </div>
        )}

        {/* send_whatsapp config */}
        {data.nodeType === 'send_whatsapp' && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#82d8ff] uppercase tracking-widest">Template</label>
              <select
                value={config.template ?? ''}
                onChange={e => set({ template: e.target.value })}
                className={selectCls}
              >
                <option value="">Choisir…</option>
                {WHATSAPP_TEMPLATES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#82d8ff] uppercase tracking-widest">Message personnalisé</label>
              <textarea
                value={config.message ?? ''}
                onChange={e => set({ message: e.target.value })}
                placeholder="Laisser vide pour le template par défaut"
                rows={3}
                className={inputCls + ' resize-none'}
              />
            </div>
          </div>
        )}

        {/* ai_analysis info */}
        {data.nodeType === 'ai_analysis' && (
          <p className="text-[10px] text-[#6f787e] leading-relaxed">
            Analyse les entrées humeur via Claude Haiku. Lit les 7 dernières entrées du patient et retourne un sentiment (positive / neutral / concerning / critical) + une recommandation praticien.
          </p>
        )}

        {/* recommend_appointment info */}
        {data.nodeType === 'recommend_appointment' && (
          <p className="text-[10px] text-[#6f787e] leading-relaxed">
            Recommande un RDV si aucun RDV prévu dans 7 jours. Envoie une notification push au patient pour l'inciter à réserver.
          </p>
        )}

        {/* Nodes without config */}
        {!['send_push', 'send_email', 'delay', 'condition', 'send_whatsapp', 'ai_analysis', 'recommend_appointment'].includes(data.nodeType) && (
          <p className="text-[10px] text-[#6f787e] leading-relaxed">
            Ce nœud n'a pas de configuration supplémentaire.
          </p>
        )}
      </div>

      <div className="p-3 border-t" style={{ borderColor: 'rgba(190,200,206,0.35)' }}>
        <button
          onClick={handleSave}
          className="w-full py-2 text-xs font-bold text-white rounded-full transition-colors"
          style={{ backgroundColor: '#82d8ff' }}
        >
          Appliquer
        </button>
      </div>
    </div>
  )
}

// ── Inner editor ──────────────────────────────────────────────────────────────

let _nodeId = 2000

interface EditorInnerProps {
  initialNodes: WorkflowNode[]
  initialEdges: WorkflowEdge[]
  onSave: (nodes: WorkflowNode[], edges: WorkflowEdge[]) => void
  isSaving: boolean
}

function EditorInner({ initialNodes, initialEdges, onSave, isSaving }: EditorInnerProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes as RFNode[])
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges as RFEdge[])
  const [selectedNode, setSelectedNode] = useState<RFNode | null>(null)
  const { screenToFlowPosition } = useReactFlow()

  useEffect(() => {
    setNodes(initialNodes as RFNode[])
    setEdges(initialEdges as RFEdge[])
  }, [initialNodes, initialEdges, setNodes, setEdges])

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) => addEdge({ ...connection, animated: false }, eds)),
    [setEdges],
  )

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const rfType = e.dataTransfer.getData('rf/type')
      const nodeType = e.dataTransfer.getData('rf/nodeType')
      const label = e.dataTransfer.getData('rf/label')
      if (!rfType) return
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      const newNode: RFNode = {
        id: `n${++_nodeId}`,
        type: rfType,
        position,
        data: { label, nodeType, config: {} },
      }
      setNodes((nds) => [...nds, newNode])
    },
    [screenToFlowPosition, setNodes],
  )

  const onNodeClick = useCallback((_: React.MouseEvent, node: RFNode) => {
    setSelectedNode(prev => prev?.id === node.id ? null : node)
  }, [])

  const handleUpdateNodeConfig = useCallback((id: string, config: NodeConfig) => {
    setNodes(nds => nds.map(n =>
      n.id === id ? { ...n, data: { ...n.data, config } } : n
    ))
    setSelectedNode(prev => prev?.id === id ? { ...prev, data: { ...prev.data, config } } : prev)
  }, [setNodes])

  const handleSave = () => {
    onSave(nodes as unknown as WorkflowNode[], edges as unknown as WorkflowEdge[])
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl overflow-x-auto" style={{ border: '1px solid rgba(190,200,206,0.40)' }}>
      <div
        className="flex min-w-[700px]"
        style={{ height: 420 }}
      >
        {/* Palette sidebar */}
        <div
          className="w-44 flex-shrink-0 overflow-y-auto p-3 space-y-4 border-r"
          style={{ backgroundColor: 'rgba(248,249,255,0.98)', borderColor: 'rgba(190,200,206,0.35)' }}
        >
          {PALETTE_SECTIONS.map(({ category, items }) => (
            <div key={category}>
              <p className="text-[9px] font-bold text-[#82d8ff] uppercase tracking-widest mb-1.5">{category}</p>
              <div className="space-y-1.5">
                {items.map((item) => (
                  <PaletteItem key={item.nodeType} item={item} />
                ))}
              </div>
            </div>
          ))}
          <p className="text-[9px] text-[#6f787e] leading-tight pt-1">
            Glissez vers le canvas →<br />
            Cliquez un nœud pour configurer
          </p>
        </div>

        {/* Canvas */}
        <div
          className="flex-1 min-w-0"
          style={{ backgroundColor: 'rgba(248,249,255,0.8)' }}
          onDrop={onDrop}
          onDragOver={onDragOver}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            deleteKeyCode="Backspace"
            fitView
            fitViewOptions={{ padding: 0.3 }}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="rgba(0,102,133,0.05)" />
            <Controls />
          </ReactFlow>
        </div>

        {/* Node config panel */}
        {selectedNode && (
          <NodeConfigPanel
            node={selectedNode}
            onUpdate={handleUpdateNodeConfig}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>
      </div>

      {/* Save bar */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-[#6f787e]">
          <span className="font-semibold">Astuce :</span> glissez des blocs, connectez les handles, cliquez pour configurer, Suppr pour retirer.
        </p>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-full transition-colors disabled:opacity-50"
          style={{ backgroundColor: '#82d8ff', boxShadow: isSaving ? 'none' : '0 4px 14px rgba(0,102,133,0.30)' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
            {isSaving ? 'progress_activity' : 'save'}
          </span>
          {isSaving ? 'Enregistrement…' : 'Enregistrer le flux'}
        </button>
      </div>
    </div>
  )
}

// ── Public export ─────────────────────────────────────────────────────────────

export interface WorkflowEditorProps {
  initialNodes: WorkflowNode[]
  initialEdges: WorkflowEdge[]
  onSave: (nodes: WorkflowNode[], edges: WorkflowEdge[]) => void
  isSaving: boolean
}

export function WorkflowEditor(props: WorkflowEditorProps) {
  return (
    <ReactFlowProvider>
      <EditorInner {...props} />
    </ReactFlowProvider>
  )
}
