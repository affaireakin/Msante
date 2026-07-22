// Section 26 : centre de notifications — taxonomie de catégories et
// résolution du lien "accéder directement à l'élément concerné", partagées
// entre NotificationBell et la page d'historique complet de chaque profil.
// Il n'existe pas de colonne `category` en base (le `type` est une chaîne
// libre posée par ~20 points d'écriture différents) — on dérive donc la
// catégorie par préfixe/mot-clé plutôt que de maintenir une table de
// correspondance exhaustive qu'il faudrait mettre à jour à chaque nouveau
// type de notification.

export const NOTIFICATION_CATEGORIES: { key: string; label: string }[] = [
  { key: 'appointments', label: 'Rendez-vous' },
  { key: 'payments', label: 'Paiements' },
  { key: 'messages', label: 'Messages' },
  { key: 'account', label: 'Compte' },
  { key: 'organization', label: 'Organisation' },
  { key: 'support', label: 'Support' },
  { key: 'wellness', label: 'Bien-être' },
  { key: 'other', label: 'Autre' },
]
export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(NOTIFICATION_CATEGORIES.map(c => [c.key, c.label]))

export function categoryOf(type: string): string {
  if (/^appointment|^consultation|^no_show/.test(type)) return 'appointments'
  if (/^payment/.test(type)) return 'payments'
  if (/message|conversation|referring_doctor/.test(type)) return 'messages'
  if (/^organization|^practitioner_org/.test(type)) return 'organization'
  if (/^practitioner|^document|^secretary/.test(type)) return 'account'
  if (/ticket|dispute/.test(type)) return 'support'
  if (/mood/.test(type)) return 'wellness'
  return 'other'
}

export const TYPE_ICON: Record<string, string> = {
  new_message: 'chat_bubble',
  internal_message: 'chat_bubble',
  conversation_closed: 'lock',
  appointment_confirm: 'calendar_month',
  appointment_booked: 'calendar_month',
  appointment_reminder: 'alarm',
  appointment_cancelled: 'event_busy',
  consultation_starting: 'videocam',
  no_show_alert: 'event_busy',
  prescription_sent: 'receipt_long',
  payment_success: 'payments',
  payment_failed: 'money_off',
  document_pending_review: 'description',
  document_reviewed: 'fact_check',
  practitioner_approved: 'verified',
  practitioner_super_admin_approved: 'verified',
  practitioner_org_validated: 'verified',
  practitioner_org_detached: 'link_off',
  organization_approved: 'business',
  organization_rejected: 'block',
  organization_info_requested: 'help',
  secretary_pending_approval: 'support_agent',
  secretary_status_change: 'support_agent',
  account_status_change: 'admin_panel_settings',
  ticket_assigned: 'confirmation_number',
  dispute_assigned: 'gavel',
  mood_low_streak: 'sentiment_dissatisfied',
}

export function iconFor(type: string): string {
  return TYPE_ICON[type] ?? ({ appointments: 'event', payments: 'payments', messages: 'chat_bubble', account: 'person', organization: 'business', support: 'gavel', wellness: 'favorite', other: 'notifications' }[categoryOf(type)] ?? 'notifications')
}

const CATEGORY_COLOR: Record<string, string> = {
  appointments: 'text-sky-700 bg-sky-50',
  payments: 'text-emerald-700 bg-emerald-50',
  messages: 'text-[#82d8ff] bg-sky-50',
  account: 'text-amber-700 bg-amber-50',
  organization: 'text-[#005e7a] bg-[#e5eeff]',
  support: 'text-[#ba1a1a] bg-red-50',
  wellness: 'text-purple-700 bg-purple-50',
  other: 'text-[#6f787e] bg-slate-100',
}

export function colorFor(type: string): string {
  return CATEGORY_COLOR[categoryOf(type)] ?? CATEGORY_COLOR.other
}

// Certaines insertions portent déjà un `data.route` littéral (convention
// reprise du mobile) — mais les routes mobiles utilisent la syntaxe de
// groupe Expo Router "/(patient)/..." qui n'existe pas côté web et
// provoquerait un 404 ; on ne réutilise donc un `route` explicite que s'il
// ressemble à une route Next.js valide.
export function resolveNotificationRoute(type: string, data: Record<string, unknown> | null, basePath: string): string | null {
  const d = data ?? {}
  if (typeof d.route === 'string' && d.route.startsWith('/') && !d.route.includes('(')) {
    return d.route
  }

  if (/^appointment|^consultation|^no_show/.test(type) || typeof d.appointment_id === 'string') {
    if (basePath === '/secretary') return '/secretary'
    if (['/patient', '/practitioner'].includes(basePath)) return `${basePath}/appointments`
  }

  if (/^organization|^practitioner_org/.test(type)) {
    if (basePath === '/admin' && typeof d.organization_id === 'string') return `/admin/organizations/${d.organization_id}`
    if (basePath === '/admin') return '/admin/organizations'
    if (basePath === '/organization') return '/organization/practitioners'
    if (basePath === '/practitioner') return '/practitioner/profile'
  }

  if (/^document|^practitioner_approved|^practitioner_super_admin_approved/.test(type)) {
    if (basePath === '/admin') return '/admin/practitioners'
    if (basePath === '/practitioner') return '/practitioner/profile'
  }

  if (/^secretary/.test(type)) {
    if (basePath === '/admin') return '/admin/collaborators'
    if (basePath === '/practitioner') return '/practitioner/secretary'
  }

  if (/message|conversation|referring_doctor/.test(type)) {
    if (['/patient', '/practitioner', '/organization'].includes(basePath)) return `${basePath}/messages`
    if (basePath === '/secretary' || basePath === '/organization-member') return basePath
  }

  if (/mood/.test(type)) {
    if (basePath === '/patient') return '/patient/wellness/mood'
    if (basePath === '/practitioner') return '/practitioner/patients'
  }

  if (/ticket|dispute/.test(type)) {
    if (basePath === '/admin') return '/admin/tickets'
    if (basePath === '/practitioner') return '/practitioner/disputes'
    if (basePath === '/patient') return '/patient/disputes'
  }

  // Ces deux profils n'ont qu'un unique tableau de bord — y renvoyer reste
  // plus utile qu'un lien mort.
  if (basePath === '/secretary' || basePath === '/organization-member') return basePath

  return null
}
