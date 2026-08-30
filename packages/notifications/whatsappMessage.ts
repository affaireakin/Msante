// packages/notifications/whatsappMessage.ts
// WhatsApp is business-initiated messaging outside the 24h customer-service
// window for most of our events (reminders, approvals, account actions) —
// Meta requires an APPROVED TEMPLATE for that, not free-form text. Rather
// than getting a distinct template approved per event type (and exposing
// potentially sensitive content — e.g. a mood alert — in a lock-screen
// preview), every event sends the SAME generic, content-free nudge. The
// actual content only ever appears inside the app, behind auth.
export function genericWhatsAppMessage(name: string): string {
  return `Bonjour ${name} 👋\n\nVous avez une nouvelle notification dans votre espace personnel M-Santé.\n\nConnectez-vous à l'application pour la consulter.`
}
