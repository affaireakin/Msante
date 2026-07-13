import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401 })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data: caller } = await supabase
    .from('users').select('role').eq('id', user.id).single()
  if (caller?.role !== 'admin') return new Response('Forbidden', { status: 403 })

  const { practitioner_id, new_status, reason } = await req.json()
  if (!practitioner_id || !new_status || !reason) {
    return new Response('Missing practitioner_id, new_status, or reason', { status: 400 })
  }

  const validStatuses = ['active', 'suspended', 'blocked']
  if (!validStatuses.includes(new_status)) {
    return new Response('Invalid status', { status: 400 })
  }

  // Get current status
  const { data: practitioner } = await supabase
    .from('practitioners')
    .select('account_status, user_id')
    .eq('id', practitioner_id)
    .single()

  if (!practitioner) return new Response('Practitioner not found', { status: 404 })

  const oldStatus = practitioner.account_status

  // Update practitioner status
  await supabase.from('practitioners').update({
    account_status: new_status,
    status_reason: reason,
    status_changed_at: new Date().toISOString(),
    status_changed_by: user.id,
  }).eq('id', practitioner_id)

  // account_status alone was never enforced anywhere (banner-only in the
  // practitioner portal) — a "suspended"/"blocked" practitioner kept full
  // access. Ban at the Supabase Auth layer (blocks login/token refresh) and
  // keep users.account_status in sync so the layout gate below can rely on
  // a single column regardless of which admin screen triggered the change.
  const TEN_YEARS = '87600h'
  await supabase.auth.admin.updateUserById(practitioner.user_id, {
    ban_duration: new_status === 'active' ? 'none' : TEN_YEARS,
  })
  await supabase.from('users').update({ account_status: new_status }).eq('id', practitioner.user_id)

  // Log history
  await supabase.from('practitioner_status_history').insert({
    practitioner_id,
    old_status: oldStatus,
    new_status,
    reason,
    changed_by: user.id,
  })

  // If blocked: cancel future appointments
  if (new_status === 'blocked') {
    await supabase.from('appointments')
      .update({ status: 'cancelled', cancellation_reason: `Praticien bloqué: ${reason}` })
      .eq('practitioner_id', practitioner_id)
      .in('status', ['pending', 'confirmed'])
      .gte('scheduled_at', new Date().toISOString())
  }

  // Notify practitioner
  const { data: practUser } = await supabase
    .from('users')
    .select('push_token, full_name')
    .eq('id', practitioner.user_id)
    .single()

  const statusTitles: Record<string, string> = {
    active: 'Compte réactivé ✅',
    suspended: 'Compte suspendu ⚠️',
    blocked: 'Compte bloqué 🚫',
  }
  const title = statusTitles[new_status] ?? `Statut: ${new_status}`
  const body = `Motif: ${reason}`

  if (practUser?.push_token) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: practUser.push_token,
        title,
        body,
        data: { route: '/(practitioner)/profile' },
      }),
    })
  }

  await supabase.from('notifications').insert({
    user_id: practitioner.user_id,
    type: 'account_status_change',
    title,
    body,
    data: { practitioner_id, new_status, reason },
    channel: 'push',
    status: 'sent',
    sent_at: new Date().toISOString(),
  })

  return new Response(JSON.stringify({ success: true, old_status: oldStatus, new_status }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})
