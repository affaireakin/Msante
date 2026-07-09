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

// Public endpoint — the invitee has no account yet, so this cannot require a
// user JWT. It only ever returns non-sensitive fields needed to render the
// "create your account" step, and never mutates the invitation (acceptance —
// after the account exists — is a separate, authenticated step).
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { invitation_id, otp } = await req.json() as { invitation_id?: string; otp?: string }
    if (!invitation_id || !otp) return json({ error: 'invitation_id and otp are required' }, 400)

    const { data: invitation } = await supabase
      .from('practitioner_invitations')
      .select(`
        id, firstname, lastname, email, phone, otp, status, expires_at, organization_id, account_type,
        organizations(name),
        invited_by:invited_by_practitioner_id ( users!practitioners_user_id_fkey(full_name) )
      `)
      .eq('id', invitation_id)
      .single()

    if (!invitation) return json({ error: 'Invitation not found' }, 404)
    if (invitation.status !== 'pending') return json({ error: 'Cette invitation n\'est plus valide.' }, 400)
    if (new Date(invitation.expires_at) < new Date()) return json({ error: 'Ce code a expiré. Demandez une nouvelle invitation.' }, 400)
    if (invitation.otp !== otp.trim()) return json({ error: 'Code incorrect.' }, 400)

    const org = invitation.organizations as unknown as { name: string } | null
    const invitedBy = invitation.invited_by as unknown as { users: { full_name: string } | null } | null

    return json({
      success: true,
      firstname: invitation.firstname,
      lastname: invitation.lastname,
      email: invitation.email,
      phone: invitation.phone,
      organization_name: org?.name ?? '',
      practitioner_name: invitedBy?.users?.full_name ?? '',
      account_type: invitation.account_type,
    })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
