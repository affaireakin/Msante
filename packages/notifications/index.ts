// packages/notifications/index.ts
export { NotificationService, createNotificationService } from './NotificationService.ts'
export { buildNotificationPayload } from './templates.ts'
export type {
  NotificationChannel,
  NotificationEventType,
  NotificationUser,
  NotificationEvent,
  NotificationAdapter,
  NotificationResult,
} from './types.ts'
