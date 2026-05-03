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

    // Vérifie que l'appelant est admin
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
      .select('id, full_name, push_token')
      .eq('id', practitionerUserId)
      .single()

    if (!practUser) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Insert notification record
    await supabase.from('notifications').insert({
      user_id: practUser.id,
      type: 'practitioner_approved',
      title: 'Votre compte a été approuvé !',
      body: 'Félicitations ! Votre profil praticien M-Santé a été validé. Vous pouvez maintenant recevoir des patients.',
      data: {},
      channel: 'push',
      status: 'pending',
    })

    // Send push notification if token available
    if (practUser.push_token) {
      const pushPayload = {
        to: practUser.push_token,
        title: 'Compte approuvé ✓',
        body: 'Votre profil praticien M-Santé a été validé. Bienvenue !',
        data: { type: 'practitioner_approved' },
      }
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pushPayload),
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
