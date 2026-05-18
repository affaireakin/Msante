// packages/notifications/templates.ts
import type { NotificationEventType } from './types.ts'

interface NotificationPayload {
  title: string
  body: string
  data: Record<string, string>
}

type TemplateData = Record<string, string | number>

const TEMPLATES: Record<
  NotificationEventType,
  { title: string; body: string; route: (data: TemplateData) => string }
> = {
  appointment_confirm: {
    title: 'RDV confirmé ✓',
    body: 'Votre RDV avec {practitionerName} le {date} est confirmé.',
    route: () => '/(patient)/home',
  },
  appointment_reminder: {
    title: 'RDV dans 24h 📅',
    body: 'Rappel : consultation avec {practitionerName} demain à {time}.',
    route: () => '/(patient)/home',
  },
  payment_success: {
    title: 'Paiement reçu ✓',
    body: 'Paiement de {amount} XOF confirmé.',
    route: () => '/(patient)/home',
  },
  payment_failed: {
    title: 'Paiement échoué ⚠️',
    body: 'Votre paiement a échoué. Réessayez dans votre espace patient.',
    route: () => '/(patient)/payment',
  },
  consultation_starting: {
    title: 'Consultation dans 15 min 🎥',
    body: 'Votre consultation est dans 15 minutes, à {time}.',
    route: (data) => `/(patient)/consultation/${data.appointment_id}/session`,
  },
  practitioner_approved: {
    title: 'Compte approuvé ✓',
    body: 'Votre profil praticien a été validé. Vous pouvez recevoir des patients.',
    route: () => '/(practitioner)/home',
  },
  mood_low_streak: {
    title: 'Prenez soin de vous 💙',
    body: 'Votre humeur est basse depuis quelques jours. Parler à un praticien peut aider.',
    route: () => '/(patient)/mental-health',
  },
  mood_check_in: {
    title: 'Comment vous sentez-vous ? 🌤️',
    body: 'Prenez 30 secondes pour noter votre humeur du jour.',
    route: () => '/(patient)/mental-health',
  },
}

function interpolate(template: string, data: TemplateData): string {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    key in data ? String(data[key]) : `{${key}}`
  )
}

export function buildNotificationPayload(
  type: NotificationEventType,
  data: TemplateData
): NotificationPayload {
  const tpl = TEMPLATES[type]
  return {
    title: tpl.title,
    body: interpolate(tpl.body, data),
    data: { route: tpl.route(data), type },
  }
}
