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

// QA finding: "Supprimer mon compte" only ran users.update({status:'suspended'})
// on a column nothing reads (access control reads account_status), so the
// account kept working normally after "deletion". Real, enforceable lockout
// has to happen at the Supabase Auth layer (ban) — same mechanism already
// used by set-account-status for admin-initiated suspensions. Actual data
// erasure remains a manual privacy-team follow-up within the promised 30
// days (deleting clinical/appointment history instantly and irreversibly from
// a single unauthenticated client click would be its own major risk), but the
// account is genuinely locked immediately and the request is auditable.
const TEN_YEARS = '87600h'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

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
    if (caller?.role === 'admin') return json({ error: 'Un compte administrateur ne peut pas être supprimé depuis cet écran. Contactez un autre administrateur général.' }, 400)

    const { error: banError } = await supabase.auth.admin.updateUserById(user.id, { ban_duration: TEN_YEARS })
    if (banError) return json({ error: banError.message }, 500)

    const reason = 'Suppression de compte demandée par l\'utilisateur (RGPD) — traitement des données sous 30 jours'
    const { error: updateError } = await supabase
      .from('users')
      .update({ account_status: 'suspended', status_reason: reason })
      .eq('id', user.id)
    if (updateError) return json({ error: updateError.message }, 500)

    if (caller?.role === 'practitioner') {
      await supabase.from('practitioners').update({ account_status: 'suspended', status_reason: reason }).eq('user_id', user.id)
    }

    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: 'user.deletion_requested',
      resource_type: 'user',
      resource_id: user.id,
      new_values: { account_status: 'suspended', reason },
    })

    return json({ success: true })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
