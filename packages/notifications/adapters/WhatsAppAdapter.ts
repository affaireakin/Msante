// packages/notifications/adapters/WhatsAppAdapter.ts
import type { NotificationAdapter, NotificationEvent } from '../types.ts'
import { buildNotificationPayload } from '../templates.ts'

export class WhatsAppAdapter implements NotificationAdapter {
  constructor(
    private readonly token: string,
    private readonly phoneNumberId: string,
  ) {}

  async send(event: NotificationEvent): Promise<void> {
    if (!this.token || !this.phoneNumberId) {
      throw new Error('WhatsApp not configured — set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID')
    }
    const phone = event.recipient.whatsapp_number
    if (!phone) {
      throw new Error('WhatsAppAdapter: recipient has no WhatsApp number')
    }

    const payload = buildNotificationPayload(event.type, event.data)
    const cleanPhone = phone.replace(/\D/g, '')

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${this.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: cleanPhone,
          type: 'text',
          text: { body: `*${payload.title}*\n\n${payload.body}` },
        }),
      },
    )

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`WhatsApp API failed: ${response.status} ${text}`)
    }
  }
}
