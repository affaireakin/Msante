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
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { appointmentId } = await req.json()

    if (!appointmentId || typeof appointmentId !== 'string') {
      return new Response(JSON.stringify({ error: 'appointmentId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 1. Vérifie appointment confirmé + payé + appartient au patient
    const { data: appointment, error: aErr } = await supabase
      .from('appointments')
      .select('id, status, patient_id, practitioner_id')
      .eq('id', appointmentId)
      .eq('patient_id', user.id)
      .single()

    if (aErr || !appointment) {
      return new Response(JSON.stringify({ error: 'Appointment not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (appointment.status !== 'confirmed') {
      return new Response(JSON.stringify({ error: 'Appointment not confirmed' }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Vérifie si consultation déjà créée (idempotent)
    const { data: existing } = await supabase
      .from('consultations')
      .select('id, room_url, patient_token, status')
      .eq('appointment_id', appointmentId)
      .neq('status', 'ended')
      .maybeSingle()

    if (existing) {
      return new Response(JSON.stringify({
        consultationId: existing.id,
        roomUrl: existing.room_url,
        patientToken: existing.patient_token,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const DAILY_API_KEY = Deno.env.get('DAILY_API_KEY')!
    const roomName = `msante-${appointmentId.replace(/-/g, '').slice(0, 20)}`
    const expiry = Math.floor(Date.now() / 1000) + 7200 // 2h

    // 3. Créer la room Daily.co
    const roomRes = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DAILY_API_KEY}`,
      },
      body: JSON.stringify({
        name: roomName,
        properties: {
          exp: expiry,
          max_participants: 2,
          enable_chat: false,
          enable_screenshare: false,
          start_video_off: false,
          start_audio_off: false,
        },
      }),
    })

    if (!roomRes.ok) {
      const err = await roomRes.text()
      throw new Error(`Daily.co room creation failed: ${err}`)
    }

    const room = await roomRes.json()

    // 4. Générer patient_token (is_owner: false)
    const patientTokenRes = await fetch('https://api.daily.co/v1/meeting-tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DAILY_API_KEY}`,
      },
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          exp: expiry,
          is_owner: false,
          user_name: 'Patient',
        },
      }),
    })
    if (!patientTokenRes.ok) {
      const err = await patientTokenRes.text()
      throw new Error(`Daily.co patient token failed: ${err}`)
    }
    const { token: patientToken } = await patientTokenRes.json()

    // 5. Générer practitioner_token (is_owner: true)
    const practTokenRes = await fetch('https://api.daily.co/v1/meeting-tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DAILY_API_KEY}`,
      },
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          exp: expiry,
          is_owner: true,
          user_name: 'Praticien',
        },
      }),
    })
    if (!practTokenRes.ok) {
      const err = await practTokenRes.text()
      throw new Error(`Daily.co practitioner token failed: ${err}`)
    }
    const { token: practitionerToken } = await practTokenRes.json()

    // 6. INSERT consultation
    const { data: consultation, error: cErr } = await supabase
      .from('consultations')
      .insert({
        appointment_id: appointmentId,
        room_name: roomName,
        room_url: room.url,
        patient_token: patientToken,
        practitioner_token: practitionerToken,
        status: 'waiting',
      })
      .select('id')
      .single()

    if (cErr || !consultation) throw new Error('Failed to save consultation')

    // Notify practitioner that patient entered the waiting room (fire-and-forget)
    try {
      const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? ''
      const notifService = createNotificationService(supabase, resendApiKey)

      const { data: practData } = await supabase
        .from('practitioners')
        .select('user_id')
        .eq('id', appointment.practitioner_id)
        .single()

      if (practData?.user_id) {
        const { data: practUser } = await supabase
          .from('users')
          .select('id, full_name, email, push_token')
          .eq('id', practData.user_id)
          .single()

        const { data: patientData } = await supabase
          .from('users')
          .select('full_name')
          .eq('id', user.id)
          .single()

        if (practUser) {
          await notifService.send({
            type: 'consultation_starting',
            recipient: {
              id: practUser.id,
              full_name: practUser.full_name,
              email: practUser.email,
              push_token: practUser.push_token,
            },
            data: {
              patientName: patientData?.full_name ?? 'Votre patient',
              appointmentId: appointmentId,
            },
          })
        }
      }
    } catch (notifErr) {
      console.error('create-consultation-room: notification failed', notifErr)
    }

    return new Response(JSON.stringify({
      consultationId: consultation.id,
      roomUrl: room.url,
      patientToken,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
