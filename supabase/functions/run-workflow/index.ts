import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WorkflowNodeDef {
  id: string
  type: string
  data: { nodeType: string; template?: string }
}

interface RunContext {
  supabase: ReturnType<typeof createClient>
  triggerData: Record<string, unknown>
  workflowConfig: Record<string, unknown>
}

// ── Node handlers ─────────────────────────────────────────────────────────────

async function handleQueryUpcomingAppointments(ctx: RunContext): Promise<Record<string, unknown>> {
  const now = new Date()
  const from = new Date(now.getTime() + 23 * 3600 * 1000).toISOString()
  const to = new Date(now.getTime() + 25 * 3600 * 1000).toISOString()

  const { data: appointments } = await ctx.supabase
    .from('appointments')
    .select('id, patient_id, practitioner_id, scheduled_at')
    .eq('status', 'confirmed')
    .gte('scheduled_at', from)
    .lte('scheduled_at', to)

  return { appointments: appointments ?? [], count: (appointments ?? []).length }
}

async function handleSendPush(
  ctx: RunContext,
  template: string,
  inputData: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const appointments = (inputData.appointments as { patient_id: string }[] | undefined) ?? []
  const sent: string[] = []

  const messages: Record<string, string> = {
    appointment_reminder: 'Rappel : vous avez un rendez-vous demain.',
    wellness_check: 'Comment allez-vous ? Prenez soin de vous.',
    payment_retry: 'Votre paiement a échoué. Nous réessayons.',
  }

  for (const apt of appointments) {
    const { data: user } = await ctx.supabase
      .from('users')
      .select('push_token, full_name')
      .eq('id', apt.patient_id)
      .single()

    if (!user?.push_token) continue

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: user.push_token,
        title: 'M-Santé',
        body: messages[template] ?? 'Notification M-Santé',
        data: { template },
      }),
    })
    sent.push(apt.patient_id)
  }

  return { sent_count: sent.length }
}

async function handleSendSms(_ctx: RunContext): Promise<Record<string, unknown>> {
  // SMS provider not configured in V1 — log only
  return { status: 'sms_skipped_v1' }
}

async function handleCheckMoodStreak(
  ctx: RunContext,
  inputData: Record<string, unknown>
): Promise<{ should_continue: boolean }> {
  const patientId = (ctx.triggerData.record as Record<string, unknown> | undefined)?.patient_id as string | undefined
  if (!patientId) return { should_continue: false }

  const threshold = (ctx.workflowConfig.mood_threshold as number | undefined) ?? 4
  const streakDays = (ctx.workflowConfig.streak_days as number | undefined) ?? 3

  const { data: entries } = await ctx.supabase
    .from('mood_entries')
    .select('score, entry_date')
    .eq('patient_id', patientId)
    .lte('score', threshold)
    .order('entry_date', { ascending: false })
    .limit(streakDays)

  const hasStreak = (entries ?? []).length >= streakDays
  if (hasStreak) {
    (inputData as Record<string, unknown>).appointments = [{ patient_id: patientId }]
  }
  return { should_continue: hasStreak }
}

async function handleCheckRetryCount(
  ctx: RunContext,
  inputData: Record<string, unknown>
): Promise<{ should_continue: boolean }> {
  const paymentId = (ctx.triggerData.record as Record<string, unknown> | undefined)?.id as string | undefined
  if (!paymentId) return { should_continue: false }

  const maxRetries = (ctx.workflowConfig.max_retries as number | undefined) ?? 3

  const { data: payment } = await ctx.supabase
    .from('payments')
    .select('retry_count, patient_id')
    .eq('id', paymentId)
    .single()

  if (!payment || payment.retry_count >= maxRetries) return { should_continue: false }
  ;(inputData as Record<string, unknown>).appointments = [{ patient_id: payment.patient_id }]
  ;(inputData as Record<string, unknown>).payment_id = paymentId
  return { should_continue: true }
}

async function handleRetryPayment(
  ctx: RunContext,
  inputData: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const paymentId = inputData.payment_id as string | undefined
  if (!paymentId) return { skipped: true }

  const { data: payment } = await ctx.supabase
    .from('payments')
    .select('retry_count')
    .eq('id', paymentId)
    .single()

  await ctx.supabase
    .from('payments')
    .update({
      retry_count: ((payment?.retry_count as number) ?? 0) + 1,
      status: 'processing',
      updated_at: new Date().toISOString(),
    })
    .eq('id', paymentId)

  return { retried: true, payment_id: paymentId }
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json() as {
      trigger_type?: string
      workflow_id?: string
      trigger_data?: Record<string, unknown>
    }
    const { trigger_type, workflow_id, trigger_data = {} } = body

    let query = supabase.from('workflows').select('*').eq('is_active', true)
    if (trigger_type) query = query.eq('trigger_type', trigger_type)
    if (workflow_id) query = query.eq('id', workflow_id)

    const { data: workflows } = await query
    if (!workflows || workflows.length === 0) {
      return new Response(JSON.stringify({ ok: true, ran: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let ran = 0

    for (const workflow of workflows) {
      if (workflow.trigger_type === 'schedule.cron') {
        const sendHour = (workflow.trigger_config as Record<string, unknown>).send_hour as number | undefined
        const currentHour = new Date().getUTCHours()
        if (sendHour !== undefined && currentHour !== sendHour) continue
      }

      if (workflow.trigger_type === 'postgres_changes') {
        const statusFilter = (workflow.trigger_config as Record<string, unknown>).status_filter as string | undefined
        if (statusFilter) {
          const recordStatus = (trigger_data.record as Record<string, unknown> | undefined)?.status
          if (recordStatus !== statusFilter) continue
        }
      }

      const { data: run } = await supabase
        .from('workflow_runs')
        .insert({ workflow_id: workflow.id, trigger_data, status: 'running' })
        .select()
        .single()

      if (!run) continue

      const ctx: RunContext = {
        supabase,
        triggerData: trigger_data,
        workflowConfig: workflow.trigger_config as Record<string, unknown>,
      }

      let runFailed = false
      let prevOutput: Record<string, unknown> = {}

      for (const node of (workflow.nodes as WorkflowNodeDef[])) {
        if (node.type === 'triggerNode' || node.type === 'endNode') continue

        const { data: log } = await supabase
          .from('workflow_logs')
          .insert({
            run_id: run.id,
            node_id: node.id,
            node_type: node.data.nodeType,
            status: 'running',
            input_data: prevOutput,
          })
          .select()
          .single()

        const startMs = Date.now()
        let status = 'success'
        let output: Record<string, unknown> = {}
        let errorDetails: Record<string, unknown> | null = null

        try {
          switch (node.data.nodeType) {
            case 'query_upcoming_appointments':
              output = await handleQueryUpcomingAppointments(ctx)
              break
            case 'send_push':
              output = await handleSendPush(ctx, node.data.template ?? '', prevOutput)
              break
            case 'send_sms':
              output = await handleSendSms(ctx)
              break
            case 'check_mood_streak': {
              const result = await handleCheckMoodStreak(ctx, prevOutput)
              output = result
              if (!result.should_continue) status = 'skipped'
              break
            }
            case 'check_retry_count': {
              const result = await handleCheckRetryCount(ctx, prevOutput)
              output = result
              if (!result.should_continue) status = 'skipped'
              break
            }
            case 'retry_payment':
              output = await handleRetryPayment(ctx, prevOutput)
              break
            default:
              output = { skipped: true, reason: 'unknown_node_type' }
          }
        } catch (e) {
          status = 'error'
          errorDetails = { message: (e as Error).message }
          runFailed = true
        }

        await supabase
          .from('workflow_logs')
          .update({
            status,
            output_data: output,
            error_details: errorDetails,
            duration_ms: Date.now() - startMs,
          })
          .eq('id', log?.id)

        if (status === 'error') break
        prevOutput = { ...prevOutput, ...output }
      }

      await supabase
        .from('workflow_runs')
        .update({ status: runFailed ? 'failed' : 'completed', ended_at: new Date().toISOString() })
        .eq('id', run.id)

      ran++
    }

    return new Response(JSON.stringify({ ok: true, ran }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
