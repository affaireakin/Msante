import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function sendEmail(apiKey: string, from: string, to: string, name: string, reason?: string): Promise<void> {
  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#f8f9ff;">
      <div style="background:#006685;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:20px;font-weight:800;">M-Santé Clinical Portal</h1>
      </div>
      <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;">
        <h2 style="color:#0b1c30;font-size:18px;margin-top:0;">Votre demande n'a malheureusement pas pu être validée</h2>
        <p style="color:#3f484d;line-height:1.6;">Bonjour Dr. <strong>${name}</strong>,</p>
        <p style="color:#3f484d;line-height:1.6;">
          Certaines informations ou certains documents nécessitent des corrections.
          Merci de vous reconnecter afin de consulter les éléments demandés puis de soumettre à nouveau votre dossier.
        </p>
        ${reason ? `<p style="color:#3f484d;line-height:1.6;background:#f8f9ff;border-radius:10px;padding:14px 16px;"><strong>Motif :</strong> ${reason}</p>` : ''}
        <div style="text-align:center;margin:32px 0;">
          <a href="https://m-sante.app/practitioner" style="background:#006685;color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">
            Reprendre mon dossier
          </a>
        </div>
        <p style="color:#6f787e;font-size:13px;margin-bottom:0;">L'équipe M-Santé · Votre santé, notre priorité</p>
      </div>
    </div>
  `
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from,
      to,
      subject: 'Votre demande M-Santé nécessite des corrections',
      html,
    }),
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: callerProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (callerProfile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { practitionerUserId, reason } = await req.json() as { practitionerUserId?: string; reason?: string }
    if (!practitionerUserId) {
      return new Response(JSON.stringify({ error: 'practitionerUserId required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: practUser } = await supabase
      .from('users')
      .select('id, full_name, push_token, email')
      .eq('id', practitionerUserId)
      .single()

    if (!practUser) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const results: Record<string, string> = {}

    // Push notification
    if (practUser.push_token) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: practUser.push_token,
          title: 'Demande à corriger',
          body: 'Votre dossier praticien nécessite des corrections avant validation.',
          data: { type: 'practitioner_rejected' },
        }),
      })
      results.push = 'sent'
    }

    // Email via Resend
    const resendKey = Deno.env.get('RESEND_API_KEY')
    const fromEmail = Deno.env.get('FROM_EMAIL') ?? 'notifications@m-sante.com'
    if (practUser.email && resendKey) {
      try {
        await sendEmail(resendKey, fromEmail, practUser.email, practUser.full_name, reason)
        results.email = 'sent'
        await supabase.from('notifications').insert({
          user_id: practUser.id,
          type: 'practitioner_rejected',
          title: 'Demande à corriger',
          body: reason ?? 'Votre dossier praticien nécessite des corrections avant validation.',
          data: {},
          channel: 'email',
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
      } catch (e) {
        results.email = `failed: ${(e as Error).message}`
      }
    }

    // Push notification record
    await supabase.from('notifications').insert({
      user_id: practUser.id,
      type: 'practitioner_rejected',
      title: 'Votre demande nécessite des corrections',
      body: reason ?? "Certaines informations ou certains documents nécessitent des corrections. Merci de vous reconnecter afin de consulter les éléments demandés puis de soumettre à nouveau votre dossier.",
      data: {},
      channel: 'push',
      status: practUser.push_token ? 'sent' : 'pending',
      sent_at: practUser.push_token ? new Date().toISOString() : null,
    })

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
