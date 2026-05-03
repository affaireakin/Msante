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

    const { practitioner_id, scheduled_at, duration_min = 60, type = 'video' } = await req.json()

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

    // Vérifie absence de chevauchement
    const scheduledDate = new Date(scheduled_at)
    const endDate = new Date(scheduledDate.getTime() + duration_min * 60 * 1000)

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
      })
      .select()
      .single()

    if (aErr) throw aErr

    // Send appointment_confirm notification to patient (fire-and-forget)
    try {
      const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? ''
      const notifService = createNotificationService(supabase, resendApiKey)

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
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
