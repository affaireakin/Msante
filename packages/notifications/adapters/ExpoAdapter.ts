// packages/notifications/adapters/ExpoAdapter.ts
import type { NotificationAdapter, NotificationEvent } from '../types.ts'
import { buildNotificationPayload } from '../templates.ts'

export class DeviceNotRegisteredError extends Error {
  constructor(public readonly pushToken: string) {
    super(`DeviceNotRegistered: token ${pushToken} is no longer valid`)
    this.name = 'DeviceNotRegisteredError'
  }
}

export class ExpoAdapter implements NotificationAdapter {
  async send(event: NotificationEvent): Promise<void> {
    if (!event.recipient.push_token) {
      throw new Error('ExpoAdapter: recipient has no push_token')
    }

    const payload = buildNotificationPayload(event.type, event.data)

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify({
        to: event.recipient.push_token,
        title: payload.title,
        body: payload.body,
        data: payload.data,
        sound: 'default',
        priority: 'high',
        channelId: 'default',
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Expo push failed: ${response.status} ${text}`)
    }

    const result = await response.json() as { data?: { status: string; message?: string; details?: string } }
    if (result.data?.status === 'error') {
      if (result.data.details === 'DeviceNotRegistered' || result.data.message === 'DeviceNotRegistered') {
        throw new DeviceNotRegisteredError(event.recipient.push_token)
      }
      throw new Error(`Expo push error: ${result.data.message ?? 'unknown'}`)
    }
  }
}
