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

  const { email, role } = await req.json()
  if (!email || !role) return new Response('Missing email or role', { status: 400 })

  const validRoles = ['admin', 'moderator', 'accountant', 'practitioner']
  if (!validRoles.includes(role)) return new Response('Invalid role', { status: 400 })

  const { data: invitation, error } = await supabase
    .from('invitations')
    .insert({ email, role, invited_by: user.id })
    .select('token')
    .single()

  if (error) return new Response(JSON.stringify({ error: error.message }), {
    status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })

  const baseUrl = Deno.env.get('APP_URL') ?? 'https://app.msante.sn'
  const inviteLink = `${baseUrl}/invite?token=${invitation.token}`
  const resendKey = Deno.env.get('RESEND_API_KEY') ?? ''

  const roleLabels: Record<string, string> = {
    admin: 'Administrateur',
    moderator: 'Modérateur',
    accountant: 'Comptable',
    practitioner: 'Praticien',
  }

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'M-Santé <noreply@msante.sn>',
      to: [email],
      subject: `Invitation M-Santé — ${roleLabels[role] ?? role}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
            <div style="width:40px;height:40px;border-radius:10px;background:#e5eeff;display:flex;align-items:center;justify-content:center;">
              <span style="color:#006685;font-size:20px;">🏥</span>
            </div>
            <div>
              <h1 style="margin:0;font-size:20px;font-weight:900;color:#0b1c30;letter-spacing:-0.5px;">M-Santé</h1>
              <p style="margin:0;font-size:11px;color:#6f787e;">Health Sanctuary</p>
            </div>
          </div>
          <h2 style="color:#006685;margin-bottom:8px;">Vous êtes invité sur M-Santé</h2>
          <p style="color:#3f484d;">Vous avez été invité en tant que <strong>${roleLabels[role] ?? role}</strong>.</p>
          <p style="color:#3f484d;">Cliquez sur le lien ci-dessous pour créer votre compte. Ce lien expire dans <strong>48 heures</strong>.</p>
          <a href="${inviteLink}"
            style="display:inline-block;margin:20px 0;padding:14px 28px;background:#006685;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">
            Créer mon compte →
          </a>
          <p style="color:#6f787e;font-size:12px;border-top:1px solid #e5eeff;padding-top:16px;margin-top:8px;">
            Si vous n'attendiez pas cet email, ignorez-le. Ce lien est à usage unique.
          </p>
        </div>
      `,
    }),
  })

  if (!emailRes.ok) {
    const emailErr = await emailRes.text()
    console.error('Resend error:', emailErr)
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})
