import { supabase } from '@/lib/supabase'

// Section 18 : un crash React non géré devient automatiquement un incident
// dans "Gestion des incidents" côté admin, au lieu de se perdre dans la
// console du navigateur de l'utilisateur. Best-effort — nécessite une
// session active (log-incident exige un utilisateur authentifié) ; sur les
// pages publiques sans session, l'appel échoue silencieusement.
export function reportIncident(error: Error, source: string) {
  supabase.functions.invoke('log-incident', {
    body: { title: error.message || 'Erreur non gérée', description: error.stack?.slice(0, 2000), source },
  }).catch(() => { /* la remontée d'incident ne doit jamais faire planter l'UI */ })
}
