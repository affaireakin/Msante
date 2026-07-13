// send-workflow-notification — self-contained, no local imports
// Checks if a workflow template is active, then sends WhatsApp + Email.
//
// Required secrets (Supabase Dashboard → Edge Functions → Secrets):
//   WHATSAPP_TOKEN           – Meta Business API bearer token
//   WHATSAPP_PHONE_NUMBER_ID – Meta WhatsApp phone number ID
//   RESEND_API_KEY           – Resend API key for transactional email
//   FROM_EMAIL               – Sender address, e.g. notifications@m-sante.com

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Inline templates ───────────────────────────────────────────────────────────

type Data = Record<string, string | number>

const TEMPLATES: Record<string, {
  title: string
  emailSubject: string
  emailHtml: (d: Data) => string
  whatsapp: (name: string, d: Data) => string
}> = {
  appointment_confirm: {
    title: 'RDV confirmé ✓',
    emailSubject: 'Votre rendez-vous est confirmé — M-Santé',
    emailHtml: (d) => `<p>Bonjour,</p><p>Votre RDV avec <strong>Dr. ${d.practitionerName}</strong> le <strong>${d.date} à ${d.time}</strong> est confirmé.</p><p>L'équipe M-Santé</p>`,
    whatsapp: (name, d) => `Bonjour ${name} 👋\n\nVotre RDV avec Dr. ${d.practitionerName} le ${d.date} à ${d.time} est confirmé ✅\n\nÀ bientôt sur M-Santé !`,
  },
  appointment_cancelled: {
    title: 'RDV annulé',
    emailSubject: 'Votre rendez-vous a été annulé — M-Santé',
    emailHtml: (d) => `<p>Bonjour,</p><p>Votre RDV avec <strong>Dr. ${d.practitionerName}</strong> le <strong>${d.date} à ${d.time}</strong> a été annulé.${d.reason ? `<br>Motif : ${d.reason}` : ''}</p><p>L'équipe M-Santé</p>`,
    whatsapp: (name, d) => `Bonjour ${name},\n\nVotre RDV avec Dr. ${d.practitionerName} le ${d.date} à ${d.time} a été annulé.${d.reason ? `\nMotif : ${d.reason}` : ''}\n\nM-Santé`,
  },
  appointment_reminder: {
    title: 'RDV dans 24h 📅',
    emailSubject: 'Rappel : votre RDV demain — M-Santé',
    emailHtml: (d) => `<p>Bonjour,</p><p>Rappel : votre consultation avec <strong>Dr. ${d.practitionerName}</strong> est demain à <strong>${d.time}</strong>.</p><p>L'équipe M-Santé</p>`,
    whatsapp: (name, d) => `Bonjour ${name} ⏰\n\nRappel : votre RDV avec Dr. ${d.practitionerName} est demain à ${d.time}.\n\nM-Santé`,
  },
  prescription_created: {
    title: 'Nouvelle ordonnance 📋',
    emailSubject: 'Nouvelle ordonnance disponible — M-Santé',
    emailHtml: (d) => `<p>Bonjour,</p><p>Dr. ${d.practitionerName} vous a créé une nouvelle ordonnance. Connectez-vous à M-Santé pour la consulter.</p><p>L'équipe M-Santé</p>`,
    whatsapp: (name, d) => `Bonjour ${name} 📋\n\nDr. ${d.practitionerName} vient de vous créer une ordonnance. Connectez-vous à M-Santé pour la consulter.\n\nM-Santé`,
  },
  payment_success: {
    title: 'Paiement reçu ✓',
    emailSubject: 'Confirmation de paiement — M-Santé',
    emailHtml: (d) => `<p>Bonjour,</p><p>Votre paiement de <strong>${d.amount} ${d.currency}</strong> via ${d.provider} a été reçu avec succès.</p><p>L'équipe M-Santé</p>`,
    whatsapp: (name, d) => `Bonjour ${name} ✅\n\nVotre paiement de ${d.amount} ${d.currency} a été confirmé.\n\nM-Santé`,
  },
  payment_failed: {
    title: 'Paiement échoué ⚠️',
    emailSubject: 'Votre paiement a échoué — M-Santé',
    emailHtml: (d) => `<p>Bonjour,</p><p>Votre paiement de <strong>${d.amount} ${d.currency}</strong> via ${d.provider} a échoué. Veuillez réessayer.</p><p>L'équipe M-Santé</p>`,
    whatsapp: (name, d) => `Bonjour ${name} ⚠️\n\nVotre paiement de ${d.amount} ${d.currency} a échoué. Connectez-vous à M-Santé pour réessayer.\n\nM-Santé`,
  },
  practitioner_approved: {
    title: 'Compte praticien approuvé ✓',
    emailSubject: 'Votre compte praticien M-Santé est validé !',
    emailHtml: (_d) => `<p>Bonjour,</p><p>Félicitations ! Votre profil praticien M-Santé a été validé. Vous pouvez maintenant recevoir des patients.</p><p>L'équipe M-Santé</p>`,
    whatsapp: (name, _d) => `Bonjour Dr. ${name} 🎉\n\nVotre compte praticien M-Santé a été validé ✅\n\nVous pouvez maintenant recevoir des patients.\n\nM-Santé`,
  },
}

const EVENT_TYPE_MAP: Record<string, string> = {
  'appointment.confirmed':    'appointment_confirm',
  'appointment.cancelled':    'appointment_cancelled',
  'appointment.reminder_24h': 'appointment_reminder',
  'prescription.created':     'prescription_created',
  'payment.completed':        'payment_success',
  'payment.failed':           'payment_failed',
  'practitioner.approved':    'practitioner_approved',
}

// ── Senders ────────────────────────────────────────────────────────────────────

async function sendWhatsApp(token: string, phoneNumberId: string, to: string, message: string): Promise<void> {
  const phone = to.replace(/[^0-9]/g, '')
  const intl = phone.startsWith('0') ? `221${phone.slice(1)}` : phone
  const res = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: intl, type: 'text', text: { body: message } }),
  })
  if (!res.ok) throw new Error(`WhatsApp API ${res.status}: ${await res.text()}`)
}

async function sendEmail(apiKey: string, from: string, to: string, subject: string, html: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from, to, subject, html }),
  })
  if (!res.ok) throw new Error(`Resend API ${res.status}: ${await res.text()}`)
}

// ── Handler ────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
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
      data: Data
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
    const tpl = eventType ? TEMPLATES[eventType] : null
    if (!tpl) {
      return new Response(JSON.stringify({ error: `Unknown template_key: ${template_key}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const waToken = Deno.env.get('WHATSAPP_TOKEN') ?? ''
    const waPhoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? ''
    const resendKey = Deno.env.get('RESEND_API_KEY') ?? ''
    const fromEmail = Deno.env.get('FROM_EMAIL') ?? 'notifications@m-sante.sn'

    let sent = 0
    const errors: string[] = []

    await Promise.allSettled(
      recipients.map(async (r) => {
        try {
          if (r.email && resendKey) {
            await sendEmail(resendKey, fromEmail, r.email, tpl.emailSubject, tpl.emailHtml(data))
            await supabase.from('notifications').insert({
              user_id: r.user_id, type: eventType, title: tpl.title,
              body: tpl.emailSubject, data: {}, channel: 'email',
              status: 'sent', sent_at: new Date().toISOString(),
            })
          }
          if (r.phone && waToken && waPhoneId) {
            const msg = tpl.whatsapp(r.full_name, data)
            await sendWhatsApp(waToken, waPhoneId, r.phone, msg)
            await supabase.from('notifications').insert({
              user_id: r.user_id, type: eventType, title: tpl.title,
              body: msg, data: {}, channel: 'whatsapp',
              status: 'sent', sent_at: new Date().toISOString(),
            })
          }
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
