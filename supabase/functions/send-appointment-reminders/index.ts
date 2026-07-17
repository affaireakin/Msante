// supabase/functions/send-appointment-reminders/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createNotificationService } from '../../../packages/notifications/index.ts'

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

    const notifService = createNotificationService(
      supabase,
      Deno.env.get('RESEND_API_KEY') ?? '',
      Deno.env.get('WHATSAPP_TOKEN') ?? '',
      Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? '',
    )

    const now = new Date()
    // Patients choose their own lead time (reminder_hours_before, default 24h) instead
    // of everyone getting a hardcoded 24h-before reminder — fetch a wide window covering
    // every possible preference (up to 7 days) and filter per-appointment below.
    const MAX_REMINDER_HOURS = 168
    const windowStart = now.toISOString()
    const windowEnd = new Date(now.getTime() + (MAX_REMINDER_HOURS + 1) * 60 * 60 * 1000).toISOString()

    const { data: appointments, error } = await supabase
      .from('appointments')
      .select(`
        id,
        scheduled_at,
        patient:users!appointments_patient_id_fkey (id, full_name, email, push_token, whatsapp_number, reminder_hours_before),
        practitioner:practitioners!inner (
          id,
          practitioner_user:users!practitioners_user_id_fkey (id, full_name, email, push_token, whatsapp_number, reminder_hours_before)
        )
      `)
      .eq('status', 'confirmed')
      .gte('scheduled_at', windowStart)
      .lte('scheduled_at', windowEnd)

    if (error) {
      console.error('send-appointment-reminders: query error', error)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let sent = 0

    // Due within the last hour of ticking (the cron runs hourly): fires exactly
    // once per recipient since the anti-dup check below also guards it.
    function isDue(scheduledAt: Date, hoursBefore: number): boolean {
      const reminderAt = scheduledAt.getTime() - hoursBefore * 60 * 60 * 1000
      return now.getTime() >= reminderAt && now.getTime() - reminderAt < 60 * 60 * 1000
    }

    for (const appt of (appointments ?? [])) {
      const patient = appt.patient as {
        id: string; full_name: string; email: string | null
        push_token: string | null; whatsapp_number: string | null; reminder_hours_before: number | null
      } | null
      const practitionerUser = (appt.practitioner as {
        practitioner_user: {
          id: string; full_name: string; email: string | null
          push_token: string | null; whatsapp_number: string | null; reminder_hours_before: number | null
        } | null
      } | null)?.practitioner_user

      if (!patient) continue

      const scheduledDate = new Date(appt.scheduled_at as string)
      const dateStr = scheduledDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' })
      const timeStr = scheduledDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

      const patientDue = isDue(scheduledDate, patient.reminder_hours_before ?? 24)

      // Anti-duplicate: skip if already sent for this appointment
      const { data: existing } = patientDue ? await supabase
        .from('notifications')
        .select('id')
        .eq('type', 'appointment_reminder')
        .eq('user_id', patient.id)
        .contains('data', { appointment_id: appt.id })
        .maybeSingle() : { data: null }

      if (patientDue && !existing) {
        try {
          await notifService.send({
            type: 'appointment_reminder',
            recipient: {
              id: patient.id,
              full_name: patient.full_name,
              email: patient.email,
              push_token: patient.push_token,
              whatsapp_number: patient.whatsapp_number,
            },
            data: {
              practitionerName: practitionerUser?.full_name ?? 'votre praticien',
              date: dateStr,
              time: timeStr,
              appointment_id: appt.id,
            },
          })
          sent++
        } catch (err) {
          console.error('send-appointment-reminders: patient notify failed', err)
        }
      }

      // Notify practitioner (own reminder_hours_before preference, own anti-dup — different user_id)
      if (practitionerUser && isDue(scheduledDate, practitionerUser.reminder_hours_before ?? 24)) {
        const { data: existingPract } = await supabase
          .from('notifications')
          .select('id')
          .eq('type', 'appointment_reminder')
          .eq('user_id', practitionerUser.id)
          .contains('data', { appointment_id: appt.id })
          .maybeSingle()

        if (!existingPract) {
          try {
            await notifService.send({
              type: 'appointment_reminder',
              recipient: {
                id: practitionerUser.id,
                full_name: practitionerUser.full_name,
                email: practitionerUser.email,
                push_token: practitionerUser.push_token,
                whatsapp_number: practitionerUser.whatsapp_number,
              },
              data: {
                practitionerName: patient.full_name,
                date: dateStr,
                time: timeStr,
                appointment_id: appt.id,
              },
            })
            sent++
          } catch (err) {
            console.error('send-appointment-reminders: practitioner notify failed', err)
          }
        }
      }
    }

    return new Response(JSON.stringify({ sent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('send-appointment-reminders: unhandled error', e)
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
