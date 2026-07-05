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

    const { organization_id, action, reason } = await req.json() as {
      organization_id?: string
      action?: 'suspend' | 'reactivate' | 'archive'
      reason?: string
    }
    if (!organization_id || !action) return json({ error: 'organization_id and action are required' }, 400)
    if (!reason || !reason.trim()) return json({ error: 'A reason is required' }, 400)

    const targetStatus: Record<string, string> = { suspend: 'suspended', reactivate: 'active', archive: 'archived' }
    if (!(action in targetStatus)) return json({ error: 'Invalid action' }, 400)
    const newStatus = targetStatus[action]

    const { data: org } = await supabase
      .from('organizations')
      .select('id, name, status')
      .eq('id', organization_id)
      .single()
    if (!org) return json({ error: 'Organization not found' }, 404)

    const { error: updateError } = await supabase
      .from('organizations')
      .update({ status: newStatus })
      .eq('id', organization_id)
    if (updateError) return json({ error: updateError.message }, 500)

    // Notify the org admin(s) and every practitioner attached to the org.
    const { data: members } = await supabase
      .from('users')
      .select('id, role')
      .eq('organization_id', organization_id)
      .in('role', ['organization_admin', 'practitioner'])

    const titles: Record<string, string> = {
      suspend: 'Organisation suspendue',
      reactivate: 'Organisation réactivée',
      archive: 'Organisation archivée',
    }
    const title = titles[action]
    const body = `${org.name} : ${reason}`

    if (members && members.length > 0) {
      await supabase.from('notifications').insert(
        members.map((m) => ({
          user_id: m.id,
          type: `organization_${action}`,
          title,
          body,
          data: { organization_id, reason },
          channel: 'push',
          status: 'pending',
        }))
      )
    }

    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: `organization.${action}`,
      resource_type: 'organization',
      resource_id: organization_id,
      old_values: { status: org.status },
      new_values: { status: newStatus, reason },
    })

    return json({ success: true, status: newStatus, notified: members?.length ?? 0 })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
