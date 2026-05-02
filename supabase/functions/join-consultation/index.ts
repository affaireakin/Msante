import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const { consultationId } = await req.json()

    if (!consultationId || typeof consultationId !== 'string') {
      return new Response(JSON.stringify({ error: 'consultationId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 1. Récupère la consultation + vérifie que le praticien est bien l'owner
    const { data: consultation, error: cErr } = await supabase
      .from('consultations')
      .select(`
        id, room_url, practitioner_token, status,
        appointments!inner(practitioner_id, practitioners!inner(user_id))
      `)
      .eq('id', consultationId)
      .single()

    if (cErr || !consultation) {
      return new Response(JSON.stringify({ error: 'Consultation not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Vérifie que l'utilisateur est le praticien
    const practUserIdPath = (consultation as any).appointments?.practitioners?.user_id
    if (practUserIdPath !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Update status → active + started_at (idempotent: ne repasse pas si déjà active)
    const { error: uErr } = await supabase
      .from('consultations')
      .update({ status: 'active', started_at: new Date().toISOString() })
      .eq('id', consultationId)
      .eq('status', 'waiting')

    if (uErr) throw uErr

    return new Response(JSON.stringify({
      consultationId,
      practitionerToken: consultation.practitioner_token,
      roomUrl: consultation.room_url,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
