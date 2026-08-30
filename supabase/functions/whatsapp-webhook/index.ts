// supabase/functions/whatsapp-webhook/index.ts
// Meta WhatsApp Cloud API webhook endpoint.
//
// Callback URL (Meta > WhatsApp > Configuration > Webhooks):
//   https://jilpynvkpkepusvwcqch.supabase.co/functions/v1/whatsapp-webhook
// Verify token: must match the WHATSAPP_WEBHOOK_VERIFY_TOKEN secret below.
//
// GET  = Meta's one-time verification handshake (hub.challenge echo).
// POST = delivery-status updates and incoming user messages. We don't have
// a 2-way WhatsApp chat feature yet, so we just log and acknowledge —
// Meta requires a fast 200 regardless, or it retries and eventually
// disables the subscription.

Deno.serve(async (req) => {
  const url = new URL(req.url)

  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')
    const expected = Deno.env.get('WHATSAPP_WEBHOOK_VERIFY_TOKEN')

    if (mode === 'subscribe' && expected && token === expected) {
      return new Response(challenge ?? '', { status: 200 })
    }
    return new Response('Forbidden', { status: 403 })
  }

  if (req.method === 'POST') {
    try {
      const body = await req.json()
      console.log('whatsapp-webhook: event received', JSON.stringify(body))
    } catch (err) {
      console.error('whatsapp-webhook: failed to parse body', err)
    }
    return new Response('EVENT_RECEIVED', { status: 200 })
  }

  return new Response('Method not allowed', { status: 405 })
})
