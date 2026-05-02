import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { JournalEntry } from '@/types/mentalHealth'

const LOCAL_JOURNAL_KEY = '@msante/local_journal'

interface JournalState {
  draft: Partial<JournalEntry>
  localEntries: JournalEntry[]

  loadLocal: () => Promise<void>
  setDraft: (fields: Partial<JournalEntry>) => void
  clearDraft: () => void
  addLocal: (entry: Omit<JournalEntry, 'id' | 'synced'>) => Promise<JournalEntry>
  reset: () => void
}

const initialState = {
  draft: {} as Partial<JournalEntry>,
  localEntries: [] as JournalEntry[],
}

export const useJournalStore = create<JournalState>((set, get) => ({
  ...initialState,

  loadLocal: async () => {
    const raw = await AsyncStorage.getItem(LOCAL_JOURNAL_KEY)
    const entries: JournalEntry[] = raw ? JSON.parse(raw) : []
    set({ localEntries: entries })
  },

  setDraft: (fields) => set(s => ({ draft: { ...s.draft, ...fields } })),
  clearDraft: () => set({ draft: {} }),

  addLocal: async (entry) => {
    const newEntry: JournalEntry = {
      ...entry,
      id: `local_${Date.now()}`,
      synced: false,
    }
    const updated = [newEntry, ...get().localEntries]
    await AsyncStorage.setItem(LOCAL_JOURNAL_KEY, JSON.stringify(updated))
    set({ localEntries: updated })
    return newEntry
  },

  reset: () => set(initialState),
}))
