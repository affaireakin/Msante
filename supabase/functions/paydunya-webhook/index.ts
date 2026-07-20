import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { logIncident } from '../../../packages/backend/incidents.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Confirm payment status with PayDunya
async function confirmPaydunyaToken(token: string): Promise<{ paid: boolean; status: string }> {
  const masterKey  = Deno.env.get('PAYDUNYA_MASTER_KEY')!
  const privateKey = Deno.env.get('PAYDUNYA_PRIVATE_KEY')!
  const apiToken   = Deno.env.get('PAYDUNYA_TOKEN')!
  const mode       = Deno.env.get('PAYDUNYA_MODE') ?? 'live'
  const baseUrl    = mode === 'test'
    ? 'https://app.paydunya.com/sandbox-api/v1'
    : 'https://app.paydunya.com/api/v1'

  const res = await fetch(`${baseUrl}/checkout-invoice/confirm/${token}`, {
    headers: {
      'PAYDUNYA-MASTER-KEY': masterKey,
      'PAYDUNYA-PRIVATE-KEY': privateKey,
      'PAYDUNYA-TOKEN': apiToken,
    },
  })

  const data = await res.json() as {
    response_code: string
    status?: string
    custom_data?: { payment_id?: string; appointment_id?: string }
  }

  return {
    paid: data.response_code === '00' && data.status === 'completed',
    status: data.status ?? 'unknown',
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // PayDunya sends the token in the IPN payload
    const body = await req.json() as { data?: { bill?: { token?: string } }; token?: string }
    const token = body?.data?.bill?.token ?? body?.token

    if (!token || typeof token !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing token' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Find payment by PayDunya token (stored in provider_ref)
    const { data: payment, error: pErr } = await supabase
      .from('payments')
      .select('id, appointment_id, status')
      .eq('provider_ref', token)
      .single()

    if (pErr || !payment) {
      // Could be a duplicate IPN — return 200 to stop retries
      console.warn('paydunya-webhook: payment not found for token', token)
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Idempotent: already processed
    if (payment.status === 'completed') {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify with PayDunya
    const { paid } = await confirmPaydunyaToken(token)

    if (paid) {
      // Mark payment completed
      await supabase
        .from('payments')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', payment.id)

      // Confirm appointment
      if (payment.appointment_id) {
        await supabase
          .from('appointments')
          .update({ status: 'confirmed', payment_id: payment.id })
          .eq('id', payment.appointment_id)
      }

      // Audit log
      await supabase.from('audit_logs').insert({
        action: 'payment.completed',
        resource_type: 'payment',
        resource_id: payment.id,
        new_values: { provider_ref: token, via: 'paydunya_webhook' },
      })
    } else {
      await supabase
        .from('payments')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', payment.id)
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (e) {
    console.error('paydunya-webhook error:', e)
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    await logIncident(supabase, {
      title: 'Erreur webhook paiement PayDunya',
      description: (e as Error).message,
      priority: 'urgent',
      source: 'payment_webhook',
    })
    // Always return 200 to PayDunya to avoid infinite retries
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
