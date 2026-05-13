import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { appointment_id, new_status } = await req.json()

  if (new_status !== 'no_show') {
    return new Response(JSON.stringify({ skipped: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const { data: appt } = await supabase
    .from('appointments')
    .select('patient_id, practitioner_id')
    .eq('id', appointment_id)
    .single()

  if (!appt) return new Response('Not found', { status: 404 })

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

  if (noShowCount >= alertThreshold) {
    const { data: practitioner } = await supabase
      .from('practitioners')
      .select('user_id')
      .eq('id', appt.practitioner_id)
      .single()

    if (practitioner) {
      const [{ data: practUser }, { data: patient }] = await Promise.all([
        supabase.from('users').select('push_token, full_name').eq('id', practitioner.user_id).single(),
        supabase.from('users').select('full_name').eq('id', appt.patient_id).single(),
      ])

      const patientName = patient?.full_name ?? 'Un patient'
      const body = `${patientName} a manqué ${noShowCount} RDV. Voulez-vous le restreindre ?`

      if (practUser?.push_token) {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: practUser.push_token,
            title: 'Patient absent ⚠️',
            body,
            data: {
              route: '/(practitioner)/patients',
              patient_id: appt.patient_id,
              practitioner_id: appt.practitioner_id,
            },
          }),
        })
      }

      await supabase.from('notifications').insert({
        user_id: practitioner.user_id,
        type: 'no_show_alert',
        title: 'Patient absent ⚠️',
        body,
        data: { patient_id: appt.patient_id, no_show_count: noShowCount },
        channel: 'push',
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
    }
  }

  return new Response(JSON.stringify({ no_show_count: noShowCount }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})
