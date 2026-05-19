import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const AI_MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-3-5-haiku-20241022'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MOUNIMA_SYSTEM = `Tu es Mounima, l'assistante bien-être de M-Santé. Tu parles français.
Tu n'es PAS un médecin ou thérapeute. Tu offres écoute et soutien émotionnel.
Si l'utilisateur exprime une détresse sévère ou des pensées suicidaires,
indique IMMÉDIATEMENT qu'il doit contacter un professionnel ou le SOS Amitié (+221 33 823 8020).
Ne diagnostique JAMAIS. Ne prescris JAMAIS.
Réponds de façon chaleureuse, concise (2-3 phrases max, optimisé pour TTS).
À la fin de ta réponse, sur une nouvelle ligne, retourne EXACTEMENT ce JSON :
SENTIMENT:{"score":7,"stress":30,"emotion":"calme","crisis":false}
(score 1-10, stress 0-100, emotion en français, crisis true si détresse sévère)`

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Sentiment {
  score: number
  stress: number
  emotion: string
  crisis: boolean
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

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    let body: { audio_base64: string; conversation_history?: Message[]; session_id: string }
    try {
      body = await req.json()
    } catch {
      return new Response('Invalid JSON', { status: 400, headers: corsHeaders })
    }

    const { audio_base64, conversation_history = [], session_id } = body

    if (!audio_base64) {
      return new Response('Missing audio_base64', { status: 400, headers: corsHeaders })
    }
    if (!session_id) {
      return new Response('Missing session_id', { status: 400, headers: corsHeaders })
    }

    // ── 1. Whisper STT ───────────────────────────────────────────────────────
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      return new Response('Missing OPENAI_API_KEY', { status: 500, headers: corsHeaders })
    }

    const audioBuffer = Uint8Array.from(atob(audio_base64), (c) => c.charCodeAt(0))
    const formData = new FormData()
    formData.append('file', new Blob([audioBuffer], { type: 'audio/m4a' }), 'audio.m4a')
    formData.append('model', 'whisper-1')
    formData.append('language', 'fr')

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: formData,
    })

    if (!whisperRes.ok) {
      const err = await whisperRes.text()
      return new Response(
        JSON.stringify({ error: `Whisper error: ${err}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { text: transcript } = (await whisperRes.json()) as { text: string }

    // Empty transcript — prompt user to repeat
    if (!transcript?.trim()) {
      return new Response(
        JSON.stringify({
          transcript: '',
          response: "Je n'ai pas bien entendu. Pourrais-tu répéter ?",
          sentiment: { score: 5, stress: 30, emotion: 'neutre', crisis: false },
          crisis: false,
          audio_url: null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── 2. Claude Haiku — response + sentiment ───────────────────────────────
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) {
      return new Response('Missing ANTHROPIC_API_KEY', { status: 500, headers: corsHeaders })
    }

    const messages: Message[] = [
      ...conversation_history.slice(-10), // keep last 10 turns for context window
      { role: 'user', content: transcript },
    ]

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        max_tokens: 300,
        system: MOUNIMA_SYSTEM,
        messages,
      }),
    })

    if (!claudeRes.ok) {
      const err = await claudeRes.text()
      return new Response(
        JSON.stringify({ error: `Claude error: ${err}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const claudeData = (await claudeRes.json()) as {
      content: Array<{ type: string; text: string }>
    }
    const fullResponse = claudeData.content[0]?.text ?? ''

    // Parse SENTIMENT JSON from response tail
    let sentiment: Sentiment = { score: 5, stress: 50, emotion: 'neutre', crisis: false }
    let responseText = fullResponse

    const sentimentIdx = fullResponse.lastIndexOf('SENTIMENT:')
    if (sentimentIdx !== -1) {
      try {
        sentiment = JSON.parse(fullResponse.slice(sentimentIdx + 10)) as Sentiment
        responseText = fullResponse.slice(0, sentimentIdx).trim()
      } catch {
        // keep default sentiment, use full response as text
        responseText = fullResponse.replace(/SENTIMENT:.*$/ms, '').trim()
      }
    }

    // ── 3. ElevenLabs TTS ────────────────────────────────────────────────────
    const elevenLabsKey = Deno.env.get('ELEVENLABS_API_KEY')
    if (!elevenLabsKey) {
      // TTS unavailable — return text response without audio
      return new Response(
        JSON.stringify({ transcript, response: responseText, sentiment, crisis: sentiment.crisis, audio_url: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const voiceId = Deno.env.get('ELEVENLABS_VOICE_ID') ?? 'EXAVITQu4vr4xnSDxMaL'

    const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': elevenLabsKey,
      },
      body: JSON.stringify({
        text: responseText,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.8 },
      }),
    })

    if (!ttsRes.ok) {
      // TTS failure is non-fatal — return text without audio
      return new Response(
        JSON.stringify({ transcript, response: responseText, sentiment, crisis: sentiment.crisis, audio_url: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const audioData = await ttsRes.arrayBuffer()

    // ── 4. Upload MP3 to Supabase Storage ─────────────────────────────────────
    const fileName = `mounima-voice/${session_id}/${Date.now()}.mp3`

    const { error: uploadError } = await supabaseAdmin.storage
      .from('voice-sessions')
      .upload(fileName, audioData, {
        contentType: 'audio/mpeg',
        upsert: false,
      })

    if (uploadError) {
      // Storage failure is non-fatal — return without signed URL
      return new Response(
        JSON.stringify({ transcript, response: responseText, sentiment, crisis: sentiment.crisis, audio_url: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: signedUrlData } = await supabaseAdmin.storage
      .from('voice-sessions')
      .createSignedUrl(fileName, 3600) // 1-hour expiry

    return new Response(
      JSON.stringify({
        transcript,
        response: responseText,
        sentiment,
        crisis: sentiment.crisis,
        audio_url: signedUrlData?.signedUrl ?? null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
