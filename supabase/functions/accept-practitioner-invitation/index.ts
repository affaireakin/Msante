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
    if (authError || !user || !user.email) return json({ error: 'Unauthorized' }, 401)

    const { invitation_id } = await req.json() as { invitation_id?: string }
    if (!invitation_id) return json({ error: 'invitation_id is required' }, 400)

    const { data: invitation } = await supabase
      .from('practitioner_invitations')
      .select('id, organization_id, invited_by_practitioner_id, email, status, expires_at, account_type, role_id')
      .eq('id', invitation_id)
      .single()

    if (!invitation) return json({ error: 'Invitation not found' }, 404)
    if (invitation.status !== 'pending') return json({ error: 'Cette invitation a déjà été utilisée.' }, 400)
    if (new Date(invitation.expires_at) < new Date()) return json({ error: 'Ce code a expiré.' }, 400)
    // The freshly-created account's email must match the invitation exactly —
    // prevents a different logged-in user from claiming someone else's invite link.
    if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
      return json({ error: 'Cette invitation ne correspond pas à votre compte.' }, 403)
    }

    // Personal secretary invite (issued directly by a practitioner, no org).
    // Verifying the invite email only proves identity — it used to also grant
    // full access instantly, with no super admin oversight at all. Now it
    // lands as 'pending': is_practitioner_secretary() only matches 'active',
    // so the account is fully locked out until an admin approves it below.
    if (invitation.account_type === 'secretary' && invitation.invited_by_practitioner_id) {
      await supabase.from('users').update({ role: 'secretary', organization_id: null }).eq('id', user.id)

      await supabase.from('practitioner_secretaries').upsert({
        practitioner_id: invitation.invited_by_practitioner_id,
        user_id: user.id,
        status: 'pending',
      }, { onConflict: 'practitioner_id,user_id' })

      await supabase.from('practitioner_invitations').update({ status: 'used' }).eq('id', invitation.id)

      await supabase.from('audit_logs').insert({
        actor_id: user.id,
        action: 'secretary.accept_invitation',
        resource_type: 'practitioner_invitation',
        resource_id: invitation.id,
        new_values: { invited_by_practitioner_id: invitation.invited_by_practitioner_id },
      })

      try {
        const { data: admins } = await supabase.from('users').select('id').eq('role', 'admin')
        const { data: practUser } = await supabase
          .from('practitioners').select('users!user_id(full_name)').eq('id', invitation.invited_by_practitioner_id).single()
        const practName = (practUser?.users as unknown as { full_name: string } | null)?.full_name ?? 'un praticien'
        if (admins?.length) {
          await supabase.from('notifications').insert(admins.map(a => ({
            user_id: a.id,
            type: 'secretary_pending_approval',
            title: 'Secrétaire à valider',
            body: `${user.email} a été invité(e) par ${practName} et attend votre validation.`,
            data: { practitioner_id: invitation.invited_by_practitioner_id, secretary_user_id: user.id },
            channel: 'push',
          })))
        }
      } catch (notifErr) {
        console.error('accept-practitioner-invitation: admin notify failed', notifErr)
      }

      return json({ success: true, pending_approval: true, organization_id: null, account_type: 'secretary', role: 'secretary' })
    }

    const isPractitioner = invitation.account_type === 'practitioner'

    // A collaborator assigned the org's "Secrétaire" system role gets the same
    // dedicated role/dashboard as a personal secretary — org_id/user_roles are
    // still set normally so org-scoped RBAC permissions keep working.
    let finalRole: 'practitioner' | 'organization_member' | 'secretary' = isPractitioner ? 'practitioner' : 'organization_member'
    if (!isPractitioner && invitation.role_id) {
      const { data: role } = await supabase.from('org_roles').select('name').eq('id', invitation.role_id).maybeSingle()
      if (role?.name === 'Secrétaire') finalRole = 'secretary'
    }

    // Attach the account to the organization.
    await supabase.from('users').update({
      role: finalRole,
      organization_id: invitation.organization_id,
    }).eq('id', user.id)

    if (isPractitioner) {
      // Create the practitioner row (speciality left blank — filled during the
      // standard practitioner onboarding that follows, same as any other practitioner).
      const { data: existing } = await supabase.from('practitioners').select('id').eq('user_id', user.id).maybeSingle()
      if (!existing) {
        await supabase.from('practitioners').insert({
          user_id: user.id,
          speciality: '',
          organization_id: invitation.organization_id,
          verification_status: 'pending',
        })
      } else {
        await supabase.from('practitioners').update({ organization_id: invitation.organization_id }).eq('id', existing.id)
      }
    } else if (invitation.role_id) {
      // Collaborator with a role pre-assigned at invite time.
      await supabase.from('user_roles').insert({
        user_id: user.id,
        role_id: invitation.role_id,
        organization_id: invitation.organization_id,
      })
    }

    await supabase.from('practitioner_invitations').update({ status: 'used' }).eq('id', invitation.id)

    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: isPractitioner ? 'practitioner.accept_invitation' : 'collaborator.accept_invitation',
      resource_type: 'practitioner_invitation',
      resource_id: invitation.id,
      new_values: { organization_id: invitation.organization_id },
    })

    return json({ success: true, organization_id: invitation.organization_id, account_type: invitation.account_type, role: finalRole })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
