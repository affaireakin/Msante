import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createNotificationService } from '../../packages/notifications/index.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── PayDunya invoice (disabled until credentials are configured) ───────────────

async function createPaydunyaInvoice(
  amount: number,
  phone: string,
  provider: string,
  paymentId: string,
  appointmentId: string,
): Promise<{ token: string; checkoutUrl: string } | null> {
  const masterKey = Deno.env.get('PAYDUNYA_MASTER_KEY')
  if (!masterKey) return null   // PayDunya not configured → fall through to simulation

  const privateKey = Deno.env.get('PAYDUNYA_PRIVATE_KEY')!
  const apiToken   = Deno.env.get('PAYDUNYA_TOKEN')!
  const mode       = Deno.env.get('PAYDUNYA_MODE') ?? 'live'
  const baseUrl    = mode === 'test'
    ? 'https://app.paydunya.com/sandbox-api/v1'
    : 'https://app.paydunya.com/api/v1'

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const webhookUrl  = `${supabaseUrl}/functions/v1/paydunya-webhook`
  const returnUrl   = Deno.env.get('APP_RETURN_URL') ?? 'msante://payment-return'

  const res = await fetch(`${baseUrl}/checkout-invoice/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'PAYDUNYA-MASTER-KEY': masterKey,
      'PAYDUNYA-PRIVATE-KEY': privateKey,
      'PAYDUNYA-TOKEN': apiToken,
    },
    body: JSON.stringify({
      invoice: {
        total_amount: Math.round(amount),
        description: `Consultation M-Santé — ${provider === 'wave' ? 'Wave' : 'Orange Money'}`,
      },
      store: { name: 'M-Santé', tagline: 'Votre santé, notre priorité', postal_address: 'Dakar, Sénégal' },
      actions: { cancel_url: returnUrl, return_url: returnUrl, callback_url: webhookUrl },
      custom_data: { payment_id: paymentId, appointment_id: appointmentId, provider, phone },
    }),
  })

  const data = await res.json() as { response_code: string; token?: string; response_text?: string }
  if (data.response_code !== '00' || !data.token) {
    throw new Error(`PayDunya: ${data.response_text ?? 'Unknown error'}`)
  }

  const checkoutUrl = mode === 'test'
    ? `https://app.paydunya.com/sandbox/checkout/regular/${data.token}`
    : `https://app.paydunya.com/checkout/regular/${data.token}`

  return { token: data.token, checkoutUrl }
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', ''),
    )
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { appointment_id, provider, phone } = await req.json() as {
      appointment_id: string
      provider: 'wave' | 'orange_money'
      phone?: string
    }

    if (!appointment_id || !provider) {
      return new Response(JSON.stringify({ error: 'appointment_id and provider are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify appointment belongs to this patient
    const { data: appointment, error: aErr } = await supabase
      .from('appointments')
      .select('id, patient_id, practitioner_id, status, service_id')
      .eq('id', appointment_id)
      .single()

    if (aErr || !appointment) {
      return new Response(JSON.stringify({ error: 'Appointment not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (appointment.patient_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get price from service or practitioner fallback
    let amount = 0
    let currency = 'XOF'

    if (appointment.service_id) {
      const { data: svc } = await supabase
        .from('practitioner_services')
        .select('price, currency')
        .eq('id', appointment.service_id)
        .single()
      if (svc) { amount = svc.price; currency = svc.currency }
    }
    if (amount === 0) {
      const { data: pract } = await supabase
        .from('practitioners')
        .select('session_price, session_currency')
        .eq('id', appointment.practitioner_id)
        .single()
      if (pract) { amount = pract.session_price ?? 0; currency = pract.session_currency ?? 'XOF' }
    }

    // Create payment record
    const { data: payment, error: pErr } = await supabase
      .from('payments')
      .insert({
        appointment_id,
        patient_id: user.id,
        practitioner_id: appointment.practitioner_id,
        amount,
        currency,
        provider,
        status: 'processing',
        metadata: { phone: phone ?? null },
      })
      .select('id')
      .single()

    if (pErr || !payment) throw new Error('Failed to create payment record')

    // ── Try PayDunya (if configured) ──────────────────────────────────────────
    const paydunya = await createPaydunyaInvoice(amount, phone ?? '', provider, payment.id, appointment_id)

    if (paydunya) {
      // Real PayDunya flow: update provider_ref, return checkout URL
      await supabase
        .from('payments')
        .update({ provider_ref: paydunya.token })
        .eq('id', payment.id)

      return new Response(JSON.stringify({
        paymentId: payment.id,
        status: 'processing',
        checkoutUrl: paydunya.checkoutUrl,
        paydunya_token: paydunya.token,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ── Simulation fallback (no PayDunya credentials) ─────────────────────────
    await delay(1500)
    await supabase
      .from('payments')
      .update({ status: 'completed', provider_ref: `SIM-${Date.now()}`, updated_at: new Date().toISOString() })
      .eq('id', payment.id)

    await supabase
      .from('appointments')
      .update({ status: 'confirmed', payment_id: payment.id })
      .eq('id', appointment_id)

    // Notification (fire-and-forget)
    try {
      const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? ''
      const notifService = createNotificationService(supabase, resendApiKey)
      const { data: patientUser } = await supabase
        .from('users')
        .select('id, full_name, email, push_token')
        .eq('id', user.id)
        .single()
      if (patientUser) {
        await notifService.send({
          type: 'payment_success',
          recipient: { id: patientUser.id, full_name: patientUser.full_name, email: patientUser.email, push_token: patientUser.push_token },
          data: { amount: String(amount), currency },
        })
      }
    } catch (err) { console.error('notification failed', err) }

    return new Response(JSON.stringify({
      paymentId: payment.id,
      status: 'completed',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (e) {
    console.error('process-payment error:', e)
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
