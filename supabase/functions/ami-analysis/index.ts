import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    const { journalId, content, moodScore } = await req.json()
    if (!content) return new Response('Missing content', { status: 400, headers: corsHeaders })

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: `Tu es Mounima, l'assistante bien-être bienveillante. Analyse cette entrée de journal.
Réponds UNIQUEMENT en JSON valide avec ce format exact :
{"sentiment": "string", "themes": ["theme1", "theme2"], "suggestion": "string"}
- sentiment: en 1-3 mots (ex: "anxieux", "serein", "reconnaissant")
- themes: 2-3 thèmes identifiés (ex: "stress au travail", "relations")
- suggestion: 1 phrase douce et bienveillante, non-clinique
N'inclus AUCUN autre texte.`,
      messages: [{ role: 'user', content: `Score humeur: ${moodScore ?? 'non renseigné'}/10\n\n${content}` }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : '{}'
    const result = JSON.parse(raw)

    if (journalId && !journalId.startsWith('local_')) {
      const sbAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )
      await sbAdmin.from('journal_entries').update({
        ai_sentiment: result.sentiment,
        ai_themes: result.themes,
        ai_suggestion: result.suggestion,
      }).eq('id', journalId)
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
