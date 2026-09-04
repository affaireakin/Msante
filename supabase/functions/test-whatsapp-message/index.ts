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

// Outil de diagnostic pour l'admin (/admin/workflows) : envoie le même
// message générique que tous les autres événements
// (packages/notifications/whatsappMessage.ts), directement à un numéro
// donné, sans passer par la gate "workflow actif" — pour vérifier que la
// config Meta (token, phone number id, numéro destinataire autorisé en
// sandbox) fonctionne réellement, sans avoir à déclencher un vrai
// événement métier (RDV, message...) juste pour tester.
function genericWhatsAppMessage(name: string): string {
  return `Bonjour ${name} 👋\n\nVous avez une nouvelle notification dans votre espace personnel M-Santé.\n\nConnectez-vous à l'application pour la consulter.`
}

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

    const { phone, name } = await req.json() as { phone?: string; name?: string }
    if (!phone?.trim()) return json({ error: 'phone is required (format international, ex: +221778806877)' }, 400)

    const waToken = Deno.env.get('WHATSAPP_TOKEN')
    const waPhoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')
    if (!waToken || !waPhoneId) return json({ error: 'WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID non configurés' }, 500)

    const to = phone.replace(/[^0-9]/g, '')
    const message = genericWhatsAppMessage(name?.trim() || 'Testeur')

    const res = await fetch(`https://graph.facebook.com/v18.0/${waPhoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${waToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: message } }),
    })
    const metaResponse = await res.json()

    return json({ success: res.ok, status: res.status, sent_to: to, message_body: message, meta_response: metaResponse }, res.ok ? 200 : 200)
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
