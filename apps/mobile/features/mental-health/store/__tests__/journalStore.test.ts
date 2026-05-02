import { act } from 'react'
import { renderHook } from '@testing-library/react-hooks'
import { useJournalStore } from '../journalStore'

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}))

describe('journalStore', () => {
  beforeEach(() => act(() => { useJournalStore.getState().reset() }))

  it('starts with empty draft and entries', () => {
    const { result } = renderHook(() => useJournalStore())
    expect(result.current.draft).toEqual({})
    expect(result.current.localEntries).toHaveLength(0)
  })

  it('setDraft merges fields', () => {
    const { result } = renderHook(() => useJournalStore())
    act(() => result.current.setDraft({ title: 'Mon journal' }))
    act(() => result.current.setDraft({ content: 'Contenu...' }))
    expect(result.current.draft.title).toBe('Mon journal')
    expect(result.current.draft.content).toBe('Contenu...')
  })

  it('addLocal prepends entry', async () => {
    const { result } = renderHook(() => useJournalStore())
    await act(async () => {
      await result.current.addLocal({
        patientId: 'p1',
        content: 'Test entry',
        emotions: [],
        isPrivate: true,
        createdAt: new Date().toISOString(),
      })
    })
    expect(result.current.localEntries).toHaveLength(1)
    expect(result.current.localEntries[0].content).toBe('Test entry')
    expect(result.current.localEntries[0].synced).toBe(false)
  })
})
