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
type Role = 'patient' | 'practitioner'

// WhatsApp est un message initié par l'entreprise hors fenêtre 24h pour la
// plupart de ces événements — Meta exige un template approuvé, pas du texte
// libre. Plutôt que faire approuver un template par type d'événement (et
// exposer du contenu potentiellement sensible en aperçu verrouillé), on
// envoie le même message générique pour tous les cas ; le contenu réel
// n'apparaît que dans l'app, derrière l'authentification. Email garde le
// détail par événement, ce canal n'a pas cette contrainte.
function genericWhatsAppMessage(name: string): string {
  return `Bonjour ${name} 👋\n\nVous avez une nouvelle notification dans votre espace personnel M-Santé.\n\nConnectez-vous à l'application pour la consulter.`
}

const TEMPLATES: Record<string, {
  title: string
  emailSubject: string
  // Content used to be identical for every recipient regardless of role —
  // a practitioner would receive "Votre RDV avec Dr. {eux-mêmes}", referring
  // to themself in the third person. Branch by role instead.
  emailHtml: (d: Data, role: Role) => string
}> = {
  appointment_confirm: {
    title: 'RDV confirmé ✓',
    emailSubject: 'Votre rendez-vous est confirmé — M-Santé',
    emailHtml: (d, role) => role === 'practitioner'
      ? `<p>Bonjour,</p><p>Votre RDV avec <strong>${d.patientName}</strong> le <strong>${d.date} à ${d.time}</strong> est confirmé.</p><p>L'équipe M-Santé</p>`
      : `<p>Bonjour,</p><p>Votre RDV avec <strong>Dr. ${d.practitionerName}</strong> le <strong>${d.date} à ${d.time}</strong> est confirmé.</p><p>L'équipe M-Santé</p>`,
  },
  appointment_cancelled: {
    title: 'RDV annulé',
    emailSubject: 'Votre rendez-vous a été annulé — M-Santé',
    emailHtml: (d, role) => role === 'practitioner'
      ? `<p>Bonjour,</p><p>Votre RDV avec <strong>${d.patientName}</strong> le <strong>${d.date} à ${d.time}</strong> a été annulé.${d.reason ? `<br>Motif : ${d.reason}` : ''}</p><p>L'équipe M-Santé</p>`
      : `<p>Bonjour,</p><p>Votre RDV avec <strong>Dr. ${d.practitionerName}</strong> le <strong>${d.date} à ${d.time}</strong> a été annulé.${d.reason ? `<br>Motif : ${d.reason}` : ''}</p><p>L'équipe M-Santé</p>`,
  },
  appointment_reminder: {
    title: 'RDV dans 24h 📅',
    emailSubject: 'Rappel : votre RDV demain — M-Santé',
    emailHtml: (d, role) => role === 'practitioner'
      ? `<p>Bonjour,</p><p>Rappel : votre consultation avec <strong>${d.patientName}</strong> est demain à <strong>${d.time}</strong>.</p><p>L'équipe M-Santé</p>`
      : `<p>Bonjour,</p><p>Rappel : votre consultation avec <strong>Dr. ${d.practitionerName}</strong> est demain à <strong>${d.time}</strong>.</p><p>L'équipe M-Santé</p>`,
  },
  prescription_created: {
    title: 'Nouvelle ordonnance 📋',
    emailSubject: 'Nouvelle ordonnance disponible — M-Santé',
    emailHtml: (d) => `<p>Bonjour,</p><p>Dr. ${d.practitionerName} vous a créé une nouvelle ordonnance. Connectez-vous à M-Santé pour la consulter.</p><p>L'équipe M-Santé</p>`,
  },
  payment_success: {
    title: 'Paiement reçu ✓',
    emailSubject: 'Confirmation de paiement — M-Santé',
    emailHtml: (d) => `<p>Bonjour,</p><p>Votre paiement de <strong>${d.amount} ${d.currency}</strong> via ${d.provider} a été reçu avec succès.</p><p>L'équipe M-Santé</p>`,
  },
  payment_failed: {
    title: 'Paiement échoué ⚠️',
    emailSubject: 'Votre paiement a échoué — M-Santé',
    emailHtml: (d) => `<p>Bonjour,</p><p>Votre paiement de <strong>${d.amount} ${d.currency}</strong> via ${d.provider} a échoué. Veuillez réessayer.</p><p>L'équipe M-Santé</p>`,
  },
  practitioner_approved: {
    title: 'Compte praticien approuvé ✓',
    emailSubject: 'Votre compte praticien M-Santé est validé !',
    emailHtml: (_d) => `<p>Bonjour,</p><p>Félicitations ! Votre profil praticien M-Santé a été validé. Vous pouvez maintenant recevoir des patients.</p><p>L'équipe M-Santé</p>`,
  },
  account_welcome: {
    title: 'Bienvenue sur M-Santé 👋',
    emailSubject: 'Bienvenue sur M-Santé !',
    emailHtml: (_d) => `<p>Bonjour,</p><p>Bienvenue sur M-Santé ! Votre compte est prêt — vous pouvez dès maintenant consulter des praticiens et prendre rendez-vous.</p><p>L'équipe M-Santé</p>`,
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
  'account.welcome':          'account_welcome',
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
        role?: Role
      }>
      data: Data
    }

    const { template_key, recipients, data } = body

    if (!template_key || !recipients?.length) {
      return new Response(JSON.stringify({ error: 'template_key and recipients are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if this workflow template is active. Filters is_active in the
    // query itself (not after fetching) and takes just one row — the admin
    // UI's create-if-missing logic can end up with duplicate rows sharing
    // the same template_key (e.g. a double-click), and .maybeSingle() would
    // throw "multiple rows returned" on that; the error was previously
    // swallowed (never checked), silently reporting workflow_inactive even
    // when an active row genuinely existed.
    const { data: activeWorkflows, error: workflowErr } = await supabase
      .from('workflows')
      .select('id, is_active')
      .filter('trigger_config->>template_key', 'eq', template_key)
      .eq('is_active', true)
      .limit(1)

    if (workflowErr) {
      console.error('send-workflow-notification: workflow lookup failed', workflowErr)
      return new Response(JSON.stringify({ error: workflowErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!activeWorkflows?.length) {
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
    const fromEmail = Deno.env.get('FROM_EMAIL') ?? 'notifications@m-sante.com'

    let sent = 0
    const errors: string[] = []

    await Promise.allSettled(
      recipients.map(async (r) => {
        try {
          const role: Role = r.role ?? 'patient'
          if (r.email && resendKey) {
            await sendEmail(resendKey, fromEmail, r.email, tpl.emailSubject, tpl.emailHtml(data, role))
            await supabase.from('notifications').insert({
              user_id: r.user_id, type: eventType, title: tpl.title,
              body: tpl.emailSubject, data: {}, channel: 'email',
              status: 'sent', sent_at: new Date().toISOString(),
            })
          }
          if (r.phone && waToken && waPhoneId) {
            const msg = genericWhatsAppMessage(r.full_name)
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
