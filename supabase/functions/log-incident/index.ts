import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { logIncident } from '../../../packages/backend/incidents.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Section 18 : point d'entrée public pour que le client web (patient,
// praticien, admin) signale automatiquement un crash — ex. une erreur React
// non gérée — comme incident, sans que l'utilisateur ait besoin de contacter
// le support. Nécessite juste une session valide (n'importe quel rôle) pour
// éviter les abus ; la déduplication est gérée par logIncident.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401 })

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return new Response('Unauthorized', { status: 401 })

    const { title, description, source } = await req.json() as { title?: string; description?: string; source?: string }
    if (!title || !source) return new Response('title and source are required', { status: 400 })

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    await logIncident(supabase, {
      title: title.slice(0, 200),
      description: description?.slice(0, 2000),
      priority: 'medium',
      source: `client:${source}`,
    })

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    // Reporting a crash must never itself throw back at the caller.
    console.error('log-incident error:', e)
    return new Response(JSON.stringify({ success: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
