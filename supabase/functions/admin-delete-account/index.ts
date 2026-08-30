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

function clientIp(req: Request): string | null {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null
}

// WhatsApp est un message initié par l'entreprise hors fenêtre 24h — Meta
// exige un template approuvé, pas du texte libre. On envoie le même message
// générique pour tous les événements plutôt que d'exposer le détail (motif
// de suppression, etc.) en aperçu verrouillé ; le détail reste dans l'app.
function genericWhatsAppMessage(name: string): string {
  return `Bonjour ${name} 👋\n\nVous avez une nouvelle notification dans votre espace personnel M-Santé.\n\nConnectez-vous à l'application pour la consulter.`
}

// Équivalent admin de delete-account (self-service) : même comportement
// RGPD (blocage immédiat via ban Supabase Auth, effacement des données sous
// 30 jours), mais déclenché par un admin pour un utilisateur qui ne peut ou
// ne veut pas le faire lui-même. Motif obligatoire, notifié à l'utilisateur.
const TEN_YEARS = '87600h'

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

    const { data: caller } = await supabase.from('users').select('role').eq('id', user.id).single()
    if (caller?.role !== 'admin') return json({ error: 'Forbidden' }, 403)

    const { target_user_id: targetUserId, reason } = await req.json() as { target_user_id?: string; reason?: string }
    if (!targetUserId) return json({ error: 'target_user_id is required' }, 400)
    if (!reason?.trim()) return json({ error: 'A reason is required' }, 400)

    const { data: target } = await supabase
      .from('users')
      .select('role, full_name, email, phone, whatsapp_number')
      .eq('id', targetUserId)
      .single()
    if (!target) return json({ error: 'User not found' }, 404)
    if (target.role === 'admin') return json({ error: 'Un compte administrateur ne peut pas être supprimé depuis cet écran.' }, 400)

    const { error: banError } = await supabase.auth.admin.updateUserById(targetUserId, { ban_duration: TEN_YEARS })
    if (banError) return json({ error: banError.message }, 500)

    const fullReason = `Suppression de compte demandée par un administrateur (RGPD) — traitement des données sous 30 jours. Motif : ${reason.trim()}`
    const { error: updateError } = await supabase
      .from('users')
      .update({ account_status: 'suspended', status_reason: fullReason })
      .eq('id', targetUserId)
    if (updateError) return json({ error: updateError.message }, 500)

    if (target.role === 'practitioner') {
      await supabase.from('practitioners').update({ account_status: 'suspended', status_reason: fullReason }).eq('user_id', targetUserId)
    }

    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: 'user.deletion_requested',
      resource_type: 'user',
      resource_id: targetUserId,
      new_values: { account_status: 'suspended', reason: fullReason },
      module: 'admin',
      target_user_id: targetUserId,
      target_role: target.role,
      reason: fullReason,
      ip_address: clientIp(req),
      user_agent: req.headers.get('user-agent'),
    })

    try {
      const title = 'Compte supprimé'
      const body = `Votre compte M-Santé a été supprimé par un administrateur.\n\nMotif : ${reason.trim()}\n\n` +
        `Vos données personnelles et cliniques seront définitivement effacées sous 30 jours, conformément au RGPD. ` +
        `Si vous pensez qu'il s'agit d'une erreur, contactez-nous à privacy@m-sante.com en précisant votre nom et la date de cette notification.`

      await supabase.from('notifications').insert({
        user_id: targetUserId, type: 'account_status_change', title, body, channel: 'push', data: {},
      })

      const resendKey = Deno.env.get('RESEND_API_KEY')
      if (target.email && resendKey) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'M-Santé <noreply@m-sante.com>',
            to: [target.email],
            subject: title,
            html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px"><h2 style="color:#006685">${title}</h2><p style="color:#0b1c30;font-size:16px;line-height:1.6;white-space:pre-line">${body}</p><hr style="border:none;border-top:1px solid #e5eeff;margin:24px 0"/><p style="color:#6f787e;font-size:12px">M-Santé — votre santé, notre priorité.</p></div>`,
          }),
        }).catch(err => console.error('admin-delete-account: email failed', err))
      }

      const waToken = Deno.env.get('WHATSAPP_TOKEN')
      const waPhoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')
      const waTo = target.whatsapp_number || target.phone
      if (waTo && waToken && waPhoneId) {
        const phone = waTo.replace(/[^0-9]/g, '')
        const intl = phone.startsWith('0') ? `221${phone.slice(1)}` : phone
        await fetch(`https://graph.facebook.com/v18.0/${waPhoneId}/messages`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${waToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ messaging_product: 'whatsapp', to: intl, type: 'text', text: { body: genericWhatsAppMessage(target.full_name) } }),
        }).catch(err => console.error('admin-delete-account: whatsapp failed', err))
      }
    } catch (notifErr) {
      console.error('admin-delete-account: notification failed', notifErr)
    }

    return json({ success: true })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
