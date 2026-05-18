import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

interface PatientRow {
  id: string
  full_name: string
  push_token: string | null
}

Deno.serve(async () => {
  try {
    // Find patients with 3 consecutive low-mood days (score < 4)
    // and no mood_low_streak notification sent in the last 24h
    const { data: patients, error } = await supabase.rpc(
      'get_low_mood_streak_patients'
    ) as { data: PatientRow[] | null; error: unknown }

    if (error) throw error
    if (!patients || patients.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { status: 200 })
    }

    let sent = 0

    for (const patient of patients) {
      // Send push notification if token exists
      if (patient.push_token) {
        const pushRes = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: patient.push_token,
            title: 'Prenez soin de vous 💙',
            body: 'Votre humeur est basse depuis quelques jours. Parler à un praticien peut aider.',
            data: { route: '/(patient)/mental-health', type: 'mood_low_streak' },
            sound: 'default',
            priority: 'high',
          }),
        })

        const pushBody = await pushRes.json() as { data?: { status?: string; details?: { error?: string } } }
        const tokenInvalid = pushBody?.data?.details?.error === 'DeviceNotRegistered'

        if (tokenInvalid) {
          await supabase.from('users').update({ push_token: null }).eq('id', patient.id)
        }
      }

      // Log notification (even without push token, for email fallback awareness)
      await supabase.from('notifications').insert({
        user_id: patient.id,
        type: 'mood_low_streak',
        title: 'Prenez soin de vous 💙',
        body: 'Votre humeur est basse depuis quelques jours. Parler à un praticien peut aider.',
        data: { route: '/(patient)/mental-health' },
        channel: patient.push_token ? 'push' : 'email',
        status: patient.push_token ? 'sent' : 'pending',
        sent_at: patient.push_token ? new Date().toISOString() : null,
      })

      sent++
    }

    return new Response(JSON.stringify({ sent }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[send-mood-alerts]', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})
