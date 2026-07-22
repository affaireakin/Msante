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

function clientIp(req: Request): string | null {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? null
}

const DOC_LABELS: Record<string, string> = {
  diploma: 'Diplôme universitaire',
  id_card: "Carte nationale d'identité",
  license: "Licence d'exercice / Autorisation",
  order_certificate: "Certificat d'ordre",
  professional_insurance: 'Assurance professionnelle',
  other: 'Autre document',
}

// A practitioner uploading/replacing a verification document had zero
// supervision: no admin notification, and an already-approved practitioner
// kept full access indefinitely even though a brand-new, unreviewed
// document now sat in the table. Mirrors the same re-verification pattern
// already used for speciality changes (see practitioner/profile/page.tsx).
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

    const { document_type } = await req.json() as { document_type?: string }

    const { data: practitioner } = await supabase
      .from('practitioners')
      .select('id, verification_status, users!user_id(full_name)')
      .eq('user_id', user.id)
      .single()
    if (!practitioner) return json({ error: 'Practitioner not found' }, 404)

    const wasApproved = practitioner.verification_status === 'approved'
    if (wasApproved) {
      await supabase.from('practitioners').update({
        verification_status: 'under_review',
        is_verified: false,
      }).eq('id', practitioner.id)

      await supabase.from('audit_logs').insert({
        actor_id: user.id,
        action: 'practitioner.document_changed',
        resource_type: 'practitioner',
        resource_id: practitioner.id,
        old_values: { verification_status: 'approved' },
        new_values: { verification_status: 'under_review', document_type },
        module: 'practitioner',
        target_user_id: user.id,
        target_role: 'practitioner',
        ip_address: clientIp(req),
        user_agent: req.headers.get('user-agent'),
      })
    }

    const practName = (practitioner.users as unknown as { full_name: string } | null)?.full_name ?? 'Un praticien'
    const docLabel = DOC_LABELS[document_type ?? ''] ?? 'un document'

    const { data: admins } = await supabase.from('users').select('id').eq('role', 'admin')
    if (admins?.length) {
      await supabase.from('notifications').insert(admins.map(a => ({
        user_id: a.id,
        type: 'document_pending_review',
        title: 'Document à vérifier',
        body: `${practName} a ${wasApproved ? 'modifié' : 'ajouté'} : ${docLabel}.${wasApproved ? ' Son profil repasse en cours de vérification.' : ''}`,
        data: { practitioner_id: practitioner.id, document_type: document_type ?? '' },
        channel: 'push',
      })))
    }

    return json({ success: true, reset_to_review: wasApproved })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
