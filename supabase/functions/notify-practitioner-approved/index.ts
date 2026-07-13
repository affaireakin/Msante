import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function sendWhatsApp(token: string, phoneNumberId: string, to: string, name: string): Promise<void> {
  const phone = to.replace(/[^0-9]/g, '')
  const intl = phone.startsWith('0') ? `221${phone.slice(1)}` : phone
  const message = `Bonjour Dr. ${name} 🎉\n\nVotre compte praticien M-Santé a été validé ✅\n\nVous pouvez maintenant recevoir des patients et gérer votre agenda sur M-Santé Clinical Portal.\n\nL'équipe M-Santé`
  await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: intl,
      type: 'text',
      text: { body: message },
    }),
  })
}

async function sendEmail(apiKey: string, from: string, to: string, name: string): Promise<void> {
  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#f8f9ff;">
      <div style="background:#006685;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:20px;font-weight:800;">M-Santé Clinical Portal</h1>
      </div>
      <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;">
        <h2 style="color:#0b1c30;font-size:18px;margin-top:0;">Compte approuvé ✅</h2>
        <p style="color:#3f484d;line-height:1.6;">Bonjour Dr. <strong>${name}</strong>,</p>
        <p style="color:#3f484d;line-height:1.6;">
          Félicitations ! Votre profil praticien <strong>M-Santé</strong> a été validé par notre équipe.
          Vous pouvez maintenant recevoir des patients, gérer votre agenda et accéder à toutes les fonctionnalités du Clinical Portal.
        </p>
        <div style="text-align:center;margin:32px 0;">
          <a href="https://m-sante.app/practitioner" style="background:#006685;color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">
            Accéder à mon espace praticien
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
      subject: 'Votre compte praticien M-Santé est validé 🎉',
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

    const { practitionerUserId } = await req.json() as { practitionerUserId?: string }
    if (!practitionerUserId) {
      return new Response(JSON.stringify({ error: 'practitionerUserId required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: practUser } = await supabase
      .from('users')
      .select('id, full_name, push_token, email, phone, organization_id')
      .eq('id', practitionerUserId)
      .single()

    if (!practUser) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // If this practitioner belongs to an organization, notify its admin(s) too —
    // completes the double-validation loop (Super Admin approval on top of the
    // org's own org_validated_at check).
    if (practUser.organization_id) {
      const { data: orgAdmins } = await supabase
        .from('users')
        .select('id')
        .eq('organization_id', practUser.organization_id)
        .eq('role', 'organization_admin')
      if (orgAdmins && orgAdmins.length > 0) {
        await supabase.from('notifications').insert(
          orgAdmins.map((a) => ({
            user_id: a.id,
            type: 'practitioner_super_admin_approved',
            title: 'Praticien validé par M-Santé ✓',
            body: `${practUser.full_name} a été validé par notre équipe.`,
            data: { practitioner_user_id: practUser.id },
            channel: 'push',
            status: 'pending',
          }))
        )
      }
    }

    const results: Record<string, string> = {}

    // Push notification
    if (practUser.push_token) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: practUser.push_token,
          title: 'Compte approuvé ✓',
          body: 'Votre profil praticien M-Santé a été validé. Bienvenue !',
          data: { type: 'practitioner_approved' },
        }),
      })
      results.push = 'sent'
    }

    // Email via Resend
    const resendKey = Deno.env.get('RESEND_API_KEY')
    const fromEmail = Deno.env.get('FROM_EMAIL') ?? 'notifications@m-sante.com'
    if (practUser.email && resendKey) {
      try {
        await sendEmail(resendKey, fromEmail, practUser.email, practUser.full_name)
        results.email = 'sent'
        await supabase.from('notifications').insert({
          user_id: practUser.id,
          type: 'practitioner_approved',
          title: 'Compte approuvé ✓',
          body: 'Votre profil praticien M-Santé a été validé.',
          data: {},
          channel: 'email',
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
      } catch (e) {
        results.email = `failed: ${(e as Error).message}`
      }
    }

    // WhatsApp via Meta Business API
    const waToken = Deno.env.get('WHATSAPP_TOKEN')
    const waPhoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')
    if (practUser.phone && waToken && waPhoneId) {
      try {
        await sendWhatsApp(waToken, waPhoneId, practUser.phone, practUser.full_name)
        results.whatsapp = 'sent'
        await supabase.from('notifications').insert({
          user_id: practUser.id,
          type: 'practitioner_approved',
          title: 'Compte approuvé ✓',
          body: `Votre profil praticien M-Santé a été validé.`,
          data: {},
          channel: 'whatsapp',
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
      } catch (e) {
        results.whatsapp = `failed: ${(e as Error).message}`
      }
    }

    // Push notification record
    await supabase.from('notifications').insert({
      user_id: practUser.id,
      type: 'practitioner_approved',
      title: 'Votre compte a été approuvé !',
      body: 'Félicitations ! Votre profil praticien M-Santé a été validé. Vous pouvez maintenant recevoir des patients.',
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
