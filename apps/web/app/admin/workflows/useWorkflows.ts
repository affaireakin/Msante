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

export function useUpdateWorkflow() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      trigger_config,
      is_active,
    }: {
      id: string
      trigger_config?: TriggerConfig
      is_active?: boolean
    }) => {
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (trigger_config !== undefined) updates.trigger_config = trigger_config
      if (is_active !== undefined) updates.is_active = is_active
      const { error } = await supabase.from('workflows').update(updates).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-workflows'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-workflow', id] })
    },
  })
}
