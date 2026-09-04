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

async function sendEmail(apiKey: string, from: string, to: string, orgName: string, action: 'approved' | 'rejected' | 'info_requested', note?: string): Promise<void> {
  const titles: Record<string, string> = {
    approved: 'Votre organisation est validée 🎉',
    rejected: 'Votre demande d\'organisation a été refusée',
    info_requested: 'Informations complémentaires requises',
  }
  const bodies: Record<string, string> = {
    approved: `Félicitations, <strong>${orgName}</strong> est maintenant active sur M-Santé. Vous pouvez vous connecter et gérer votre organisation.`,
    rejected: `Votre demande de création pour <strong>${orgName}</strong> n'a pas été retenue.${note ? ` Motif : ${note}` : ''}`,
    info_requested: `Notre équipe a besoin d'informations complémentaires pour valider <strong>${orgName}</strong>.${note ? ` Détail : ${note}` : ''}`,
  }
  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#f8f9ff;">
      <div style="background:#006685;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:20px;font-weight:800;">M-Santé — Organisations</h1>
      </div>
      <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;">
        <h2 style="color:#0b1c30;font-size:18px;margin-top:0;">${titles[action]}</h2>
        <p style="color:#3f484d;line-height:1.6;">${bodies[action]}</p>
        <p style="color:#6f787e;font-size:13px;margin-bottom:0;">L'équipe M-Santé</p>
      </div>
    </div>
  `
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from, to, subject: titles[action], html }),
  })
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

    const { data: caller } = await supabase.from('users').select('role').eq('id', user.id).single()
    if (caller?.role !== 'admin') return json({ error: 'Forbidden' }, 403)

    const { organization_id, action, note } = await req.json() as {
      organization_id?: string
      action?: 'approve' | 'reject' | 'request_info'
      note?: string
    }
    if (!organization_id || !action) return json({ error: 'organization_id and action are required' }, 400)
    if (!['approve', 'reject', 'request_info'].includes(action)) return json({ error: 'Invalid action' }, 400)

    const { data: org } = await supabase
      .from('organizations')
      .select('id, name, email, status, created_by')
      .eq('id', organization_id)
      .single()
    if (!org) return json({ error: 'Organization not found' }, 404)

    if (action === 'request_info') {
      // No status change — just notify the requester with the note.
      if (org.created_by) {
        await supabase.from('notifications').insert({
          user_id: org.created_by,
          type: 'organization_info_requested',
          title: 'Informations complémentaires requises',
          body: note ?? `Merci de compléter votre dossier pour ${org.name}.`,
          data: { organization_id },
          channel: 'push',
          status: 'pending',
        })
      }
      const resendKey = Deno.env.get('RESEND_API_KEY')
      const fromEmail = Deno.env.get('FROM_EMAIL') ?? 'notifications@m-sante.com'
      if (resendKey) await sendEmail(resendKey, fromEmail, org.email, org.name, 'info_requested', note)

      await supabase.from('audit_logs').insert({
        actor_id: user.id,
        action: 'organization.request_info',
        resource_type: 'organization',
        resource_id: organization_id,
        new_values: { note },
        module: 'organization',
        target_user_id: org.created_by,
        target_role: 'organization_admin',
        reason: note ?? null,
        ip_address: clientIp(req),
        user_agent: req.headers.get('user-agent'),
      })
      return json({ success: true, status: org.status })
    }

    const newStatus = action === 'approve' ? 'active' : 'rejected'

    // Un admin ne doit jamais pouvoir valider une organisation dont aucun
    // justificatif n'a été soumis (bug remonté : pratique possible côté web
    // même quand l'upload mobile avait échoué en amont). Miroir du même
    // garde-fou côté practitioners (trigger trg_practitioner_approval_requires_documents).
    if (action === 'approve') {
      const { count } = await supabase
        .from('organization_documents')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organization_id)
      if (!count) return json({ error: 'Impossible d\'approuver : aucun document justificatif soumis pour cette organisation.' }, 400)
    }

    const { error: updateError } = await supabase
      .from('organizations')
      .update({ status: newStatus, validated_by: user.id, validated_at: new Date().toISOString() })
      .eq('id', organization_id)
    if (updateError) return json({ error: updateError.message }, 500)

    // On approval: promote the creator to organization_admin and attach them.
    if (action === 'approve' && org.created_by) {
      await supabase
        .from('users')
        .update({ role: 'organization_admin', organization_id })
        .eq('id', org.created_by)

      // Assign them to the org's auto-seeded "Administrateur" system role —
      // without this, user_has_permission() has nothing to check against and
      // every permission-gated action (invite, roles, etc.) silently 403s.
      const { data: adminRole } = await supabase
        .from('org_roles')
        .select('id')
        .eq('organization_id', organization_id)
        .eq('name', 'Administrateur')
        .eq('is_system', true)
        .maybeSingle()
      if (adminRole) {
        await supabase.from('user_roles').upsert(
          { user_id: org.created_by, role_id: adminRole.id, organization_id },
          { onConflict: 'user_id,role_id,organization_id' }
        )
      }
    }

    if (org.created_by) {
      await supabase.from('notifications').insert({
        user_id: org.created_by,
        type: action === 'approve' ? 'organization_approved' : 'organization_rejected',
        title: action === 'approve' ? 'Organisation validée ✓' : 'Demande refusée',
        body: action === 'approve'
          ? `${org.name} est maintenant active. Vous pouvez vous connecter.`
          : (note ?? `Votre demande pour ${org.name} a été refusée.`),
        data: { organization_id, note },
        channel: 'push',
        status: 'pending',
      })
    }

    const resendKey = Deno.env.get('RESEND_API_KEY')
    const fromEmail = Deno.env.get('FROM_EMAIL') ?? 'notifications@m-sante.com'
    if (resendKey) await sendEmail(resendKey, fromEmail, org.email, org.name, action === 'approve' ? 'approved' : 'rejected', note)

    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action: `organization.${action}`,
      resource_type: 'organization',
      resource_id: organization_id,
      old_values: { status: org.status },
      new_values: { status: newStatus, note },
      module: 'organization',
      target_user_id: org.created_by,
      target_role: 'organization_admin',
      reason: note ?? null,
      ip_address: clientIp(req),
      user_agent: req.headers.get('user-agent'),
    })

    return json({ success: true, status: newStatus })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
