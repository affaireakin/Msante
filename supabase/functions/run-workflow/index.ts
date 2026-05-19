import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NodeConfig {
  template?: string
  message?: string
  subject?: string
  hours?: number
  field?: string
  operator?: string
  value?: string
}

interface WorkflowNodeDef {
  id: string
  type: string
  data: { nodeType: string; template?: string; config?: NodeConfig }
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
  return { status: 'sms_skipped_v1' }
}

async function handleSendEmail(
  ctx: RunContext,
  config: NodeConfig,
  inputData: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) return { status: 'email_skipped_no_key' }

  const appointments = (inputData.appointments as { patient_id: string }[] | undefined) ?? []
  const sent: string[] = []

  const subjects: Record<string, string> = {
    appointment_confirm: 'Votre RDV M-Santé est confirmé',
    appointment_reminder: 'Rappel : votre RDV M-Santé demain',
    payment_failed: 'Votre paiement M-Santé a échoué',
  }

  const bodies: Record<string, string> = {
    appointment_confirm: 'Votre rendez-vous a bien été confirmé sur M-Santé.',
    appointment_reminder: 'Rappel : vous avez un rendez-vous demain sur M-Santé.',
    payment_failed: 'Votre paiement a échoué. Reconnectez-vous pour réessayer.',
  }

  const template = config.template ?? 'appointment_reminder'
  const subject = config.subject || subjects[template] || 'Notification M-Santé'
  const body = bodies[template] ?? 'Notification de M-Santé.'

  for (const apt of appointments) {
    const { data: user } = await ctx.supabase
      .from('users')
      .select('email:id, full_name')
      .eq('id', apt.patient_id)
      .single()

    if (!user) continue

    const { data: authUser } = await ctx.supabase.auth.admin.getUserById(apt.patient_id)
    const email = authUser?.user?.email
    if (!email) continue

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: 'M-Santé <no-reply@m-sante.app>',
        to: [email],
        subject,
        html: `<p>${body}</p><p style="color:#6f787e;font-size:12px">M-Santé · Votre santé mentale, réinventée.</p>`,
      }),
    })
    sent.push(apt.patient_id)
  }

  return { sent_count: sent.length }
}

async function handleDelay(
  _ctx: RunContext,
  config: NodeConfig
): Promise<Record<string, unknown>> {
  const hours = config.hours ?? 2
  const executeAt = new Date(Date.now() + hours * 3600 * 1000).toISOString()
  return { delayed: true, hours, execute_after: executeAt }
}

async function handleCondition(
  _ctx: RunContext,
  config: NodeConfig,
  inputData: Record<string, unknown>
): Promise<{ should_continue: boolean }> {
  const { field, operator = 'eq', value } = config
  if (!field || value === undefined) return { should_continue: false }

  const actual = inputData[field]
  const expected = isNaN(Number(value)) ? value : Number(value)

  let result = false
  switch (operator) {
    case 'eq':  result = actual == expected; break
    case 'lt':  result = Number(actual) <  Number(expected); break
    case 'lte': result = Number(actual) <= Number(expected); break
    case 'gt':  result = Number(actual) >  Number(expected); break
    case 'gte': result = Number(actual) >= Number(expected); break
  }
  return { should_continue: result }
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

async function handleAiAnalysis(
  ctx: RunContext,
  inputData: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const claudeApiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!claudeApiKey) return { skipped: true, reason: 'no_api_key', sentiment: 'unknown' }

  const appointments = (inputData.appointments as { patient_id: string }[] | undefined) ?? []
  if (appointments.length === 0) return { sentiment: 'unknown', skipped: true }

  const patientId = appointments[0].patient_id

  // Get last 7 mood entries
  const { data: moodEntries } = await ctx.supabase
    .from('mood_entries')
    .select('score, note, entry_date')
    .eq('patient_id', patientId)
    .order('entry_date', { ascending: false })
    .limit(7)

  if (!moodEntries || moodEntries.length === 0) return { sentiment: 'unknown' }

  const avgScore = moodEntries.reduce((s, e) => s + e.score, 0) / moodEntries.length
  const notes = moodEntries.map(e => e.note).filter(Boolean).join('. ')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': claudeApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Patient mood data (7 days): avg score ${avgScore.toFixed(1)}/10. Notes: "${notes}".
Classify emotional state in one word: positive, neutral, concerning, or critical.
Then give a brief 1-sentence actionable insight for the practitioner.
Format: {"sentiment": "...", "insight": "..."}. Only JSON, no other text.`
      }]
    }),
  })

  const data = await res.json() as { content?: Array<{ text?: string }> }
  const text = data.content?.[0]?.text ?? '{}'
  try {
    const parsed = JSON.parse(text) as { sentiment?: string; insight?: string }
    return {
      sentiment: parsed.sentiment ?? 'unknown',
      insight: parsed.insight ?? '',
      avg_score: avgScore,
      patient_id: patientId,
      appointments: appointments,
    }
  } catch {
    return { sentiment: 'unknown', avg_score: avgScore, patient_id: patientId, appointments }
  }
}

async function handleRecommendAppointment(
  ctx: RunContext,
  inputData: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const patientId = (inputData.patient_id as string | undefined) ??
    ((inputData.appointments as { patient_id: string }[] | undefined)?.[0]?.patient_id)

  if (!patientId) return { skipped: true, reason: 'no_patient_id' }

  // Check if patient already has a pending/confirmed appointment in next 7 days
  const in7days = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
  const { data: existing } = await ctx.supabase
    .from('appointments')
    .select('id')
    .eq('patient_id', patientId)
    .in('status', ['pending', 'confirmed'])
    .gte('scheduled_at', new Date().toISOString())
    .lte('scheduled_at', in7days)
    .limit(1)

  if (existing && existing.length > 0) {
    return { skipped: true, reason: 'appointment_exists', patient_id: patientId }
  }

  // Send push notification recommending to book
  const { data: user } = await ctx.supabase
    .from('users')
    .select('push_token, full_name')
    .eq('id', patientId)
    .single()

  if (user?.push_token) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: user.push_token,
        title: 'M-Santé vous recommande une consultation',
        body: 'Votre bien-être mérite une attention particulière. Prenez rendez-vous avec votre praticien.',
        data: { route: '/(patient)/find-practitioners' },
      }),
    })
  }

  return { recommended: true, patient_id: patientId, notification_sent: !!user?.push_token }
}

async function handleSendWhatsApp(
  ctx: RunContext,
  config: NodeConfig,
  inputData: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const twilioToken = Deno.env.get('TWILIO_AUTH_TOKEN')
  const twilioWhatsApp = Deno.env.get('TWILIO_WHATSAPP_FROM') ?? 'whatsapp:+14155238886'

  if (!twilioSid || !twilioToken) return { status: 'whatsapp_skipped_no_credentials' }

  const appointments = (inputData.appointments as { patient_id: string }[] | undefined) ?? []
  const sent: string[] = []

  const messages: Record<string, string> = {
    appointment_reminder: '🗓️ Rappel M-Santé : vous avez un rendez-vous demain. Consultez l\'app pour les détails.',
    wellness_check: '💙 Comment allez-vous ? Votre équipe M-Santé pense à vous.',
    payment_retry: '⚠️ M-Santé : votre paiement nécessite votre attention. Ouvrez l\'app.',
  }

  const template = config.template ?? 'appointment_reminder'
  const messageBody = config.message || messages[template] || '📱 Notification M-Santé'

  for (const apt of appointments) {
    const { data: user } = await ctx.supabase
      .from('users')
      .select('phone, full_name')
      .eq('id', apt.patient_id)
      .single()

    if (!user?.phone) continue

    const phoneE164 = user.phone.startsWith('+') ? user.phone : `+${user.phone}`

    const body = new URLSearchParams({
      From: twilioWhatsApp,
      To: `whatsapp:${phoneE164}`,
      Body: messageBody,
    })

    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${twilioSid}:${twilioToken}`)}`,
      },
      body: body.toString(),
    })

    sent.push(apt.patient_id)
  }

  return { sent_count: sent.length }
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
      force?: boolean
    }
    const { trigger_type, workflow_id, trigger_data = {}, force = false } = body

    let query = supabase.from('workflows').select('*')
    if (!force) query = query.eq('is_active', true)
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
      if (!force && workflow.trigger_type === 'schedule.cron') {
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
          const nodeConfig = node.data.config ?? {}
          switch (node.data.nodeType) {
            case 'query_upcoming_appointments':
              output = await handleQueryUpcomingAppointments(ctx)
              break
            case 'send_push':
              output = await handleSendPush(ctx, nodeConfig.template ?? node.data.template ?? '', prevOutput)
              break
            case 'send_sms':
              output = await handleSendSms(ctx)
              break
            case 'send_email':
              output = await handleSendEmail(ctx, nodeConfig, prevOutput)
              break
            case 'delay':
              output = await handleDelay(ctx, nodeConfig)
              break
            case 'condition': {
              const result = await handleCondition(ctx, nodeConfig, prevOutput)
              output = result
              if (!result.should_continue) status = 'skipped'
              break
            }
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
            case 'ai_analysis':
              output = await handleAiAnalysis(ctx, prevOutput)
              break
            case 'recommend_appointment':
              output = await handleRecommendAppointment(ctx, prevOutput)
              break
            case 'send_whatsapp':
              output = await handleSendWhatsApp(ctx, nodeConfig, prevOutput)
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
