import { authService } from '../authService'
import { supabase } from '@/services/supabase'

jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn() }))
jest.mock('expo-auth-session', () => ({ makeRedirectUri: jest.fn(() => 'msante://') }))
jest.mock('@/services/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signInWithOAuth: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      getUser: jest.fn(),
    },
    from: jest.fn(() => ({
      update: jest.fn(() => ({ eq: jest.fn(() => ({ error: null })) })),
      insert: jest.fn(() => ({ select: jest.fn(() => ({ single: jest.fn(() => ({ data: { id: 'p-1' }, error: null })) })) })),
    })),
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(() => ({ error: null })),
        getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://storage.test/file.pdf' } })),
      })),
    },
  },
  fetchUserProfile: jest.fn(() => null),
  fetchPractitionerProfile: jest.fn(() => null),
}))
jest.mock('@/features/auth/store/authStore', () => ({
  useAuthStore: { getState: jest.fn(() => ({ setProfile: jest.fn(), setPractitioner: jest.fn() })) },
}))

describe('authService', () => {
  it('signInWithEmail returns error string on failure', async () => {
    ;(supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid login credentials' },
    })
    const result = await authService.signInWithEmail('bad@test.com', 'wrong')
    expect(result.error).toBe('Invalid login credentials')
    expect(result.user).toBeNull()
  })

  it('signInWithEmail returns user on success', async () => {
    ;(supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
      data: { user: { id: 'user-1', email: 'ok@test.com' } },
      error: null,
    })
    const result = await authService.signInWithEmail('ok@test.com', 'password123')
    expect(result.user?.id).toBe('user-1')
    expect(result.error).toBeNull()
  })

  it('resetPassword throws on error', async () => {
    ;(supabase.auth.resetPasswordForEmail as jest.Mock).mockResolvedValue({
      error: { message: 'Rate limit exceeded' },
    })
    await expect(authService.resetPassword('test@test.com')).rejects.toThrow('Rate limit exceeded')
  })
})
