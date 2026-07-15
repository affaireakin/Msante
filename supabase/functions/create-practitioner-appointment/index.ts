import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Unlike create-appointment (patient self-booking, patient_id = caller),
// this lets a practitioner — or a secretary they've delegated appointment
// management to — schedule a RDV directly for one of their patients, e.g.
// after agreeing a follow-up slot by phone/message. No payment step: the
// appointment is created already 'confirmed' since the practitioner is the
// one initiating it.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)

    const { data: caller } = await supabase.from('users').select('account_status').eq('id', user.id).single()
    if (caller?.account_status === 'suspended' || caller?.account_status === 'blocked') {
      return json({ error: 'Votre compte est suspendu.' }, 403)
    }

    const {
      practitioner_id, patient_id, scheduled_at, duration_min = 60,
      type = 'video', service_id,
    } = await req.json() as {
      practitioner_id?: string; patient_id?: string; scheduled_at?: string
      duration_min?: number; type?: string; service_id?: string
    }

    if (!practitioner_id || !patient_id || !scheduled_at) {
      return json({ error: 'practitioner_id, patient_id and scheduled_at are required' }, 400)
    }

    // Caller must be the practitioner themself, or an active secretary delegated by them.
    const { data: practitioner } = await supabase
      .from('practitioners')
      .select('id, user_id, verification_status')
      .eq('id', practitioner_id)
      .single()
    if (!practitioner) return json({ error: 'Practitioner not found' }, 404)

    const isOwner = practitioner.user_id === user.id
    let isSecretary = false
    if (!isOwner) {
      const { data: sec } = await supabase
        .from('practitioner_secretaries')
        .select('id')
        .eq('practitioner_id', practitioner_id)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()
      isSecretary = !!sec
    }
    if (!isOwner && !isSecretary) return json({ error: 'Forbidden' }, 403)

    if (practitioner.verification_status !== 'approved') {
      return json({ error: 'Practitioner not verified' }, 422)
    }

    const { data: patient } = await supabase.from('users').select('id, role, full_name, email, push_token').eq('id', patient_id).single()
    if (!patient || patient.role !== 'patient') return json({ error: 'Patient not found' }, 404)

    const scheduledDate = new Date(scheduled_at)
    const endDate = new Date(scheduledDate.getTime() + duration_min * 60 * 1000)

    // Overlap check — same rule as patient self-booking.
    const { data: conflicts } = await supabase
      .from('appointments')
      .select('id')
      .eq('practitioner_id', practitioner_id)
      .not('status', 'in', '("cancelled","no_show")')
      .lt('scheduled_at', endDate.toISOString())
      .gt('scheduled_at', new Date(scheduledDate.getTime() - duration_min * 60 * 1000).toISOString())

    if (conflicts && conflicts.length > 0) {
      return json({ error: 'Ce créneau est déjà pris.' }, 409)
    }

    const { data: appointment, error: aErr } = await supabase
      .from('appointments')
      .insert({
        patient_id,
        practitioner_id,
        scheduled_at,
        duration_min,
        type,
        // A practitioner-created RDV must be accepted by the patient, not
        // auto-confirmed — the patient gets an Accepter/Refuser action on
        // their appointments page (see created_by-gated UI).
        status: 'pending',
        created_by: 'practitioner',
        ...(service_id ? { service_id } : {}),
      })
      .select()
      .single()

    if (aErr) throw aErr

    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: 'appointment.created_by_practitioner',
      resource_type: 'appointment',
      resource_id: appointment.id,
      new_values: { practitioner_id, patient_id, scheduled_at },
    })

    // Notify the patient (fire-and-forget) — best-effort, matches the pattern
    // used by join-consultation rather than the full adapter stack in
    // create-appointment, since this is a much narrower notification.
    try {
      const apptDate = new Date(scheduled_at)
      const dateTimeStr = apptDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
        + ' à ' + apptDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      const { data: practUser } = await supabase.from('users').select('full_name').eq('id', practitioner.user_id).single()
      const title = 'Rendez-vous à confirmer'
      const body = `${practUser?.full_name ?? 'Votre praticien'} vous propose un RDV le ${dateTimeStr}. Confirmez-le dans votre espace patient.`

      await supabase.from('notifications').insert({
        user_id: patient_id, type: 'appointment_confirm', title, body, channel: 'push',
        data: { appointment_id: appointment.id },
      })

      if (patient.push_token) {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: patient.push_token, title, body, data: { route: '/(patient)/appointments' } }),
        })
      }
    } catch (notifErr) {
      console.error('create-practitioner-appointment: notification failed', notifErr)
    }

    return json({ appointmentId: appointment.id })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
