// packages/notifications/NotificationService.ts
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildNotificationPayload } from './templates.ts'
import type {
  NotificationUser,
  NotificationEvent,
  NotificationChannel,
  NotificationAdapter,
} from './types.ts'
import { ExpoAdapter } from './adapters/ExpoAdapter.ts'
import { ResendAdapter } from './adapters/ResendAdapter.ts'

interface NotificationServiceOptions {
  expoAdapter: NotificationAdapter
  resendAdapter: NotificationAdapter
  supabase: SupabaseClient
}

export class NotificationService {
  private readonly adapters: Record<NotificationChannel, NotificationAdapter>
  private readonly supabase: SupabaseClient

  constructor(opts: NotificationServiceOptions) {
    this.adapters = {
      push: opts.expoAdapter,
      email: opts.resendAdapter,
      whatsapp: { send: async () => { throw new Error('WhatsApp not implemented — use workflow engine') } },
      sms: { send: async () => { throw new Error('SMS not implemented — use workflow engine') } },
    }
    this.supabase = opts.supabase
  }

  resolveChannels(user: NotificationUser): NotificationChannel[] {
    if (user.push_token) return ['push']
    return ['email']
  }

  async send(event: NotificationEvent): Promise<void> {
    const channels = this.resolveChannels(event.recipient)
    const payload = buildNotificationPayload(event.type, event.data)

    await Promise.allSettled(
      channels.map(async (channel) => {
        let status: 'sent' | 'failed' = 'sent'
        let errorMsg: string | undefined

        try {
          await this.adapters[channel].send(event)
        } catch (err) {
          status = 'failed'
          errorMsg = err instanceof Error ? err.message : 'unknown error'
          console.error(`NotificationService: ${channel} failed for user ${event.recipient.id}:`, errorMsg)
        }

        await this.supabase.from('notifications').insert({
          user_id: event.recipient.id,
          type: event.type,
          title: payload.title,
          body: payload.body,
          data: event.data,
          channel,
          status,
          sent_at: status === 'sent' ? new Date().toISOString() : null,
        }).then(({ error }) => {
          if (error) console.error('NotificationService: failed to insert notification log:', error)
        })
      })
    )
  }
}

export function createNotificationService(
  supabase: SupabaseClient,
  resendApiKey: string
): NotificationService {
  return new NotificationService({
    expoAdapter: new ExpoAdapter(),
    resendAdapter: new ResendAdapter(resendApiKey),
    supabase,
  })
}
