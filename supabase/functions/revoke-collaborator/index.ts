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

// QA finding: there was no way to revoke a collaborator's access — setting
// their org_roles assignment to "Aucun rôle" only cleared RBAC permissions,
// they stayed attached to the organization (organization_id unchanged) and
// could still log in with their organization_member/secretary dashboard.
// org_admin_update_org_members's WITH CHECK requires is_org_admin(NEW row's
// organization_id), which is never true for organization_id = NULL — a
// direct client update can't actually clear it, so this has to go through a
// service-role function instead.
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

    const { data: caller } = await supabase.from('users').select('role, organization_id').eq('id', user.id).single()
    if (!caller || caller.role !== 'organization_admin' || !caller.organization_id) {
      return json({ error: 'Forbidden' }, 403)
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: hasPermission } = await userClient.rpc('user_has_permission', { perm_code: 'users.manage' })
    if (!hasPermission) return json({ error: 'Forbidden' }, 403)

    const { target_user_id: targetUserId } = await req.json() as { target_user_id?: string }
    if (!targetUserId) return json({ error: 'target_user_id is required' }, 400)

    const { data: target } = await supabase.from('users').select('role, organization_id, full_name').eq('id', targetUserId).single()
    if (!target || target.organization_id !== caller.organization_id) {
      return json({ error: 'User not found in your organization' }, 404)
    }
    if (!['organization_member', 'secretary'].includes(target.role)) {
      return json({ error: 'Only collaborators can be revoked from this screen' }, 400)
    }

    await supabase.from('user_roles').delete().eq('user_id', targetUserId).eq('organization_id', caller.organization_id)

    const { error: updateError } = await supabase
      .from('users')
      .update({ organization_id: null, role: 'patient' })
      .eq('id', targetUserId)
    if (updateError) return json({ error: updateError.message }, 500)

    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: 'collaborator.revoked',
      resource_type: 'user',
      resource_id: targetUserId,
      old_values: { organization_id: caller.organization_id, role: target.role },
    })

    return json({ success: true })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
