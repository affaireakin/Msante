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

// Called right after auth.signUp() on the invite acceptance page — at that
// point the new account has no confirmed session yet (OTP verification is
// still pending), so we can't rely on auth.uid(). Runs as service_role and
// validates the token/email/user_id triple itself instead. Without this,
// admin/collaborator invitations landed with sub_role=NULL and no granular
// role at all, which reads as a full super admin until manually fixed.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { token, user_id: userId } = await req.json() as { token?: string; user_id?: string }
    if (!token || !userId) return json({ error: 'token and user_id are required' }, 400)

    const { data: invitation, error: invError } = await supabase
      .from('invitations')
      .select('id, email, status, expires_at, role_ids')
      .eq('token', token)
      .single()
    if (invError || !invitation) return json({ error: 'Invitation introuvable' }, 404)
    if (invitation.status !== 'pending') return json({ error: 'Cette invitation a déjà été utilisée' }, 400)
    if (new Date(invitation.expires_at) < new Date()) return json({ error: 'Cette invitation a expiré' }, 400)

    const { data: authUser, error: authErr } = await supabase.auth.admin.getUserById(userId)
    if (authErr || !authUser?.user) return json({ error: 'Utilisateur introuvable' }, 404)
    if (authUser.user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
      return json({ error: "L'utilisateur ne correspond pas à cette invitation" }, 403)
    }

    const roleIds: string[] = invitation.role_ids ?? []
    if (roleIds.length > 0) {
      const { error: rolesError } = await supabase
        .from('user_admin_roles')
        .insert(roleIds.map(role_id => ({ user_id: userId, role_id })))
      if (rolesError) return json({ error: rolesError.message }, 500)
    }

    const { error: updateError } = await supabase
      .from('invitations')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('token', token)
    if (updateError) return json({ error: updateError.message }, 500)

    return json({ success: true, roles_assigned: roleIds.length })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
