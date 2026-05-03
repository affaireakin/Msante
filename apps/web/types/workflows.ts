export type TriggerType = 'schedule.cron' | 'postgres_changes' | 'webhook'
export type WorkflowStatus = 'running' | 'completed' | 'failed' | 'cancelled'
export type NodeLogStatus = 'pending' | 'running' | 'success' | 'error' | 'skipped'
export type WorkflowNodeType = 'triggerNode' | 'actionNode' | 'endNode'

export interface WorkflowNodeData {
  label: string
  nodeType: string
  template?: string
}

export interface WorkflowNode {
  id: string
  type: WorkflowNodeType
  position: { x: number; y: number }
  data: WorkflowNodeData
}

export interface WorkflowEdge {
  id: string
  source: string
  target: string
  animated?: boolean
}

export interface CronTriggerConfig {
  cron: string
  send_hour: number
}

export interface MoodTriggerConfig {
  table: 'mood_entries'
  event: 'INSERT'
  mood_threshold: number
  streak_days: number
}

export interface PaymentTriggerConfig {
  table: 'payments'
  event: 'UPDATE'
  status_filter: string
  delay_hours: number
  max_retries: number
}

export type TriggerConfig = CronTriggerConfig | MoodTriggerConfig | PaymentTriggerConfig

export interface Workflow {
  id: string
  name: string
  description: string | null
  trigger_type: TriggerType
  trigger_config: TriggerConfig
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface WorkflowRun {
  id: string
  workflow_id: string
  trigger_data: Record<string, unknown>
  status: WorkflowStatus
  started_at: string
  ended_at: string | null
  error_message: string | null
}

export interface WorkflowLog {
  id: string
  run_id: string
  node_id: string
  node_type: string
  status: NodeLogStatus
  input_data: Record<string, unknown>
  output_data: Record<string, unknown>
  error_details: Record<string, unknown> | null
  duration_ms: number | null
  executed_at: string
}
