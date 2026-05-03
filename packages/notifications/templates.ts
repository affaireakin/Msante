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
    title: 'Consultation prête 🎥',
    body: "{patientName} a rejoint la salle d'attente.",
    route: (data) => `/practitioner/consultation/${data.appointmentId}/waiting`,
  },
  practitioner_approved: {
    title: 'Compte approuvé ✓',
    body: 'Votre profil praticien a été validé. Vous pouvez recevoir des patients.',
    route: () => '/(practitioner)/home',
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
