import { act } from 'react'
import { renderHook } from '@testing-library/react-hooks'
import { useAuthStore } from '../authStore'

// Mock supabase
jest.mock('@/services/supabase', () => ({
  supabase: {
    auth: {
      signOut: jest.fn().mockResolvedValue({ error: null }),
    },
  },
}))

describe('authStore', () => {
  beforeEach(() => {
    act(() => {
      useAuthStore.getState().setSession(null)
      useAuthStore.getState().setProfile(null)
      useAuthStore.getState().setPractitioner(null)
    })
  })

  it('starts unauthenticated', () => {
    const { result } = renderHook(() => useAuthStore())
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.user).toBeNull()
  })

  it('setSession marks user as authenticated', () => {
    const { result } = renderHook(() => useAuthStore())
    act(() => {
      result.current.setSession({ id: 'user-1', email: 'test@test.com' } as any)
    })
    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.user?.id).toBe('user-1')
  })

  it('signOut clears all state', async () => {
    const { result } = renderHook(() => useAuthStore())
    act(() => {
      result.current.setSession({ id: 'user-1' } as any)
    })
    await act(async () => {
      await result.current.signOut()
    })
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.user).toBeNull()
    expect(result.current.profile).toBeNull()
    expect(result.current.practitioner).toBeNull()
  })
})
