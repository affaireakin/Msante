'use client'
import { ReactFlow, Handle, Position, type NodeProps } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { WorkflowNode, WorkflowEdge } from '@/types/workflows'

// ── Custom nodes ──────────────────────────────────────────────────────────────

function TriggerNode({ data }: NodeProps) {
  const d = data as { label: string; nodeType: string }
  return (
    <div
      className="px-4 py-3 rounded-xl border-2 border-sky-400 min-w-[140px] text-center"
      style={{ backgroundColor: 'rgba(224,242,254,0.9)', backdropFilter: 'blur(8px)' }}
    >
      <p className="text-xs font-bold text-sky-600 uppercase tracking-widest mb-1">Trigger</p>
      <p className="text-sm font-semibold text-sky-900">{d.label}</p>
      <p className="text-xs text-sky-600 mt-0.5">{d.nodeType}</p>
      <Handle type="source" position={Position.Right} className="!bg-sky-400" />
    </div>
  )
}

function ActionNode({ data }: NodeProps) {
  const d = data as { label: string; nodeType: string }
  return (
    <div
      className="px-4 py-3 rounded-xl border-2 border-slate-200 min-w-[140px] text-center"
      style={{ backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)' }}
    >
      <p className="text-xs font-bold text-[#82d8ff] uppercase tracking-widest mb-1">Action</p>
      <p className="text-sm font-semibold text-[#0b1c30]">{d.label}</p>
      <p className="text-xs text-[#6f787e] mt-0.5">{d.nodeType}</p>
      <Handle type="target" position={Position.Left} className="!bg-slate-300" />
      <Handle type="source" position={Position.Right} className="!bg-slate-300" />
    </div>
  )
}

function EndNode({ data }: NodeProps) {
  const d = data as { label: string }
  return (
    <div
      className="px-4 py-3 rounded-xl border-2 border-emerald-400 min-w-[100px] text-center"
      style={{ backgroundColor: 'rgba(209,250,229,0.9)', backdropFilter: 'blur(8px)' }}
    >
      <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-1">End</p>
      <p className="text-sm font-semibold text-emerald-900">{d.label}</p>
      <Handle type="target" position={Position.Left} className="!bg-emerald-400" />
    </div>
  )
}

const nodeTypes = {
  triggerNode: TriggerNode,
  actionNode: ActionNode,
  endNode: EndNode,
}

// ── Canvas ────────────────────────────────────────────────────────────────────

interface WorkflowCanvasProps {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  isActive: boolean
}

export function WorkflowCanvas({ nodes, edges, isActive }: WorkflowCanvasProps) {
  const flowEdges = edges.map((e) => ({ ...e, animated: isActive }))

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        height: 320,
        backgroundColor: 'rgba(248,249,255,0.8)',
        border: '1px solid rgba(255,255,255,0.80)',
        boxShadow: '0 10px 30px -10px rgba(0,102,133,0.05)',
      }}
    >
      <ReactFlow
        nodes={nodes as never[]}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
      />
    </div>
  )
}
