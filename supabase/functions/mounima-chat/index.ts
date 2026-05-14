import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const AMI_SYSTEM = `Tu es Mounima, l'assistant bien-être de M-Santé.
Tu n'es PAS un médecin ou thérapeute.
Tu offres un espace d'écoute bienveillant.
RÈGLES : Ne diagnostique jamais. Ne prescris jamais.
Si détresse sévère ou pensées suicidaires : commence ta réponse par "CRISIS_DETECTED\n"
puis offre soutien et mentionne SOS Amitié Sénégal +221 33 823 8020.
Termine par : "💙 Cet espace ne remplace pas un professionnel de santé."
Langue : français. Ton : chaleureux. Réponses courtes (3-5 phrases).`

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
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    const { messages } = await req.json()
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response('Missing messages', { status: 400, headers: corsHeaders })
    }

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: AMI_SYSTEM,
      messages: messages.slice(-10),
    })

    const content = response.content[0].type === 'text' ? response.content[0].text : ''
    const isCrisis = content.startsWith('CRISIS_DETECTED')
    const text = isCrisis ? content.replace(/^CRISIS_DETECTED\n?/, '') : content

    return new Response(JSON.stringify({ text, isCrisis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
