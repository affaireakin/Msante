import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

    const { consultationId } = await req.json()

    if (!consultationId || typeof consultationId !== 'string') {
      return new Response(JSON.stringify({ error: 'consultationId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 1. Récupère la consultation (sans join imbriqué)
    const { data: consultation, error: cErr } = await supabase
      .from('consultations')
      .select('id, room_url, practitioner_token, status, appointment_id')
      .eq('id', consultationId)
      .single()

    if (cErr || !consultation) {
      return new Response(JSON.stringify({ error: 'Consultation not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Vérifie que l'utilisateur est bien le praticien de ce RDV
    const { data: practCheck } = await supabase
      .from('practitioners')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!practCheck) {
      return new Response(JSON.stringify({ error: 'Forbidden: not a practitioner' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: aptCheck } = await supabase
      .from('appointments')
      .select('id')
      .eq('id', consultation.appointment_id)
      .eq('practitioner_id', practCheck.id)
      .single()

    if (!aptCheck) {
      return new Response(JSON.stringify({ error: 'Forbidden: appointment mismatch' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Update status → active (idempotent)
    const { error: uErr } = await supabase
      .from('consultations')
      .update({ status: 'active', started_at: new Date().toISOString() })
      .eq('id', consultationId)
      .eq('status', 'waiting')

    if (uErr) throw uErr

    // 4. Notifie le patient que le praticien a rejoint (fire-and-forget)
    try {
      const { data: apt } = await supabase
        .from('appointments')
        .select('patient_id, practitioners!inner(users!user_id(full_name))')
        .eq('id', consultation.appointment_id)
        .single()

      if (apt?.patient_id) {
        const practRaw = apt.practitioners as unknown as { users: { full_name: string } }
        const practName = practRaw?.users?.full_name ?? 'Votre praticien'
        const notifTitle = 'Votre praticien a rejoint la consultation'
        const notifBody = `${practName} est prêt. La séance commence maintenant.`

        // Notification web (cloche)
        await supabase.from('notifications').insert({
          user_id: apt.patient_id,
          type: 'consultation_starting',
          title: notifTitle,
          body: notifBody,
          channel: 'push',
          data: { consultation_id: consultationId, appointment_id: consultation.appointment_id },
        })

        // Push Expo mobile
        const { data: patientUser } = await supabase
          .from('users').select('push_token').eq('id', apt.patient_id).single()

        if (patientUser?.push_token) {
          await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: patientUser.push_token,
              title: notifTitle,
              body: notifBody,
              data: { route: '/(patient)/appointments' },
            }),
          })
        }
      }
    } catch (notifErr) {
      console.error('join-consultation: patient notification failed', notifErr)
    }

    return new Response(JSON.stringify({
      consultationId,
      practitionerToken: consultation.practitioner_token,
      roomUrl: consultation.room_url,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

