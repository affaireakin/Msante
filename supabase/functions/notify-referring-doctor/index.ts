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

  const { patient_id, practitioner_id, action } = await req.json()

  const [{ data: patient }, { data: practitioner }] = await Promise.all([
    supabase.from('users').select('full_name').eq('id', patient_id).single(),
    supabase.from('practitioners').select('user_id').eq('id', practitioner_id).single(),
  ])

  if (!patient || !practitioner) {
    return new Response('Not found', { status: 404 })
  }

  const { data: practUser } = await supabase
    .from('users')
    .select('push_token, full_name, prefix:professional_prefixes(prefix)')
    .eq('id', practitioner.user_id)
    .single()
  const practPrefix = (practUser?.prefix as unknown as { prefix: string } | null)?.prefix
  const practDisplayName = practUser?.full_name
    ? (practPrefix ? `${practPrefix} ${practUser.full_name}` : practUser.full_name)
    : 'Votre médecin'

  if (action === 'accepted' || action === 'refused') {
    // Notify the patient of the doctor's decision
    const { data: patientUser } = await supabase
      .from('users')
      .select('push_token')
      .eq('id', patient_id)
      .single()

    const title = action === 'accepted'
      ? 'Médecin traitant accepté ✅'
      : 'Désignation refusée'
    const body = action === 'accepted'
      ? `${practDisplayName} a accepté votre désignation.`
      : `${practDisplayName} n'a pas pu accepter votre désignation.`

    if (patientUser?.push_token) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: patientUser.push_token,
          title,
          body,
          data: { route: '/(patient)/profile' },
        }),
      })
    }

    await supabase.from('notifications').insert({
      user_id: patient_id,
      type: 'referring_doctor_response',
      title,
      body,
      data: { practitioner_id, action },
      channel: 'push',
      status: 'sent',
      sent_at: new Date().toISOString(),
    })
  } else {
    // Default: notify doctor of new designation request
    const title = 'Nouvelle désignation médecin traitant'
    const body = `${patient.full_name} vous désigne comme médecin traitant. Acceptez ou refusez dans votre tableau de bord.`

    if (practUser?.push_token) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: practUser.push_token,
          title,
          body,
          data: { route: '/(practitioner)/patients', patient_id },
        }),
      })
    }

    await supabase.from('notifications').insert({
      user_id: practitioner.user_id,
      type: 'referring_doctor_request',
      title,
      body,
      data: { patient_id, practitioner_id },
      channel: 'push',
      status: 'sent',
      sent_at: new Date().toISOString(),
    })
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})
