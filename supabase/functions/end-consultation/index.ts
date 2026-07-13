import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.24.3'

const AI_MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-3-5-haiku-20241022'

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

    const { consultationId, chatHistory = [], notes = '', skipAiSummary = false } = await req.json()

    if (!consultationId || typeof consultationId !== 'string') {
      return new Response(JSON.stringify({ error: 'consultationId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 1. Récupère la consultation
    const { data: consultation, error: cErr } = await supabase
      .from('consultations')
      .select('id, started_at, status, room_name, appointment_id')
      .eq('id', consultationId)
      .single()

    if (cErr || !consultation) {
      return new Response(JSON.stringify({ error: 'Consultation not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Idempotent: already ended
    if (consultation.status === 'ended') {
      return new Response(JSON.stringify({ message: 'Already ended' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const endedAt = new Date()
    const startedAt = consultation.started_at ? new Date(consultation.started_at) : endedAt
    const durationMin = Math.max(1, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000))

    // 2. Claude Haiku → résumé session (sauf si le praticien a décliné la
    // génération automatique dans la modale de fin de session)
    let aiSummary = ''
    if (!skipAiSummary) {
      const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

      const chatText = Array.isArray(chatHistory) && chatHistory.length > 0
        ? (chatHistory as { role: string; content: string }[]).map((m) => `${m.role}: ${m.content}`).join('\n')
        : 'Aucun message échangé.'

      const completion = await anthropic.messages.create({
        model: AI_MODEL,
        max_tokens: 400,
        system: `Tu es un assistant médical. Génère un compte-rendu factuel et bienveillant
                 d'une session de téléconsultation à partir du chat et des notes du praticien.
                 RÈGLES ABSOLUES:
                 - JAMAIS de diagnostic médical
                 - JAMAIS de prescription de médicament
                 - Terminer par: "Ce résumé ne remplace pas les conseils de votre médecin."
                 - Format: 3-4 phrases, ton professionnel et rassurant, en français.`,
        messages: [{
          role: 'user',
          content: `Durée: ${durationMin} minutes\nChat:\n${chatText}\nNotes praticien: ${notes || 'Aucune'}`,
        }],
      })

      const firstBlock = completion.content[0]
      aiSummary = firstBlock.type === 'text' ? firstBlock.text : ''
    }

    // 3. Update consultation
    // practitioner_notes is what the /summary page reads back into "Notes de
    // suivi" — it was never written here, so notes typed live during the
    // session (used only as an LLM prompt input above) vanished and had to
    // be retyped from scratch after every session.
    await supabase
      .from('consultations')
      .update({
        status: 'ended',
        ended_at: endedAt.toISOString(),
        duration_actual_min: durationMin,
        chat_history: chatHistory,
        ai_summary: aiSummary,
        practitioner_notes: notes || null,
      })
      .eq('id', consultationId)

    // 4. Update appointment status → completed
    await supabase
      .from('appointments')
      .update({ status: 'completed' })
      .eq('id', consultation.appointment_id)

    // 5. Supprimer la room LiveKit (cleanup optionnel — expire automatiquement)
    if (consultation.room_name) {
      const livekitUrl = Deno.env.get('LIVEKIT_WS_URL')?.replace('wss://', 'https://') ?? ''
      if (livekitUrl) {
        await fetch(`${livekitUrl}/twirp/livekit.RoomService/DeleteRoom`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get('LIVEKIT_API_KEY')!}` },
          body: JSON.stringify({ room: consultation.room_name }),
        }).catch(() => { /* ignore cleanup error */ })
      }
    }

    // 6. Audit log
    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: 'consultation.ended',
      resource_type: 'consultation',
      resource_id: consultationId,
      new_values: { duration_actual_min: durationMin },
    })

    return new Response(JSON.stringify({ aiSummary, durationMin }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
