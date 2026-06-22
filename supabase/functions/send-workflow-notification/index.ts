// send-workflow-notification
// Checks if a workflow template is active, then sends WhatsApp + Email.
// Called by: on-appointment-status-change, process-payment, prescription creation endpoints.
//
// Required secrets (Supabase Dashboard → Edge Functions → Secrets):
//   WHATSAPP_TOKEN           – Meta Business API bearer token
//   WHATSAPP_PHONE_NUMBER_ID – Meta WhatsApp phone number ID
//   RESEND_API_KEY           – Resend API key for transactional email
//   FROM_EMAIL               – Sender address, e.g. notifications@m-sante.sn

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createNotificationService } from '../../packages/notifications/index.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Template key → NotificationEventType mapping
const EVENT_TYPE_MAP: Record<string, string> = {
  'appointment.confirmed':   'appointment_confirm',
  'appointment.cancelled':   'appointment_cancelled',
  'appointment.reminder_24h':'appointment_reminder',
  'prescription.created':    'prescription_created',
  'payment.completed':       'payment_success',
  'payment.failed':          'payment_failed',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const notifService = createNotificationService(
      supabase,
      Deno.env.get('RESEND_API_KEY') ?? '',
      Deno.env.get('WHATSAPP_TOKEN') ?? '',
      Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? '',
    )

    const body = await req.json() as {
      template_key: string
      recipients: Array<{
        user_id: string
        full_name: string
        email?: string | null
        phone?: string | null
        push_token?: string | null
      }>
      data: Record<string, string | number>
    }

    const { template_key, recipients, data } = body

    if (!template_key || !recipients?.length) {
      return new Response(JSON.stringify({ error: 'template_key and recipients are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if this workflow template is active
    const { data: workflow } = await supabase
      .from('workflows')
      .select('id, is_active')
      .filter('trigger_config->>template_key', 'eq', template_key)
      .maybeSingle()

    if (!workflow?.is_active) {
      return new Response(JSON.stringify({ skipped: true, reason: 'workflow_inactive' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const eventType = EVENT_TYPE_MAP[template_key]
    if (!eventType) {
      return new Response(JSON.stringify({ error: `Unknown template_key: ${template_key}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let sent = 0
    const errors: string[] = []

    await Promise.allSettled(
      recipients.map(async (r) => {
        try {
          await notifService.send({
            type: eventType as Parameters<typeof notifService.send>[0]['type'],
            recipient: {
              id: r.user_id,
              full_name: r.full_name,
              email: r.email,
              push_token: r.push_token,
              whatsapp_number: r.phone,
            },
            data,
          })
          sent++
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'unknown'
          errors.push(`${r.user_id}: ${msg}`)
          console.error('send-workflow-notification: recipient failed', r.user_id, msg)
        }
      })
    )

    return new Response(JSON.stringify({ sent, errors }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (e) {
    console.error('send-workflow-notification: unhandled error', e)
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
