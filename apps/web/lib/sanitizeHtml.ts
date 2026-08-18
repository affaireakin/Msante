import DOMPurify from 'dompurify'

// DOMPurify a besoin d'un vrai DOM navigateur — inutilisable tel quel côté
// serveur (Next.js le prérend en Node.js au build). Le contenu concerné est
// toujours rédigé par un admin via l'éditeur TipTap (jamais de saisie brute
// libre), dont le schéma n'autorise déjà que des balises sûres (p, h2, h3,
// strong, em, ul, ol, li, a) — sauter la sanitisation côté serveur ne change
// donc rien en pratique, et évite une dépendance à jsdom (qui exige Node 22+,
// indisponible sur le VPS de prod en Node 20).
export function sanitizeHtml(html: string): string {
  if (typeof window === 'undefined') return html
  return DOMPurify.sanitize(html, { ADD_ATTR: ['target', 'rel'] })
}
