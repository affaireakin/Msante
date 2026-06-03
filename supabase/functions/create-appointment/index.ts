import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Inlined notification helpers ─────────────────────────────────────────────

type NotificationChannel = 'push' | 'email' | 'whatsapp' | 'sms'
type NotificationEventType =
  | 'appointment_confirm' | 'appointment_reminder' | 'payment_success'
  | 'payment_failed' | 'consultation_starting' | 'practitioner_approved'
  | 'mood_low_streak' | 'mood_check_in'

interface NotificationUser {
  id: string; full_name: string; email?: string | null
  push_token?: string | null; whatsapp_number?: string | null
}
interface NotificationEvent {
  type: NotificationEventType
  recipient: NotificationUser
  data: Record<string, string | number>
}
interface NotificationAdapter { send(event: NotificationEvent): Promise<void> }

type TemplateData = Record<string, string | number>

const TEMPLATES: Record<NotificationEventType, { title: string; body: string; route: (d: TemplateData) => string }> = {
  appointment_confirm:   { title: 'RDV confirmé ✓',          body: 'Votre RDV avec {practitionerName} le {date} est confirmé.',                  route: () => '/(patient)/home' },
  appointment_reminder:  { title: 'RDV dans 24h 📅',          body: 'Rappel : consultation avec {practitionerName} demain à {time}.',              route: () => '/(patient)/home' },
  payment_success:       { title: 'Paiement reçu ✓',          body: 'Paiement de {amount} XOF confirmé.',                                         route: () => '/(patient)/home' },
  payment_failed:        { title: 'Paiement échoué ⚠️',       body: 'Votre paiement a échoué. Réessayez dans votre espace patient.',               route: () => '/(patient)/payment' },
  consultation_starting: { title: 'Consultation dans 15 min 🎥', body: 'Votre consultation est dans 15 minutes, à {time}.',                        route: (d) => `/(patient)/consultation/${d.appointment_id}/session` },
  practitioner_approved: { title: 'Compte approuvé ✓',        body: 'Votre profil praticien a été validé. Vous pouvez recevoir des patients.',     route: () => '/(practitioner)/home' },
  mood_low_streak:       { title: 'Prenez soin de vous 💙',   body: 'Votre humeur est basse depuis quelques jours. Parler à un praticien peut aider.', route: () => '/(patient)/mental-health' },
  mood_check_in:         { title: 'Comment vous sentez-vous ? 🌤️', body: 'Prenez 30 secondes pour noter votre humeur du jour.',                   route: () => '/(patient)/mental-health' },
}

function interpolate(template: string, data: TemplateData): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => key in data ? String(data[key]) : `{${key}}`)
}

function buildNotificationPayload(type: NotificationEventType, data: TemplateData) {
  const tpl = TEMPLATES[type]
  return { title: tpl.title, body: interpolate(tpl.body, data), data: { route: tpl.route(data), type } }
}

class DeviceNotRegisteredError extends Error {
  constructor(public readonly pushToken: string) {
    super(`DeviceNotRegistered: token ${pushToken} is no longer valid`)
    this.name = 'DeviceNotRegisteredError'
  }
}

class ExpoAdapter implements NotificationAdapter {
  async send(event: NotificationEvent): Promise<void> {
    if (!event.recipient.push_token) throw new Error('ExpoAdapter: no push_token')
    const payload = buildNotificationPayload(event.type, event.data)
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'Accept-Encoding': 'gzip, deflate' },
      body: JSON.stringify({ to: event.recipient.push_token, title: payload.title, body: payload.body, data: payload.data, sound: 'default', priority: 'high', channelId: 'default' }),
    })
    if (!res.ok) throw new Error(`Expo push failed: ${res.status} ${await res.text()}`)
    const result = await res.json() as { data?: { status: string; message?: string; details?: string } }
    if (result.data?.status === 'error') {
      if (result.data.details === 'DeviceNotRegistered' || result.data.message === 'DeviceNotRegistered') throw new DeviceNotRegisteredError(event.recipient.push_token)
      throw new Error(`Expo push error: ${result.data.message ?? 'unknown'}`)
    }
  }
}

class ResendAdapter implements NotificationAdapter {
  constructor(private readonly apiKey: string) {}
  async send(event: NotificationEvent): Promise<void> {
    if (!event.recipient.email) throw new Error('ResendAdapter: no email')
    const payload = buildNotificationPayload(event.type, event.data)
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'M-Santé <noreply@msante.sn>',
        to: [event.recipient.email],
        subject: payload.title,
        html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px"><h2 style="color:#006685">${payload.title}</h2><p style="color:#0b1c30;font-size:16px;line-height:1.6">${payload.body}</p><hr style="border:none;border-top:1px solid #e5eeff;margin:24px 0"/><p style="color:#6f787e;font-size:12px">M-Santé — votre santé, notre priorité.</p></div>`,
      }),
    })
    if (!res.ok) throw new Error(`Resend failed: ${res.status} ${await res.text()}`)
  }
}

class WhatsAppAdapter implements NotificationAdapter {
  constructor(private readonly token: string, private readonly phoneNumberId: string) {}
  async send(event: NotificationEvent): Promise<void> {
    if (!this.token || !this.phoneNumberId) throw new Error('WhatsApp not configured')
    if (!event.recipient.whatsapp_number) throw new Error('WhatsAppAdapter: no WhatsApp number')
    const payload = buildNotificationPayload(event.type, event.data)
    const res = await fetch(`https://graph.facebook.com/v18.0/${this.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: event.recipient.whatsapp_number.replace(/\D/g, ''), type: 'text', text: { body: `*${payload.title}*\n\n${payload.body}` } }),
    })
    if (!res.ok) throw new Error(`WhatsApp failed: ${res.status} ${await res.text()}`)
  }
}

// deno-lint-ignore no-explicit-any
type SupabaseClient = any

class NotificationService {
  private readonly adapters: Record<NotificationChannel, NotificationAdapter>
  private readonly supabase: SupabaseClient

  constructor(opts: { expoAdapter: NotificationAdapter; resendAdapter: NotificationAdapter; whatsappAdapter: NotificationAdapter; supabase: SupabaseClient }) {
    this.adapters = { push: opts.expoAdapter, email: opts.resendAdapter, whatsapp: opts.whatsappAdapter, sms: { send: async () => { throw new Error('SMS not implemented') } } }
    this.supabase = opts.supabase
  }

  resolveChannels(user: NotificationUser): NotificationChannel[] {
    const channels: NotificationChannel[] = []
    if (user.push_token) channels.push('push')
    if (user.email) channels.push('email')
    if (user.whatsapp_number) channels.push('whatsapp')
    return channels.length > 0 ? channels : ['email']
  }

  async send(event: NotificationEvent): Promise<void> {
    const channels = this.resolveChannels(event.recipient)
    const payload = buildNotificationPayload(event.type, event.data)
    await Promise.allSettled(channels.map(async (channel) => {
      let status: 'sent' | 'failed' = 'sent'
      let errorMsg: string | undefined
      try {
        await this.adapters[channel].send(event)
      } catch (err) {
        status = 'failed'
        errorMsg = err instanceof Error ? err.message : 'unknown error'
        console.error(`NotificationService: ${channel} failed for ${event.recipient.id}:`, errorMsg)
        if (err instanceof DeviceNotRegisteredError) {
          await this.supabase.from('users').update({ push_token: null }).eq('id', event.recipient.id)
        }
      }
      await this.supabase.from('notifications').insert({
        user_id: event.recipient.id, type: event.type, title: payload.title, body: payload.body,
        data: event.data, channel, status, sent_at: status === 'sent' ? new Date().toISOString() : null,
      })
    }))
  }
}

function createNotificationService(supabase: SupabaseClient, resendApiKey: string, whatsappToken = '', whatsappPhoneId = '') {
  return new NotificationService({
    expoAdapter: new ExpoAdapter(),
    resendAdapter: new ResendAdapter(resendApiKey),
    whatsappAdapter: new WhatsAppAdapter(whatsappToken, whatsappPhoneId),
    supabase,
  })
}

// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { practitioner_id, scheduled_at, duration_min = 60, type = 'video', service_id } = await req.json()

    // Vérifie que le praticien est approuvé
    const { data: practitioner, error: pErr } = await supabase
      .from('practitioners')
      .select('id, session_price, session_currency, verification_status')
      .eq('id', practitioner_id)
      .single()

    if (pErr || !practitioner) {
      return new Response(JSON.stringify({ error: 'Practitioner not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (practitioner.verification_status !== 'approved') {
      return new Response(JSON.stringify({ error: 'Practitioner not verified' }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const scheduledDate = new Date(scheduled_at)
    const endDate = new Date(scheduledDate.getTime() + duration_min * 60 * 1000)

    // Cancel own stale pending appointment at same slot (retry after failed payment)
    await supabase
      .from('appointments')
      .update({ status: 'cancelled', cancellation_reason: 'rebooking' })
      .eq('patient_id', user.id)
      .eq('practitioner_id', practitioner_id)
      .eq('status', 'pending')
      .gte('scheduled_at', new Date(scheduledDate.getTime() - 60_000).toISOString())
      .lte('scheduled_at', new Date(scheduledDate.getTime() + 60_000).toISOString())

    // Vérifie absence de chevauchement
    const { data: conflicts } = await supabase
      .from('appointments')
      .select('id')
      .eq('practitioner_id', practitioner_id)
      .not('status', 'in', '("cancelled","no_show")')
      .lt('scheduled_at', endDate.toISOString())
      .gt('scheduled_at', new Date(scheduledDate.getTime() - duration_min * 60 * 1000).toISOString())

    if (conflicts && conflicts.length > 0) {
      return new Response(JSON.stringify({ error: 'Slot already taken' }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Crée le RDV
    const { data: appointment, error: aErr } = await supabase
      .from('appointments')
      .insert({
        patient_id: user.id,
        practitioner_id,
        scheduled_at,
        duration_min,
        type,
        status: 'pending',
        ...(service_id ? { service_id } : {}),
      })
      .select()
      .single()

    if (aErr) throw aErr

    // Send appointment_confirm notification to patient (fire-and-forget)
    try {
      const notifService = createNotificationService(
        supabase,
        Deno.env.get('RESEND_API_KEY') ?? '',
        Deno.env.get('WHATSAPP_TOKEN') ?? '',
        Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? '',
      )

      const { data: patientUser } = await supabase
        .from('users')
        .select('id, full_name, email, push_token')
        .eq('id', user.id)
        .single()

      const { data: practUser } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', (await supabase
          .from('practitioners')
          .select('user_id')
          .eq('id', practitioner_id)
          .single()
        ).data?.user_id ?? '')
        .maybeSingle()

      const apptDate = new Date(scheduled_at)
      const dateTimeStr = apptDate.toLocaleDateString('fr-FR', {
        day: '2-digit', month: 'long', year: 'numeric',
      }) + ' à ' + apptDate.toLocaleTimeString('fr-FR', {
        hour: '2-digit', minute: '2-digit',
      })

      if (patientUser) {
        await notifService.send({
          type: 'appointment_confirm',
          recipient: {
            id: patientUser.id,
            full_name: patientUser.full_name,
            email: patientUser.email,
            push_token: patientUser.push_token,
          },
          data: {
            practitionerName: practUser?.full_name ?? 'votre praticien',
            date: dateTimeStr,
            appointmentId: appointment.id,
          },
        })
      }
    } catch (notifErr) {
      console.error('create-appointment: notification failed', notifErr)
    }

    return new Response(JSON.stringify({
      appointmentId: appointment.id,
      amount: practitioner.session_price,
      currency: practitioner.session_currency,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('create-appointment error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
