// apps/mobile/features/notifications/hooks/__tests__/usePushNotifications.test.ts
import { usePushNotifications } from '../usePushNotifications'

describe('usePushNotifications', () => {
  it('exports as a function', () => {
    expect(typeof usePushNotifications).toBe('function')
  })

  it('accepts isAuthenticated boolean parameter', () => {
    expect(usePushNotifications.length).toBe(1)
  })
})
