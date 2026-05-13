'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Workflow, WorkflowRun, WorkflowLog, TriggerConfig } from '@/types/workflows'

export function useWorkflows() {
  return useQuery({
    queryKey: ['admin-workflows'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as Workflow[]
    },
    staleTime: 30_000,
  })
}

export function useWorkflow(id: string) {
  return useQuery({
    queryKey: ['admin-workflow', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as Workflow
    },
    staleTime: 30_000,
  })
}

export function useWorkflowRuns(workflowId: string) {
  return useQuery({
    queryKey: ['admin-workflow-runs', workflowId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workflow_runs')
        .select('*')
        .eq('workflow_id', workflowId)
        .order('started_at', { ascending: false })
        .limit(10)
      if (error) throw error
      return (data ?? []) as WorkflowRun[]
    },
    staleTime: 15_000,
  })
}

export function useWorkflowLogs(runId: string | null) {
  return useQuery({
    queryKey: ['admin-workflow-logs', runId],
    queryFn: async () => {
      if (!runId) return []
      const { data, error } = await supabase
        .from('workflow_logs')
        .select('*')
        .eq('run_id', runId)
        .order('executed_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as WorkflowLog[]
    },
    enabled: !!runId,
    staleTime: 15_000,
  })
}

export function useRunWorkflow() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ workflowId, force = false }: { workflowId: string; force?: boolean }) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Non connecté')
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/run-workflow`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ workflow_id: workflowId, trigger_data: {}, force }),
        }
      )
      if (!res.ok) throw new Error(await res.text())
      return res.json() as Promise<{ ok: boolean; ran: number }>
    },
    onSuccess: (_, { workflowId }) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-workflow-runs', workflowId] })
    },
  })
}

export function useUpdateWorkflow() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      trigger_config,
      is_active,
      nodes,
      edges,
    }: {
      id: string
      trigger_config?: TriggerConfig
      is_active?: boolean
      nodes?: Workflow['nodes']
      edges?: Workflow['edges']
    }) => {
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (trigger_config !== undefined) updates.trigger_config = trigger_config
      if (is_active !== undefined) updates.is_active = is_active
      if (nodes !== undefined) updates.nodes = nodes
      if (edges !== undefined) updates.edges = edges
      const { error } = await supabase.from('workflows').update(updates).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-workflows'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-workflow', id] })
    },
  })
}

export function useCreateWorkflow() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      name,
      description,
      trigger_type,
      trigger_config,
      nodes,
      edges,
    }: {
      name: string
      description: string
      trigger_type: Workflow['trigger_type']
      trigger_config: TriggerConfig
      nodes: Workflow['nodes']
      edges: Workflow['edges']
    }) => {
      const { data, error } = await supabase
        .from('workflows')
        .insert({ name, description, trigger_type, trigger_config, nodes, edges, is_active: false })
        .select('id')
        .single()
      if (error) throw error
      return data as { id: string }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-workflows'] })
    },
  })
}
