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

    const { data: caller } = await supabase.from('users').select('role, organization_id').eq('id', user.id).single()
    if (!caller?.organization_id) return json({ error: 'Forbidden' }, 403)

    const { practitioner_id } = await req.json() as { practitioner_id?: string }
    if (!practitioner_id) return json({ error: 'practitioner_id is required' }, 400)

    const { data: practitioner } = await supabase
      .from('practitioners')
      .select('id, user_id, organization_id, org_validated_at, verification_status')
      .eq('id', practitioner_id)
      .single()

    if (!practitioner) return json({ error: 'Practitioner not found' }, 404)
    if (practitioner.organization_id !== caller.organization_id && caller.role !== 'admin') {
      return json({ error: 'Ce praticien n\'appartient pas à votre organisation.' }, 403)
    }

    // user_has_permission() needs auth.uid() — run through the caller's own JWT.
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: hasPermission } = await userClient.rpc('user_has_permission', { perm_code: 'practitioner.update' })
    if (!hasPermission) return json({ error: 'Forbidden' }, 403)

    await supabase.from('practitioners').update({
      org_validated_at: new Date().toISOString(),
      org_validated_by: user.id,
    }).eq('id', practitioner_id)

    await supabase.from('notifications').insert({
      user_id: practitioner.user_id,
      type: 'practitioner_org_validated',
      title: 'Validation par votre organisation ✓',
      body: 'Votre organisation a validé votre rattachement. Votre profil sera actif dès la validation finale de M-Santé.',
      data: { practitioner_id },
      channel: 'push',
      status: 'pending',
    })

    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: 'practitioner.org_validate',
      resource_type: 'practitioner',
      resource_id: practitioner_id,
      new_values: { org_validated_at: new Date().toISOString() },
    })

    return json({ success: true })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
