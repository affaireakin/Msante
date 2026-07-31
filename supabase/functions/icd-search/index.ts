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

// Proxy vers l'API officielle ICD-11 de l'OMS — nécessite un compte créé sur
// https://icd.who.int/icdapi (gratuit) puis ICD_API_CLIENT_ID /
// ICD_API_CLIENT_SECRET définis comme secrets Supabase
// (`supabase secrets set ICD_API_CLIENT_ID=... ICD_API_CLIENT_SECRET=...`).
// Le token OAuth2 est redemandé à chaque appel plutôt que mis en cache —
// plus simple pour une fonction stateless, au prix d'un aller-retour
// supplémentaire (le token WHO reste valide ~1h mais rien ne garantit que
// deux invocations tombent sur la même instance edge).
async function getIcdToken(clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch('https://icdaccessmanagement.who.int/connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'icdapi_access',
      grant_type: 'client_credentials',
    }),
  })
  if (!res.ok) throw new Error(`Échec authentification OMS ICD-11 (${res.status})`)
  const data = await res.json()
  return data.access_token as string
}

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

    const hasAccess = await supabase.rpc('practitioner_has_diagnostic_permission', {
      p_user_id: user.id,
      p_perm: 'can_use_cim',
    })
    if (hasAccess.error || !hasAccess.data) {
      return json({ error: "Vous n'avez pas accès à la recherche CIM." }, 403)
    }

    const { query } = await req.json() as { query?: string }
    if (!query || query.trim().length < 2) {
      return json({ error: 'Recherche trop courte (2 caractères minimum).' }, 400)
    }

    const clientId = Deno.env.get('ICD_API_CLIENT_ID')
    const clientSecret = Deno.env.get('ICD_API_CLIENT_SECRET')
    if (!clientId || !clientSecret) {
      return json({ error: "Recherche CIM non configurée côté serveur (identifiants API OMS manquants)." }, 503)
    }

    const token = await getIcdToken(clientId, clientSecret)

    const url = new URL('https://id.who.int/icd/release/11/2024-01/mms/search')
    url.searchParams.set('q', query.trim())
    url.searchParams.set('useFlexisearch', 'true')
    url.searchParams.set('flatResults', 'true')

    const searchRes = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Accept-Language': 'fr',
        'API-Version': 'v2',
      },
    })
    if (!searchRes.ok) throw new Error(`Recherche OMS ICD-11 échouée (${searchRes.status})`)
    const data = await searchRes.json()

    const stripTags = (s: string) => (s ?? '').replace(/<[^>]*>/g, '')
    const results = ((data.destinationEntities ?? []) as Array<{
      id: string; theCode?: string; title?: string; matchingPVs?: unknown
    }>).map(e => ({
      uri: e.id,
      code: e.theCode ?? null,
      title: stripTags(e.title ?? ''),
    })).filter(r => r.title)

    // Traçabilité — voir cahier des charges section 27 : toute consultation
    // CIM doit être journalisée (utilisateur, date/heure, type de recherche).
    // Non bloquant : un échec de journalisation ne doit pas empêcher la
    // recherche elle-même.
    try {
      await supabase.from('audit_logs').insert({
        actor_id: user.id,
        action: 'diagnostic_aid.cim_search',
        resource_type: 'diagnostic_aid',
        new_values: { query: query.trim(), result_count: results.length },
        module: 'clinical',
        target_role: 'practitioner',
      })
    } catch {
      // non-bloquant
    }

    return json({ results })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
