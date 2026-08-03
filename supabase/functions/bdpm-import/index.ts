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

const BDPM_URL = 'https://base-donnees-publique.medicaments.gouv.fr/download/file/CIS_bdpm.txt'
const CHUNK_SIZE = 500

interface BdpmRow {
  cis_code: string
  denomination: string
  forme_pharmaceutique: string | null
  voies_administration: string | null
  statut_amm: string | null
  etat_commercialisation: string | null
  titulaire: string | null
}

// Importe/rafraîchit le référentiel BDPM (remplace l'ancienne liste de
// médicaments codée en dur, "pré-VIDAL") — déclenché par un admin plutôt
// qu'exécuté à chaque recherche, le fichier officiel faisant plusieurs Mo.
// CIS_bdpm.txt est historiquement encodé en ISO-8859-1 (Latin-1), pas UTF-8 —
// un décodage naïf casserait tous les caractères accentués.
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
    if (caller?.role !== 'admin') return json({ error: 'Réservé aux administrateurs' }, 403)

    const res = await fetch(BDPM_URL)
    if (!res.ok) return json({ error: `Téléchargement BDPM échoué (${res.status})` }, 502)

    const buffer = await res.arrayBuffer()
    const text = new TextDecoder('iso-8859-1').decode(buffer)
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

    const rows: BdpmRow[] = []
    for (const line of lines) {
      const cols = line.split('\t')
      const cis = cols[0]?.trim()
      const denomination = cols[1]?.trim()
      if (!cis || !denomination) continue
      rows.push({
        cis_code: cis,
        denomination,
        forme_pharmaceutique: cols[2]?.trim() || null,
        voies_administration: cols[3]?.trim() || null,
        statut_amm: cols[4]?.trim() || null,
        etat_commercialisation: cols[6]?.trim() || null,
        titulaire: cols[10]?.trim() || null,
      })
    }

    let imported = 0
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE).map(r => ({ ...r, updated_at: new Date().toISOString() }))
      const { error } = await supabase.from('bdpm_medications').upsert(chunk, { onConflict: 'cis_code' })
      if (error) return json({ error: error.message, imported }, 500)
      imported += chunk.length
    }

    return json({ success: true, imported, total_lines: lines.length })
  } catch (e) {
    return json({ error: (e as Error).message }, 500)
  }
})
