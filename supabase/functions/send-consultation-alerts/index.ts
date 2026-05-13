// supabase/functions/send-consultation-alerts/index.ts
// Sends push notifications to patient + practitioner 15 minutes before their consultation.
// Called every 5 minutes by pg_cron; checks window [now+14min, now+16min].
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createNotificationService } from '../../packages/notifications/index.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? ''
    const notifService = createNotificationService(supabase, resendApiKey)

    const now = new Date()
    const windowStart = new Date(now.getTime() + 14 * 60 * 1000).toISOString()
    const windowEnd   = new Date(now.getTime() + 16 * 60 * 1000).toISOString()

    const { data: appointments, error } = await supabase
      .from('appointments')
      .select(`
        id,
        scheduled_at,
        type,
        patient:users!appointments_patient_id_fkey (id, full_name, email, push_token),
        practitioner:practitioners!inner (
          id,
          practitioner_user:users!practitioners_user_id_fkey (id, full_name, email, push_token)
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
        id: string; full_name: string; email: string | null; push_token: string | null
      } | null
      const practitionerUser = (appt.practitioner as {
        practitioner_user: { id: string; full_name: string; email: string | null; push_token: string | null } | null
      } | null)?.practitioner_user

      if (!patient) continue

      const timeStr = new Date(appt.scheduled_at as string).toLocaleTimeString('fr-FR', {
        hour: '2-digit', minute: '2-digit',
      })

      // --- Patient alert ---
      const { data: existingPatient } = await supabase
        .from('notifications')
        .select('id')
        .eq('type', 'consultation_starting')
        .eq('user_id', patient.id)
        .contains('data', { appointment_id: appt.id })
        .maybeSingle()

      if (!existingPatient) {
        await notifService.send({
          type: 'consultation_starting',
          recipient: {
            id: patient.id,
            full_name: patient.full_name,
            email: patient.email,
            push_token: patient.push_token,
          },
          data: {
            practitionerName: practitionerUser?.full_name ?? 'votre praticien',
            time: timeStr,
            appointment_id: appt.id,
          },
        })
        sent++
      }

      // --- Practitioner alert ---
      if (practitionerUser) {
        const { data: existingPract } = await supabase
          .from('notifications')
          .select('id')
          .eq('type', 'consultation_starting')
          .eq('user_id', practitionerUser.id)
          .contains('data', { appointment_id: appt.id })
          .maybeSingle()

        if (!existingPract) {
          await notifService.send({
            type: 'consultation_starting',
            recipient: {
              id: practitionerUser.id,
              full_name: practitionerUser.full_name,
              email: practitionerUser.email,
              push_token: practitionerUser.push_token,
            },
            data: {
              patientName: patient.full_name,
              time: timeStr,
              appointment_id: appt.id,
            },
          })
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
