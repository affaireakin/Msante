// Section 18 : les erreurs système détectées par l'app doivent générer
// automatiquement un incident dans la file "Gestion des incidents", au lieu
// de se perdre dans des logs que personne ne consulte. Un seul point d'entrée
// partagé pour toutes les edge functions afin de ne pas dupliquer la logique
// de déduplication dans chaque fonction.
//
// Best-effort et jamais bloquant : si la création d'incident échoue, on logue
// et on continue — un bug dans le rapporteur de bugs ne doit jamais faire
// planter l'appelant.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = any

export async function logIncident(
  supabase: SupabaseLike,
  input: {
    title: string
    description?: string
    priority?: 'low' | 'medium' | 'high' | 'urgent'
    source: string // ex: 'payment_webhook', 'consultation_room', 'client_crash'
  }
): Promise<void> {
  try {
    // Ne pas ouvrir un nouveau ticket si la même anomalie est déjà en cours
    // de traitement — évite d'inonder la file si l'erreur se répète.
    const { data: existing } = await supabase
      .from('tickets')
      .select('id')
      .eq('source', input.source)
      .not('status', 'in', '("valide","deploye")')
      .limit(1)
      .maybeSingle()

    if (existing) return

    await supabase.from('tickets').insert({
      title: input.title,
      description: input.description ?? null,
      type: 'incident',
      priority: input.priority ?? 'high',
      source: input.source,
      created_by: null,
    })
  } catch (e) {
    console.error('logIncident failed (non-fatal):', e)
  }
}
