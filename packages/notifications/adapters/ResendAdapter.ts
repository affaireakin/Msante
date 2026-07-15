// packages/notifications/adapters/ResendAdapter.ts
import type { NotificationAdapter, NotificationEvent } from '../types.ts'
import { buildNotificationPayload } from '../templates.ts'

export class ResendAdapter implements NotificationAdapter {
  constructor(private readonly apiKey: string) {}

  async send(event: NotificationEvent): Promise<void> {
    if (!event.recipient.email) {
      throw new Error('ResendAdapter: recipient has no email')
    }

    const payload = buildNotificationPayload(event.type, event.data)

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'M-Santé <noreply@m-sante.com>',
        to: [event.recipient.email],
        subject: payload.title,
        html: `
          <div style="font-family: Manrope, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #006685;">${payload.title}</h2>
            <p style="color: #0b1c30; font-size: 16px; line-height: 1.6;">${payload.body}</p>
            <hr style="border: none; border-top: 1px solid #e5eeff; margin: 24px 0;" />
            <p style="color: #6f787e; font-size: 12px;">
              M-Santé — votre santé, notre priorité.<br/>
              Cet email a été envoyé automatiquement, merci de ne pas y répondre.
            </p>
          </div>
        `,
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Resend failed: ${response.status} ${text}`)
    }
  }
}
