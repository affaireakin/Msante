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

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString() // 6 digits
}

async function sendInviteEmail(apiKey: string, from: string, to: string, firstname: string, orgName: string, otp: string, inviteUrl: string): Promise<void> {
  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#f8f9ff;">
      <div style="background:#006685;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:20px;font-weight:800;">M-Santé — ${orgName}</h1>
      </div>
      <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;">
        <h2 style="color:#0b1c30;font-size:18px;margin-top:0;">Vous êtes invité(e) à rejoindre ${orgName}</h2>
        <p style="color:#3f484d;line-height:1.6;">Bonjour ${firstname},</p>
        <p style="color:#3f484d;line-height:1.6;">
          <strong>${orgName}</strong> vous invite à rejoindre M-Santé en tant que praticien. Cliquez sur le lien
          ci-dessous puis saisissez le code de vérification pour créer votre compte.
        </p>
        <div style="text-align:center;margin:24px 0;">
          <a href="${inviteUrl}" style="background:#006685;color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">
            Créer mon compte →
          </a>
        </div>
        <p style="color:#3f484d;line-height:1.6;">Votre code de vérification :</p>
        <p style="font-size:28px;font-weight:900;letter-spacing:6px;color:#006685;text-align:center;margin:12px 0;">${otp}</p>
        <p style="color:#6f787e;font-size:13px;">Ce code expire dans 72 heures.</p>
        <p style="color:#6f787e;font-size:13px;margin-bottom:0;">L'équipe M-Santé</p>
      </div>
    </div>
  `
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from, to, subject: `Invitation à rejoindre ${orgName} sur M-Santé`, html }),
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
    if (!caller) return json({ error: 'Forbidden' }, 403)

    // Organization is always derived from the caller's own profile — never
    // trusted from the request body — except for a super admin, who may target
    // any organization explicitly.
    const body = await req.json() as { firstname?: string; lastname?: string; email?: string; phone?: string; organization_id?: string }
    const organizationId = caller.role === 'admin' ? (body.organization_id ?? caller.organization_id) : caller.organization_id
    if (!organizationId) return json({ error: 'No organization context' }, 400)

    // user_has_permission() reads auth.uid() internally — must run through a
    // client carrying the CALLER's own JWT, not the service-role client (which
    // has no auth.uid() and would always evaluate to false).
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: hasPermission } = await userClient.rpc('user_has_permission', { perm_code: 'practitioner.invite' })
    if (!hasPermission) return json({ error: 'Forbidden' }, 403)

    const { firstname, lastname, email, phone } = body
    if (!firstname?.trim() || !lastname?.trim() || !email?.trim()) {
      return json({ error: 'firstname, lastname and email are required' }, 400)
    }

    const { data: org } = await supabase.from('organizations').select('id, name, status').eq('id', organizationId).single()
    if (!org) return json({ error: 'Organization not found' }, 404)
    if (org.status !== 'active') return json({ error: 'Organization is not active' }, 400)

    const otp = generateOtp()
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()

    const { data: invitation, error: insertError } = await supabase
      .from('practitioner_invitations')
      .insert({
        organization_id: organizationId,
        firstname: firstname.trim(),
        lastname: lastname.trim(),
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || null,
        otp,
        expires_at: expiresAt,
        created_by: user.id,
      })
      .select('id')
      .single()

    if (insertError || !invitation) return json({ error: insertError?.message ?? 'Failed to create invitation' }, 500)

    const baseUrl = Deno.env.get('APP_URL') ?? 'https://app.msante.sn'
    const inviteUrl = `${baseUrl}/invite/practitioner?invitation_id=${invitation.id}`

    const resendKey = Deno.env.get('RESEND_API_KEY')
    const fromEmail = Deno.env.get('FROM_EMAIL') ?? 'notifications@m-sante.sn'
    if (resendKey) {
      await sendInviteEmail(resendKey, fromEmail, email.trim(), firstname.trim(), org.name, otp, inviteUrl)
    }

    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: 'practitioner.invite',
      resource_type: 'practitioner_invitation',
      resource_id: invitation.id,
      new_values: { organization_id: organizationId, email: email.trim() },
    })

    return json({ success: true, invitation_id: invitation.id })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
