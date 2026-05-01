import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

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
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { appointment_id, provider, phone } = await req.json()

    // Vérifie que l'appointment appartient au patient
    const { data: appointment, error: aErr } = await supabase
      .from('appointments')
      .select('id, patient_id, practitioner_id, status')
      .eq('id', appointment_id)
      .single()

    if (aErr || !appointment) {
      return new Response(JSON.stringify({ error: 'Appointment not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (appointment.patient_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Récupère le montant du praticien
    const { data: practitioner } = await supabase
      .from('practitioners')
      .select('session_price, session_currency')
      .eq('id', appointment.practitioner_id)
      .single()

    // Crée le paiement en processing
    const { data: payment, error: pErr } = await supabase
      .from('payments')
      .insert({
        appointment_id,
        patient_id: user.id,
        practitioner_id: appointment.practitioner_id,
        amount: practitioner?.session_price ?? 0,
        currency: practitioner?.session_currency ?? 'XOF',
        provider: provider ?? 'simulated',
        provider_ref: `SIM-${Date.now()}`,
        status: 'processing',
        metadata: { phone: phone ?? null, simulated: true },
      })
      .select()
      .single()

    if (pErr) throw pErr

    // Simulation paiement : délai 1.5s
    await delay(1500)

    // Met à jour payment → completed
    await supabase
      .from('payments')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', payment.id)

    // Confirme le RDV + lie le payment_id
    await supabase
      .from('appointments')
      .update({ status: 'confirmed', payment_id: payment.id })
      .eq('id', appointment_id)

    return new Response(JSON.stringify({
      paymentId: payment.id,
      status: 'completed',
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
