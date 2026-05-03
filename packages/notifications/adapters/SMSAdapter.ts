// packages/notifications/adapters/SMSAdapter.ts
import type { NotificationAdapter, NotificationEvent } from '../types.ts'

export class SMSAdapter implements NotificationAdapter {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async send(_event: NotificationEvent): Promise<void> {
    throw new Error('SMSAdapter: not implemented — use workflow engine (Phase 2)')
  }
}
