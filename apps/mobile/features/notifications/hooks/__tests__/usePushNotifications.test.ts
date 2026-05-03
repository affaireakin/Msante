// apps/mobile/features/notifications/hooks/__tests__/usePushNotifications.test.ts
// Mock native modules that can't be loaded in Jest environment
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { MAX: 5 },
}))
jest.mock('expo-device', () => ({ isDevice: true }))
jest.mock('expo-constants', () => ({ expoConfig: { extra: { eas: { projectId: 'test-id' } } } }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/services/supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }))

import { usePushNotifications } from '../usePushNotifications'

describe('usePushNotifications', () => {
  it('exports as a function', () => {
    expect(typeof usePushNotifications).toBe('function')
  })

  it('accepts isAuthenticated boolean parameter', () => {
    expect(usePushNotifications.length).toBe(1)
  })
})
