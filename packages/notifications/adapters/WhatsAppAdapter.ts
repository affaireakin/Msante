// packages/notifications/adapters/WhatsAppAdapter.ts
import type { NotificationAdapter, NotificationEvent } from '../types.ts'

export class WhatsAppAdapter implements NotificationAdapter {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async send(_event: NotificationEvent): Promise<void> {
    throw new Error('WhatsAppAdapter: not implemented — use workflow engine (Phase 2)')
  }
}
