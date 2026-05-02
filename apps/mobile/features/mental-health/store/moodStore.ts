import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { MoodEntry } from '@/types/mentalHealth'

const LOCAL_MOODS_KEY = '@msante/local_moods'

interface MoodState {
  localEntries: MoodEntry[]
  todayScore: number | null
  isSyncing: boolean

  loadLocal: () => Promise<void>
  addLocal: (entry: Omit<MoodEntry, 'id' | 'synced'>) => Promise<void>
  setTodayScore: (score: number) => void
  setSyncing: (v: boolean) => void
  reset: () => void
}

const initialState = {
  localEntries: [] as MoodEntry[],
  todayScore: null as number | null,
  isSyncing: false,
}

export const useMoodStore = create<MoodState>((set, get) => ({
  ...initialState,

  loadLocal: async () => {
    const raw = await AsyncStorage.getItem(LOCAL_MOODS_KEY)
    const entries: MoodEntry[] = raw ? JSON.parse(raw) : []
    const today = new Date().toISOString().split('T')[0]
    const todayEntry = entries.find(e => e.entryDate === today)
    set({ localEntries: entries, todayScore: todayEntry?.score ?? null })
  },

  addLocal: async (entry) => {
    const newEntry: MoodEntry = {
      ...entry,
      id: `local_${Date.now()}`,
      synced: false,
    }
    const updated = [...get().localEntries, newEntry]
    await AsyncStorage.setItem(LOCAL_MOODS_KEY, JSON.stringify(updated))
    set({ localEntries: updated, todayScore: newEntry.score })
  },

  setTodayScore: (score) => set({ todayScore: score }),
  setSyncing: (isSyncing) => set({ isSyncing }),
  reset: () => set(initialState),
}))
