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

async function sendEmail(apiKey: string, from: string, to: string, name: string): Promise<void> {
  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#f8f9ff;">
      <div style="background:#006685;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:20px;font-weight:800;">M-Santé</h1>
      </div>
      <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;">
        <h2 style="color:#0b1c30;font-size:18px;margin-top:0;">Votre demande a bien été soumise</h2>
        <p style="color:#3f484d;line-height:1.6;">Bonjour <strong>${name}</strong>,</p>
        <p style="color:#3f484d;line-height:1.6;">
          Nous avons bien reçu vos informations et vos documents.
          Notre équipe va maintenant procéder à leur vérification.
          Vous serez informé(e) par email dès qu'une décision sera prise concernant votre compte.
        </p>
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
      subject: 'Votre demande M-Santé a bien été soumise',
      html,
    }),
  })
}

// Envoyé une seule fois, juste après la soumission initiale des documents
// de vérification (fin d'onboarding praticien) — distinct de
// notify-document-change qui notifie les admins à CHAQUE ajout/modif de
// document (y compris après approbation) et n'informe jamais le praticien.
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

    const { data: profile } = await supabase
      .from('users')
      .select('id, full_name, email, push_token')
      .eq('id', user.id)
      .single()
    if (!profile) return json({ error: 'User not found' }, 404)

    const results: Record<string, string> = {}

    if (profile.push_token) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: profile.push_token,
          title: 'Demande soumise ✓',
          body: 'Nous avons bien reçu votre dossier. Vérification en cours.',
          data: { type: 'documents_submitted' },
        }),
      })
      results.push = 'sent'
    }

    const resendKey = Deno.env.get('RESEND_API_KEY')
    const fromEmail = Deno.env.get('FROM_EMAIL') ?? 'notifications@m-sante.com'
    if (profile.email && resendKey) {
      try {
        await sendEmail(resendKey, fromEmail, profile.email, profile.full_name)
        results.email = 'sent'
        await supabase.from('notifications').insert({
          user_id: profile.id,
          type: 'documents_submitted',
          title: 'Votre demande a bien été soumise',
          body: 'Nous avons bien reçu vos informations et vos documents. Notre équipe va maintenant procéder à leur vérification.',
          data: {},
          channel: 'email',
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
      } catch (e) {
        results.email = `failed: ${(e as Error).message}`
      }
    }

    return json({ success: true, results })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
