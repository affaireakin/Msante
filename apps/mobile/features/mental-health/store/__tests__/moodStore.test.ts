import { act } from 'react'
import { renderHook } from '@testing-library/react-hooks'
import { useMoodStore } from '../moodStore'

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}))

describe('moodStore', () => {
  beforeEach(() => act(() => { useMoodStore.getState().reset() }))

  it('starts with null todayScore', () => {
    const { result } = renderHook(() => useMoodStore())
    expect(result.current.todayScore).toBeNull()
  })

  it('addLocal sets todayScore', async () => {
    const { result } = renderHook(() => useMoodStore())
    await act(async () => {
      await result.current.addLocal({
        patientId: 'p1',
        score: 7,
        emotions: ['calm'],
        entryDate: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
      })
    })
    expect(result.current.todayScore).toBe(7)
    expect(result.current.localEntries).toHaveLength(1)
  })

  it('score < 3 is stored correctly (caller handles redirect)', async () => {
    const { result } = renderHook(() => useMoodStore())
    await act(async () => {
      await result.current.addLocal({
        patientId: 'p1',
        score: 2,
        emotions: ['sad'],
        entryDate: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
      })
    })
    expect(result.current.todayScore).toBe(2)
  })
})
