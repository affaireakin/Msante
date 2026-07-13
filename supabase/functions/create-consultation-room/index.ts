import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── LiveKit JWT (Deno crypto, no external SDK needed) ─────────────────────────

async function createLiveKitToken(
  apiKey: string,
  apiSecret: string,
  identity: string,
  displayName: string,
  roomName: string,
  canPublish = true,
  ttl = 7200,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)

  const b64url = (obj: unknown) =>
    btoa(JSON.stringify(obj))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')

  const header = b64url({ alg: 'HS256', typ: 'JWT' })
  const payload = b64url({
    iss: apiKey,
    sub: identity,
    iat: now,
    nbf: now,
    exp: now + ttl,
    name: displayName,
    video: {
      room: roomName,
      roomJoin: true,
      canPublish,
      canSubscribe: true,
      canPublishData: true,
    },
  })

  const signingInput = `${header}.${payload}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(apiSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput))
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuf)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')

  return `${signingInput}.${sig}`
}

// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    )
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: caller } = await supabase.from('users').select('account_status').eq('id', user.id).single()
    if (caller?.account_status === 'suspended' || caller?.account_status === 'blocked') {
      return new Response(JSON.stringify({ error: 'Votre compte est suspendu.' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { appointmentId } = await req.json()
    if (!appointmentId || typeof appointmentId !== 'string') {
      return new Response(JSON.stringify({ error: 'appointmentId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 1. Vérifie appointment confirmé + appartient au patient
    const { data: appointment, error: aErr } = await supabase
      .from('appointments')
      .select('id, status, patient_id, practitioner_id, scheduled_at, duration_min')
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

    // Enforce the same 5-min-before / duration-after window the client UI
    // shows — previously UI-only, so any authenticated patient could call this
    // endpoint directly and open a room far ahead of or after their slot.
    const scheduledAt = new Date(appointment.scheduled_at).getTime()
    const durationMin = appointment.duration_min ?? 60
    const windowOpen = scheduledAt - 5 * 60 * 1000
    const windowClose = scheduledAt + durationMin * 60 * 1000
    const now = Date.now()
    if (now < windowOpen) {
      return new Response(JSON.stringify({ error: 'Trop tôt pour rejoindre cette consultation.' }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (now > windowClose) {
      return new Response(JSON.stringify({ error: 'Cette consultation est terminée.' }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Idempotent — retourne la consultation existante si déjà créée
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

    // 3. Génère les tokens LiveKit
    const LIVEKIT_API_KEY = Deno.env.get('LIVEKIT_API_KEY')!
    const LIVEKIT_API_SECRET = Deno.env.get('LIVEKIT_API_SECRET')!
    const LIVEKIT_WS_URL = Deno.env.get('LIVEKIT_WS_URL')! // ex: wss://msante.livekit.cloud

    const roomName = `msante-${appointmentId.replace(/-/g, '').slice(0, 20)}`

    const [patientToken, practitionerToken] = await Promise.all([
      createLiveKitToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, `patient-${user.id}`, 'Patient', roomName, true),
      createLiveKitToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, `pract-${appointment.practitioner_id}`, 'Praticien', roomName, true),
    ])

    // 4. Insert consultation
    const { data: consultation, error: cErr } = await supabase
      .from('consultations')
      .insert({
        appointment_id: appointmentId,
        room_name: roomName,
        room_url: LIVEKIT_WS_URL,
        patient_token: patientToken,
        practitioner_token: practitionerToken,
        status: 'waiting',
      })
      .select('id')
      .single()

    if (cErr || !consultation) throw new Error('Failed to save consultation')

    // 5. Notifie le praticien (fire-and-forget)
    try {
      const { data: practData } = await supabase
        .from('practitioners')
        .select('user_id')
        .eq('id', appointment.practitioner_id)
        .single()

      if (practData?.user_id) {
        const [{ data: practUser }, { data: patientData }] = await Promise.all([
          supabase.from('users').select('push_token').eq('id', practData.user_id).single(),
          supabase.from('users').select('full_name').eq('id', user.id).single(),
        ])

        const patientName = patientData?.full_name ?? 'Votre patient'
        const notifTitle = 'Patient prêt pour la consultation'
        const notifBody = `${patientName} est dans la salle d'attente.`

        // Notification web (cloche)
        await supabase.from('notifications').insert({
          user_id: practData.user_id,
          type: 'consultation_starting',
          title: notifTitle,
          body: notifBody,
          channel: 'push',
          data: { appointment_id: appointmentId, consultation_id: consultation.id },
        })

        // Push Expo mobile
        if (practUser?.push_token) {
          await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: practUser.push_token,
              title: notifTitle,
              body: notifBody,
              data: { route: '/(practitioner)/appointments' },
            }),
          })
        }
      }
    } catch (notifErr) {
      console.error('create-consultation-room: notification failed', notifErr)
    }

    return new Response(JSON.stringify({
      consultationId: consultation.id,
      roomUrl: LIVEKIT_WS_URL,
      patientToken,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
