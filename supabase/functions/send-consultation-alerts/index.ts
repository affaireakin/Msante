// supabase/functions/send-consultation-alerts/index.ts
// Sends push notifications to patient + practitioner 15 minutes before their consultation.
// Called every 5 minutes by pg_cron; checks window [now+14min, now+16min].
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function sendPush(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  pushToken: string,
  title: string,
  body: string,
  data: Record<string, string>,
  appointmentId: string,
  type: string,
) {
  const pushRes = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: pushToken, title, body, data, sound: 'default', priority: 'high' }),
  })

  const pushBody = await pushRes.json() as { data?: { status?: string; details?: { error?: string } } }
  const tokenInvalid = pushBody?.data?.details?.error === 'DeviceNotRegistered'
  if (tokenInvalid) {
    await supabase.from('users').update({ push_token: null }).eq('id', userId)
  }

  await supabase.from('notifications').insert({
    user_id: userId,
    type,
    title,
    body,
    data: { ...data, appointment_id: appointmentId },
    channel: 'push',
    status: tokenInvalid ? 'failed' : 'sent',
    sent_at: tokenInvalid ? null : new Date().toISOString(),
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const now = new Date()
    const windowStart = new Date(now.getTime() + 14 * 60 * 1000).toISOString()
    const windowEnd   = new Date(now.getTime() + 16 * 60 * 1000).toISOString()

    const { data: appointments, error } = await supabase
      .from('appointments')
      .select(`
        id,
        scheduled_at,
        patient:users!appointments_patient_id_fkey (id, full_name, push_token),
        practitioner:practitioners!inner (
          id,
          practitioner_user:users!practitioners_user_id_fkey (id, full_name, push_token)
        )
      `)
      .eq('status', 'confirmed')
      .gte('scheduled_at', windowStart)
      .lte('scheduled_at', windowEnd)

    if (error) {
      console.error('send-consultation-alerts: query error', error)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let sent = 0

    for (const appt of (appointments ?? [])) {
      const patient = appt.patient as {
        id: string; full_name: string; push_token: string | null
      } | null
      const practitionerUser = (appt.practitioner as {
        practitioner_user: { id: string; full_name: string; push_token: string | null } | null
      } | null)?.practitioner_user

      if (!patient) continue

      const timeStr = new Date(appt.scheduled_at as string).toLocaleTimeString('fr-FR', {
        hour: '2-digit', minute: '2-digit',
      })

      // Patient alert
      const { data: existingPatient } = await supabase
        .from('notifications')
        .select('id')
        .eq('type', 'consultation_starting')
        .eq('user_id', patient.id)
        .contains('data', { appointment_id: appt.id })
        .maybeSingle()

      if (!existingPatient && patient.push_token) {
        await sendPush(
          supabase, patient.id, patient.push_token,
          'Consultation dans 15 min 🎥',
          `Votre consultation est dans 15 minutes, à ${timeStr}.`,
          { route: `/(patient)/consultation/${appt.id}/session`, type: 'consultation_starting' },
          appt.id, 'consultation_starting',
        )
        sent++
      }

      // Practitioner alert
      if (practitionerUser) {
        const { data: existingPract } = await supabase
          .from('notifications')
          .select('id')
          .eq('type', 'consultation_starting')
          .eq('user_id', practitionerUser.id)
          .contains('data', { appointment_id: appt.id })
          .maybeSingle()

        if (!existingPract && practitionerUser.push_token) {
          await sendPush(
            supabase, practitionerUser.id, practitionerUser.push_token,
            'Consultation dans 15 min 🎥',
            `Votre patient ${patient.full_name} vous attend dans 15 minutes, à ${timeStr}.`,
            { route: '/(practitioner)/appointments', type: 'consultation_starting' },
            appt.id, 'consultation_starting',
          )
          sent++
        }
      }
    }

    return new Response(JSON.stringify({ sent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('send-consultation-alerts: unhandled error', e)
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
