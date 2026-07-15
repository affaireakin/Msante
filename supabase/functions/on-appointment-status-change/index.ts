
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function sendPush(token: string, title: string, body: string, data: Record<string, string>) {
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: token, title, body, data, sound: 'default', priority: 'high', channelId: 'default' }),
  })
}

// Fire-and-forget call to send-workflow-notification (WhatsApp + Email)
async function triggerWorkflowNotif(
  supabaseUrl: string,
  serviceRoleKey: string,
  template_key: string,
  recipients: Array<{ user_id: string; full_name: string; email?: string | null; phone?: string | null; push_token?: string | null; role?: 'patient' | 'practitioner' }>,
  data: Record<string, string | number>,
) {
  try {
    await fetch(
      `${supabaseUrl}/functions/v1/send-workflow-notification`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ template_key, recipients, data }),
      }
    )
  } catch (err) {
    console.error('on-appointment-status-change: workflow notif failed', err)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  const { appointment_id, new_status } = await req.json()

  if (!['confirmed', 'cancelled', 'no_show'].includes(new_status)) {
    return new Response(JSON.stringify({ skipped: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const { data: appt } = await supabase
    .from('appointments')
    .select('patient_id, practitioner_id, scheduled_at, cancellation_reason')
    .eq('id', appointment_id)
    .single()

  if (!appt) return new Response('Not found', { status: 404, headers: corsHeaders })

  const { data: pract } = await supabase
    .from('practitioners')
    .select('user_id')
    .eq('id', appt.practitioner_id)
    .single()

  // ── confirmed / cancelled → notifie le patient (push) + workflow (WA + email) ─
  if (new_status === 'confirmed' || new_status === 'cancelled') {
    const [{ data: patient }, { data: practUser }] = await Promise.all([
      supabase.from('users').select('push_token, full_name, email, phone').eq('id', appt.patient_id).single(),
      supabase.from('users').select('full_name, email, phone, push_token').eq('id', pract?.user_id ?? '').single(),
    ])

    const scheduledDate = new Date(appt.scheduled_at as string)
    const dateStr = scheduledDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' })
    const timeStr = scheduledDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    const practName = practUser?.full_name ?? 'votre praticien'
    const patientName = patient?.full_name ?? 'Votre patient'

    const isConfirmed = new_status === 'confirmed'
    const title = isConfirmed ? 'RDV confirmé ✓' : 'Demande refusée'
    const body = isConfirmed
      ? `Votre RDV avec ${practName} le ${dateStr} à ${timeStr} est confirmé.`
      : `Votre demande de RDV avec ${practName} le ${dateStr} n'a pas pu être acceptée.`
    const route = isConfirmed ? '/(patient)/appointments' : '/(patient)/find-practitioners'

    // Push notification
    if (patient?.push_token) {
      await sendPush(patient.push_token, title, body, { route, appointment_id })
    }

    await supabase.from('notifications').insert({
      user_id: appt.patient_id,
      type: isConfirmed ? 'appointment_confirm' : 'appointment_cancelled',
      title,
      body,
      data: { appointment_id, route },
      channel: 'push',
      status: patient?.push_token ? 'sent' : 'pending',
      sent_at: patient?.push_token ? new Date().toISOString() : null,
    })

    // WhatsApp + Email via workflow (fire-and-forget)
    const templateKey = isConfirmed ? 'appointment.confirmed' : 'appointment.cancelled'
    const notifData = {
      practitionerName: practName,
      patientName,
      date: dateStr,
      time: timeStr,
      reason: (appt.cancellation_reason as string | null) ?? '',
      appointment_id,
    }

    const patientRecipient = patient
      ? [{ user_id: appt.patient_id, full_name: patient.full_name, email: patient.email, phone: patient.phone, push_token: null, role: 'patient' as const }]
      : []

    const practRecipient = (pract?.user_id && practUser)
      ? [{ user_id: pract.user_id, full_name: practUser.full_name, email: practUser.email, phone: practUser.phone, push_token: null, role: 'practitioner' as const }]
      : []

    void triggerWorkflowNotif(SUPABASE_URL, SERVICE_ROLE_KEY, templateKey, [...patientRecipient, ...practRecipient], notifData)

    return new Response(JSON.stringify({ notified: 'patient', status: new_status }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // ── no_show → alerte praticien si absences répétées ───────────────────────
  if (new_status === 'no_show') {
    const { count } = await supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('patient_id', appt.patient_id)
      .eq('practitioner_id', appt.practitioner_id)
      .eq('status', 'no_show')

    const noShowCount = count ?? 0

    const { data: rules } = await supabase
      .from('practitioner_patient_rules')
      .select('alert_threshold')
      .eq('practitioner_id', appt.practitioner_id)
      .maybeSingle()

    const alertThreshold = rules?.alert_threshold ?? 2

    if (noShowCount >= alertThreshold && pract?.user_id) {
      const [{ data: practUser }, { data: patient }] = await Promise.all([
        supabase.from('users').select('push_token, full_name').eq('id', pract.user_id).single(),
        supabase.from('users').select('full_name').eq('id', appt.patient_id).single(),
      ])

      const patientName = patient?.full_name ?? 'Un patient'
      const title = 'Patient absent ⚠️'
      const body = `${patientName} a manqué ${noShowCount} RDV. Voulez-vous le restreindre ?`

      if (practUser?.push_token) {
        await sendPush(practUser.push_token, title, body, {
          route: '/(practitioner)/patients',
          patient_id: appt.patient_id,
        })
      }

      await supabase.from('notifications').insert({
        user_id: pract.user_id,
        type: 'no_show_alert',
        title,
        body,
        data: { patient_id: appt.patient_id, no_show_count: String(noShowCount) },
        channel: 'push',
        status: practUser?.push_token ? 'sent' : 'pending',
        sent_at: practUser?.push_token ? new Date().toISOString() : null,
      })
    }

    return new Response(JSON.stringify({ no_show_count: noShowCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  return new Response(JSON.stringify({ skipped: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})
