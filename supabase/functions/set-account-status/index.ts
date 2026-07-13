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

// Suspending/blocking a user from the admin console only ever updated the
// users.account_status column — nothing in the app actually reads that column
// to gate access, so the account kept working exactly as before. The real,
// enforceable lockout has to happen at the Supabase Auth layer (ban), which
// blocks new logins/token refresh immediately. account_status is kept in sync
// purely for UI display (badges, banners).
const TEN_YEARS = '87600h'

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

    const { data: caller } = await supabase.from('users').select('role').eq('id', user.id).single()
    if (caller?.role !== 'admin') return json({ error: 'Forbidden' }, 403)

    const { user_id: targetUserId, new_status: newStatus } = await req.json() as {
      user_id?: string; new_status?: 'active' | 'suspended' | 'blocked'
    }
    if (!targetUserId || !newStatus || !['active', 'suspended', 'blocked'].includes(newStatus)) {
      return json({ error: 'user_id and a valid new_status are required' }, 400)
    }

    const { data: target } = await supabase.from('users').select('role').eq('id', targetUserId).single()
    if (!target) return json({ error: 'User not found' }, 404)
    if (target.role === 'admin') return json({ error: 'Cannot suspend an admin account' }, 400)

    const { error: banError } = await supabase.auth.admin.updateUserById(targetUserId, {
      ban_duration: newStatus === 'active' ? 'none' : TEN_YEARS,
    })
    if (banError) return json({ error: banError.message }, 500)

    const { error: updateError } = await supabase
      .from('users')
      .update({ account_status: newStatus })
      .eq('id', targetUserId)
    if (updateError) return json({ error: updateError.message }, 500)

    // A practitioner also carries its own account_status (drives the banner
    // shown in the practitioner portal) — keep both in sync.
    await supabase.from('practitioners').update({ account_status: newStatus }).eq('user_id', targetUserId)

    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: newStatus === 'active' ? 'user.unsuspended' : 'user.suspended',
      resource_type: 'user',
      resource_id: targetUserId,
      new_values: { account_status: newStatus },
    })

    return json({ success: true, new_status: newStatus })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
