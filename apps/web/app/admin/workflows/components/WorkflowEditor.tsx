'use client'
import { useCallback, useEffect } from 'react'
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

// ── Custom nodes (selectable, with selection highlight) ───────────────────────

function TriggerNode({ data, selected }: NodeProps) {
  const d = data as { label: string; nodeType: string }
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
  const d = data as { label: string; nodeType: string }
  return (
    <div
      className={`px-4 py-3 rounded-xl border-2 min-w-[140px] text-center transition-all ${selected ? 'border-[#006685] shadow-lg' : 'border-slate-200'}`}
      style={{ backgroundColor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)' }}
    >
      <p className="text-xs font-bold text-[#006685] uppercase tracking-widest mb-1">Action</p>
      <p className="text-sm font-semibold text-[#0b1c30]">{d.label}</p>
      <p className="text-xs text-[#6f787e] mt-0.5">{d.nodeType}</p>
      <Handle type="target" position={Position.Left} className="!bg-slate-300 !w-3 !h-3" />
      <Handle type="source" position={Position.Right} className="!bg-slate-300 !w-3 !h-3" />
    </div>
  )
}

function EndNode({ data, selected }: NodeProps) {
  const d = data as { label: string }
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
      <span className="material-symbols-outlined" style={{ fontSize: 13, color: '#006685' }}>{item.icon}</span>
      {item.label}
    </div>
  )
}

// ── Inner editor (needs ReactFlow context) ────────────────────────────────────

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
        data: { label, nodeType },
      }
      setNodes((nds) => [...nds, newNode])
    },
    [screenToFlowPosition, setNodes],
  )

  const handleSave = () => {
    onSave(nodes as unknown as WorkflowNode[], edges as unknown as WorkflowEdge[])
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex rounded-2xl overflow-hidden"
        style={{ height: 420, border: '1px solid rgba(190,200,206,0.40)' }}
      >
        {/* Palette sidebar */}
        <div
          className="w-44 flex-shrink-0 overflow-y-auto p-3 space-y-4 border-r"
          style={{ backgroundColor: 'rgba(248,249,255,0.98)', borderColor: 'rgba(190,200,206,0.35)' }}
        >
          {PALETTE_SECTIONS.map(({ category, items }) => (
            <div key={category}>
              <p className="text-[9px] font-bold text-[#006685] uppercase tracking-widest mb-1.5">{category}</p>
              <div className="space-y-1.5">
                {items.map((item) => (
                  <PaletteItem key={item.nodeType} item={item} />
                ))}
              </div>
            </div>
          ))}
          <p className="text-[9px] text-[#6f787e] leading-tight pt-1">
            Glissez vers le canvas →<br />
            Sélectionnez + Suppr pour retirer
          </p>
        </div>

        {/* Canvas */}
        <div
          className="flex-1"
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
      </div>

      {/* Save bar */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-[#6f787e]">
          <span className="font-semibold">Astuce :</span> glissez des blocs, connectez les handles, sélectionnez + Suppr pour retirer.
        </p>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-full transition-colors disabled:opacity-50"
          style={{ backgroundColor: '#006685', boxShadow: isSaving ? 'none' : '0 4px 14px rgba(0,102,133,0.30)' }}
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
