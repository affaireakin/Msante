# P2 Mental Health Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add mood tracker, journal émotionnel (+ AI analysis), méditation guidée et assistant Ami (Claude Haiku) au mobile patient, avec offline support sur mood + journal.

**Architecture:** Module `features/mental-health/` monolithique avec sous-dossiers mood/journal/meditation/ai-companion. Zustand + AsyncStorage pour offline (append-only, sync via NetInfo). Deux Edge Functions Deno: `ami-analysis` (journal insights) et `ami-chat` (streaming Claude Haiku). UX alignée sur les fichiers HTML fournis dans le Drive.

**Tech Stack:** React Native + Expo SDK 52, NativeWind v4, Reanimated 3, Zustand v5, TanStack Query v5, @react-native-async-storage/async-storage, @react-native-community/netinfo, Supabase Edge Functions (Deno), Anthropic claude-haiku-4-5-20251001

---

## Task 1: DB Migration — mood_entries + journal_entries

**Files:**
- Create: `supabase/migrations/20260502000001_mental_health_tables.sql`

**Step 1: Create migration**

```sql
-- mood_entries table
CREATE TABLE IF NOT EXISTS public.mood_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  score INT NOT NULL CHECK (score BETWEEN 1 AND 10),
  emotions TEXT[] DEFAULT '{}',
  note TEXT,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mood_entries_patient_date
  ON mood_entries(patient_id, entry_date DESC);

ALTER TABLE public.mood_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "patients_own_mood" ON public.mood_entries
  FOR ALL USING (auth.uid() = patient_id);

-- journal_entries table
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT NOT NULL,
  mood_score INT CHECK (mood_score BETWEEN 1 AND 10),
  emotions TEXT[] DEFAULT '{}',
  ai_sentiment TEXT,
  ai_themes TEXT[] DEFAULT '{}',
  ai_suggestion TEXT,
  is_private BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_patient
  ON journal_entries(patient_id, created_at DESC);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "patients_own_journal" ON public.journal_entries
  FOR ALL USING (auth.uid() = patient_id);
```

**Step 2: Verify migration parses (dry-run)**

```bash
cd "c:/Users/Khodiaou/Desktop/m-santé app"
supabase db lint
```

Expected: no errors

**Step 3: Commit**

```bash
git add supabase/migrations/20260502000001_mental_health_tables.sql
git commit -m "feat(db): add mood_entries and journal_entries tables with RLS"
```

---

## Task 2: Types — MoodEntry, JournalEntry, AmiMessage

**Files:**
- Create: `apps/mobile/types/mentalHealth.ts`

**Step 1: Write types**

```typescript
export interface MoodEntry {
  id: string
  patientId: string
  score: number
  emotions: string[]
  note?: string
  entryDate: string
  createdAt: string
  synced?: boolean
}

export interface JournalEntry {
  id: string
  patientId: string
  title?: string
  content: string
  moodScore?: number
  emotions: string[]
  aiSentiment?: string
  aiThemes?: string[]
  aiSuggestion?: string
  isPrivate: boolean
  createdAt: string
  synced?: boolean
}

export interface AmiMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  showCrisis?: boolean
}

export const EMOTIONS = [
  { id: 'calm', label: 'Calme', icon: 'sentiment_satisfied' },
  { id: 'grateful', label: 'Reconnaissant', icon: 'sentiment_content' },
  { id: 'anxious', label: 'Anxieux', icon: 'water_drop' },
  { id: 'fatigued', label: 'Fatigué', icon: 'bedtime' },
  { id: 'hopeful', label: 'Confiant', icon: 'light_mode' },
  { id: 'sad', label: 'Triste', icon: 'sentiment_sad' },
  { id: 'angry', label: 'Irrité', icon: 'bolt' },
  { id: 'joyful', label: 'Joyeux', icon: 'celebration' },
] as const

export type EmotionId = typeof EMOTIONS[number]['id']

export const CRISIS_KEYWORDS = [
  'suicid', 'mourir', 'me tuer', 'fin de vie', 'plus envie de vivre',
  'désespoir', 'tout arrêter', 'plus la force',
]
```

**Step 2: Commit**

```bash
git add apps/mobile/types/mentalHealth.ts
git commit -m "feat(types): add MoodEntry, JournalEntry, AmiMessage types"
```

---

## Task 3: moodStore + offlineQueue

**Files:**
- Create: `apps/mobile/features/mental-health/store/moodStore.ts`
- Create: `apps/mobile/features/mental-health/store/offlineQueue.ts`

**Step 1: Write offlineQueue**

```typescript
// apps/mobile/features/mental-health/store/offlineQueue.ts
import AsyncStorage from '@react-native-async-storage/async-storage'

const MOOD_QUEUE_KEY = '@msante/mood_queue'
const JOURNAL_QUEUE_KEY = '@msante/journal_queue'

export interface QueuedMood {
  tempId: string
  score: number
  emotions: string[]
  note?: string
  entryDate: string
  createdAt: string
}

export interface QueuedJournal {
  tempId: string
  title?: string
  content: string
  moodScore?: number
  emotions: string[]
  createdAt: string
}

export async function enqueueMood(entry: QueuedMood): Promise<void> {
  const raw = await AsyncStorage.getItem(MOOD_QUEUE_KEY)
  const queue: QueuedMood[] = raw ? JSON.parse(raw) : []
  queue.push(entry)
  await AsyncStorage.setItem(MOOD_QUEUE_KEY, JSON.stringify(queue))
}

export async function dequeueMoods(): Promise<QueuedMood[]> {
  const raw = await AsyncStorage.getItem(MOOD_QUEUE_KEY)
  return raw ? JSON.parse(raw) : []
}

export async function clearMoodQueue(): Promise<void> {
  await AsyncStorage.removeItem(MOOD_QUEUE_KEY)
}

export async function enqueueJournal(entry: QueuedJournal): Promise<void> {
  const raw = await AsyncStorage.getItem(JOURNAL_QUEUE_KEY)
  const queue: QueuedJournal[] = raw ? JSON.parse(raw) : []
  queue.push(entry)
  await AsyncStorage.setItem(JOURNAL_QUEUE_KEY, JSON.stringify(queue))
}

export async function dequeueJournals(): Promise<QueuedJournal[]> {
  const raw = await AsyncStorage.getItem(JOURNAL_QUEUE_KEY)
  return raw ? JSON.parse(raw) : []
}

export async function clearJournalQueue(): Promise<void> {
  await AsyncStorage.removeItem(JOURNAL_QUEUE_KEY)
}
```

**Step 2: Write moodStore**

```typescript
// apps/mobile/features/mental-health/store/moodStore.ts
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
```

**Step 3: Commit**

```bash
git add apps/mobile/features/mental-health/store/
git commit -m "feat(mental-health): add moodStore and offlineQueue with AsyncStorage"
```

---

## Task 4: moodStore tests

**Files:**
- Create: `apps/mobile/features/mental-health/store/__tests__/moodStore.test.ts`

**Step 1: Write tests**

```typescript
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
```

**Step 2: Run tests**

```bash
cd "c:/Users/Khodiaou/Desktop/m-santé app"
pnpm --filter mobile test -- --testPathPattern="moodStore" --no-coverage
```

Expected: 3 tests passing

**Step 3: Commit**

```bash
git add apps/mobile/features/mental-health/store/__tests__/moodStore.test.ts
git commit -m "test(mental-health): add moodStore unit tests"
```

---

## Task 5: journalStore

**Files:**
- Create: `apps/mobile/features/mental-health/store/journalStore.ts`
- Create: `apps/mobile/features/mental-health/store/__tests__/journalStore.test.ts`

**Step 1: Write journalStore**

```typescript
// apps/mobile/features/mental-health/store/journalStore.ts
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
```

**Step 2: Write tests**

```typescript
// apps/mobile/features/mental-health/store/__tests__/journalStore.test.ts
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
```

**Step 3: Run tests**

```bash
pnpm --filter mobile test -- --testPathPattern="journalStore" --no-coverage
```

Expected: 3 tests passing

**Step 4: Commit**

```bash
git add apps/mobile/features/mental-health/store/journalStore.ts \
        apps/mobile/features/mental-health/store/__tests__/journalStore.test.ts
git commit -m "feat(mental-health): add journalStore + tests"
```

---

## Task 6: MoodSlider + EmotionPicker components

**Files:**
- Create: `apps/mobile/features/mental-health/mood/components/MoodSlider.tsx`
- Create: `apps/mobile/features/mental-health/mood/components/EmotionPicker.tsx`

**Step 1: Write MoodSlider**

```typescript
// apps/mobile/features/mental-health/mood/components/MoodSlider.tsx
import { View, Text } from 'react-native'
import Slider from '@react-native-community/slider'

const SCORE_EMOJI = ['', '😔','😟','😕','😐','🙂','😊','😄','😁','🥰','🤩']

interface Props {
  value: number
  onChange: (v: number) => void
}

export function MoodSlider({ value, onChange }: Props) {
  const emoji = SCORE_EMOJI[value] ?? '🙂'
  const pct = (value - 1) / 9

  return (
    <View className="gap-3">
      <View className="items-center gap-1">
        <Text style={{ fontSize: 48 }}>{emoji}</Text>
        <Text className="text-2xl font-bold text-on-surface font-manrope">{value}/10</Text>
      </View>
      <Slider
        minimumValue={1}
        maximumValue={10}
        step={1}
        value={value}
        onValueChange={onChange}
        minimumTrackTintColor={`hsl(${120 - pct * 120}, 60%, 45%)`}
        maximumTrackTintColor="#e5eeff"
        thumbTintColor="#006685"
        style={{ height: 40 }}
      />
      <View className="flex-row justify-between">
        <Text className="text-xs text-outline font-manrope">Très bas</Text>
        <Text className="text-xs text-outline font-manrope">Excellent</Text>
      </View>
    </View>
  )
}
```

**Step 2: Install slider dependency**

```bash
cd "c:/Users/Khodiaou/Desktop/m-santé app"
pnpm --filter mobile add @react-native-community/slider
```

**Step 3: Write EmotionPicker**

```typescript
// apps/mobile/features/mental-health/mood/components/EmotionPicker.tsx
import { View, Text, TouchableOpacity, ScrollView } from 'react-native'
import { EMOTIONS } from '@/types/mentalHealth'
import type { EmotionId } from '@/types/mentalHealth'

interface Props {
  selected: EmotionId[]
  onToggle: (id: EmotionId) => void
}

export function EmotionPicker({ selected, onToggle }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View className="flex-row gap-2 py-1">
        {EMOTIONS.map(e => {
          const active = selected.includes(e.id)
          return (
            <TouchableOpacity
              key={e.id}
              onPress={() => onToggle(e.id)}
              className={`flex-row items-center gap-2 px-4 py-2 rounded-full border ${
                active
                  ? 'bg-primary-container/40 border-primary/20'
                  : 'bg-surface-container/50 border-white/80'
              }`}
            >
              <Text className={`text-sm font-manrope ${active ? 'font-semibold text-on-primary-container' : 'text-on-surface'}`}>
                {e.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </ScrollView>
  )
}
```

**Step 4: Commit**

```bash
git add apps/mobile/features/mental-health/mood/components/
git commit -m "feat(mental-health): add MoodSlider and EmotionPicker components"
```

---

## Task 7: useMoodEntries hook

**Files:**
- Create: `apps/mobile/features/mental-health/mood/hooks/useMoodEntries.ts`

**Step 1: Write hook**

```typescript
// apps/mobile/features/mental-health/mood/hooks/useMoodEntries.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { useMoodStore } from '../../store/moodStore'
import { enqueueMood } from '../../store/offlineQueue'
import type { MoodEntry } from '@/types/mentalHealth'
import NetInfo from '@react-native-community/netinfo'

export function useMoodEntries(patientId: string) {
  return useQuery({
    queryKey: ['mood_entries', patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mood_entries')
        .select('*')
        .eq('patient_id', patientId)
        .order('entry_date', { ascending: false })
        .limit(30)
      if (error) throw error
      return data as MoodEntry[]
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useAddMoodEntry() {
  const qc = useQueryClient()
  const { addLocal } = useMoodStore()

  return useMutation({
    mutationFn: async (entry: {
      patientId: string
      score: number
      emotions: string[]
      note?: string
    }) => {
      const entryDate = new Date().toISOString().split('T')[0]
      const createdAt = new Date().toISOString()

      await addLocal({ ...entry, entryDate, createdAt })

      const netState = await NetInfo.fetch()
      if (!netState.isConnected) {
        await enqueueMood({ tempId: `q_${Date.now()}`, ...entry, entryDate, createdAt })
        return
      }

      const { error } = await supabase.from('mood_entries').insert({
        patient_id: entry.patientId,
        score: entry.score,
        emotions: entry.emotions,
        note: entry.note,
        entry_date: entryDate,
      })
      if (error) {
        await enqueueMood({ tempId: `q_${Date.now()}`, ...entry, entryDate, createdAt })
      }
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['mood_entries', v.patientId] }),
  })
}
```

**Step 2: Install NetInfo**

```bash
pnpm --filter mobile add @react-native-community/netinfo
```

**Step 3: Commit**

```bash
git add apps/mobile/features/mental-health/mood/hooks/useMoodEntries.ts
git commit -m "feat(mental-health): add useMoodEntries hook with offline support"
```

---

## Task 8: Mood screens — mood-checkin + mood-history

**Files:**
- Create: `apps/mobile/app/(patient)/mental-health/mood-checkin.tsx`
- Create: `apps/mobile/app/(patient)/mental-health/mood-history.tsx`

**Step 1: Write mood-checkin screen**

```typescript
// apps/mobile/app/(patient)/mental-health/mood-checkin.tsx
import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { MoodSlider } from '@/features/mental-health/mood/components/MoodSlider'
import { EmotionPicker } from '@/features/mental-health/mood/components/EmotionPicker'
import { useAddMoodEntry } from '@/features/mental-health/mood/hooks/useMoodEntries'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { PrimaryButton } from '@/components/ui'
import type { EmotionId } from '@/types/mentalHealth'

export default function MoodCheckin() {
  const router = useRouter()
  const { profile } = useAuth()
  const [score, setScore] = useState(6)
  const [emotions, setEmotions] = useState<EmotionId[]>([])
  const addMood = useAddMoodEntry()

  const toggleEmotion = (id: EmotionId) => {
    setEmotions(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id])
  }

  const handleSave = async () => {
    if (!profile?.id) return
    await addMood.mutateAsync({ patientId: profile.id, score, emotions })
    if (score < 3) {
      Alert.alert(
        'Prendre soin de soi 💙',
        'Votre humeur semble basse. Parler à un praticien peut aider.',
        [
          { text: 'Plus tard', onPress: () => router.back() },
          { text: 'Trouver un praticien', onPress: () => router.push('/(patient)/find-practitioners') },
        ]
      )
    } else {
      router.back()
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="fixed top-0 left-0 right-0 bottom-0 pointer-events-none">
        <View className="absolute w-96 h-96 rounded-full bg-primary-fixed/40 -top-20 -left-20"
          style={{ filter: 'blur(100px)' }} />
      </View>
      <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="pt-8 pb-6 flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()}>
            <Text className="text-primary text-2xl">←</Text>
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-on-surface font-manrope">Comment vous sentez-vous ?</Text>
        </View>
        <View className="bg-white/60 rounded-3xl p-6 gap-8 border border-white/50"
          style={{ shadowColor: '#006685', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.05, shadowRadius: 30, elevation: 3 }}>
          <MoodSlider value={score} onChange={setScore} />
          <View className="gap-3">
            <Text className="text-sm font-semibold text-on-surface-variant font-manrope uppercase tracking-wider">Vos émotions</Text>
            <EmotionPicker selected={emotions} onToggle={toggleEmotion} />
          </View>
        </View>
        <View className="mt-6">
          <PrimaryButton label="Enregistrer" onPress={handleSave} loading={addMood.isPending} />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
```

**Step 2: Write mood-history screen**

```typescript
// apps/mobile/app/(patient)/mental-health/mood-history.tsx
import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useMoodEntries } from '@/features/mental-health/mood/hooks/useMoodEntries'
import { useAuth } from '@/features/auth/hooks/useAuth'

const DAYS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

export default function MoodHistory() {
  const router = useRouter()
  const { profile } = useAuth()
  const { data: entries = [], isLoading } = useMoodEntries(profile?.id ?? '')

  const last7: { label: string; score: number | null }[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const dateStr = d.toISOString().split('T')[0]
    const entry = entries.find(e => e.entryDate === dateStr)
    return { label: DAYS[d.getDay()], score: entry?.score ?? null }
  })

  const maxH = 180

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1 px-6">
        <View className="pt-8 pb-6 flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()}>
            <Text className="text-primary text-2xl">←</Text>
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-on-surface font-manrope">Historique humeur</Text>
        </View>
        <View className="bg-white/60 rounded-3xl p-6 border border-white/50"
          style={{ shadowColor: '#006685', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.05, shadowRadius: 30, elevation: 3 }}>
          <View className="flex-row items-end justify-between gap-2" style={{ height: maxH + 40 }}>
            {last7.map((day, i) => {
              const barH = day.score ? (day.score / 10) * maxH : 8
              const isToday = i === 6
              return (
                <View key={i} className="flex-1 items-center gap-2">
                  <View
                    className={`w-full rounded-t-xl ${isToday ? 'bg-primary' : 'bg-primary-container/40'}`}
                    style={{ height: barH }}
                  />
                  <Text className={`text-xs font-manrope ${isToday ? 'text-primary font-bold' : 'text-outline'}`}>
                    {day.label}
                  </Text>
                </View>
              )
            })}
          </View>
          {entries.length > 0 && (
            <View className="mt-4 bg-surface-container-low rounded-2xl p-4 flex-row items-center gap-3">
              <Text className="text-2xl">💡</Text>
              <Text className="flex-1 text-sm text-on-surface font-manrope">
                Score moyen 7j : {(entries.slice(0, 7).reduce((a, e) => a + e.score, 0) / Math.min(entries.length, 7)).toFixed(1)}/10
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
```

**Step 3: Commit**

```bash
git add apps/mobile/app/\(patient\)/mental-health/mood-checkin.tsx \
        apps/mobile/app/\(patient\)/mental-health/mood-history.tsx
git commit -m "feat(mental-health): add mood-checkin and mood-history screens"
```

---

## Task 9: useJournalEntries + useJournalAnalysis hooks

**Files:**
- Create: `apps/mobile/features/mental-health/journal/hooks/useJournalEntries.ts`
- Create: `apps/mobile/features/mental-health/journal/hooks/useJournalAnalysis.ts`

**Step 1: Write useJournalEntries**

```typescript
// apps/mobile/features/mental-health/journal/hooks/useJournalEntries.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { useJournalStore } from '../../store/journalStore'
import { enqueueJournal } from '../../store/offlineQueue'
import type { JournalEntry } from '@/types/mentalHealth'
import NetInfo from '@react-native-community/netinfo'

export function useJournalEntries(patientId: string) {
  return useQuery({
    queryKey: ['journal_entries', patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data as JournalEntry[]
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateJournalEntry() {
  const qc = useQueryClient()
  const { addLocal, clearDraft } = useJournalStore()

  return useMutation({
    mutationFn: async (entry: {
      patientId: string
      title?: string
      content: string
      moodScore?: number
      emotions: string[]
    }): Promise<string> => {
      const createdAt = new Date().toISOString()
      const local = await addLocal({ ...entry, isPrivate: true, createdAt })

      const netState = await NetInfo.fetch()
      if (!netState.isConnected) {
        await enqueueJournal({ tempId: local.id, ...entry, createdAt })
        return local.id
      }

      const { data, error } = await supabase
        .from('journal_entries')
        .insert({
          patient_id: entry.patientId,
          title: entry.title,
          content: entry.content,
          mood_score: entry.moodScore,
          emotions: entry.emotions,
          is_private: true,
        })
        .select('id')
        .single()
      if (error) throw error
      clearDraft()
      return data.id
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['journal_entries', v.patientId] }),
  })
}
```

**Step 2: Write useJournalAnalysis**

```typescript
// apps/mobile/features/mental-health/journal/hooks/useJournalAnalysis.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'

interface AnalysisResult {
  sentiment: string
  themes: string[]
  suggestion: string
}

export function useJournalAnalysis() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      journalId,
      content,
      moodScore,
      patientId,
    }: {
      journalId: string
      content: string
      moodScore?: number
      patientId: string
    }): Promise<AnalysisResult> => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ami-analysis`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ journalId, content, moodScore }),
        }
      )
      if (!res.ok) throw new Error('Analysis failed')
      return res.json()
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['journal_entries', v.patientId] }),
  })
}
```

**Step 3: Commit**

```bash
git add apps/mobile/features/mental-health/journal/hooks/
git commit -m "feat(mental-health): add useJournalEntries and useJournalAnalysis hooks"
```

---

## Task 10: Journal components — JournalCard + AIInsightCard

**Files:**
- Create: `apps/mobile/features/mental-health/journal/components/JournalCard.tsx`
- Create: `apps/mobile/features/mental-health/journal/components/AIInsightCard.tsx`

**Step 1: Write JournalCard**

```typescript
// apps/mobile/features/mental-health/journal/components/JournalCard.tsx
import { View, Text, TouchableOpacity } from 'react-native'
import type { JournalEntry } from '@/types/mentalHealth'

const SCORE_DOT_COLOR: Record<number, string> = {
  1: '#ba1a1a', 2: '#ba1a1a', 3: '#e4c546',
  4: '#e4c546', 5: '#e4c546', 6: '#1d7a3a',
  7: '#1d7a3a', 8: '#1d7a3a', 9: '#006685', 10: '#006685',
}

interface Props {
  entry: JournalEntry
  onPress: () => void
}

export function JournalCard({ entry, onPress }: Props) {
  const date = new Date(entry.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  const dotColor = entry.moodScore ? SCORE_DOT_COLOR[entry.moodScore] ?? '#6f787e' : '#6f787e'

  return (
    <TouchableOpacity
      onPress={onPress}
      className="p-3 rounded-xl border border-transparent bg-white/40"
      style={{ shadowColor: '#006685', shadowOpacity: 0.03, shadowRadius: 8, elevation: 1 }}
    >
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-sm font-semibold text-on-surface font-manrope flex-1 mr-2" numberOfLines={1}>
          {entry.title ?? 'Sans titre'}
        </Text>
        <Text className="text-xs text-outline font-manrope">{date}</Text>
      </View>
      <Text className="text-sm text-on-surface-variant font-manrope" numberOfLines={2}>
        {entry.content}
      </Text>
      <View className="flex-row gap-1 mt-2">
        <View className="w-2 h-2 rounded-full" style={{ backgroundColor: dotColor }} />
      </View>
    </TouchableOpacity>
  )
}
```

**Step 2: Write AIInsightCard**

```typescript
// apps/mobile/features/mental-health/journal/components/AIInsightCard.tsx
import { View, Text } from 'react-native'

interface Props {
  sentiment: string
  themes: string[]
  suggestion: string
}

export function AIInsightCard({ sentiment, themes, suggestion }: Props) {
  return (
    <View className="bg-primary-fixed/30 rounded-2xl p-4 gap-3 border border-white/60">
      <View className="flex-row items-center gap-2">
        <Text className="text-lg">✨</Text>
        <Text className="text-sm font-semibold text-primary font-manrope uppercase tracking-wider">Insights Ami</Text>
      </View>
      <View className="gap-1">
        <Text className="text-xs text-on-surface-variant font-manrope">Sentiment détecté</Text>
        <Text className="text-sm font-semibold text-on-surface font-manrope capitalize">{sentiment}</Text>
      </View>
      {themes.length > 0 && (
        <View className="flex-row flex-wrap gap-2">
          {themes.map(t => (
            <View key={t} className="px-3 py-1 rounded-full bg-primary-container/40">
              <Text className="text-xs text-on-primary-container font-manrope">{t}</Text>
            </View>
          ))}
        </View>
      )}
      <Text className="text-sm text-on-surface font-manrope italic">{suggestion}</Text>
      <Text className="text-xs text-outline font-manrope">Cet espace ne remplace pas un professionnel de santé.</Text>
    </View>
  )
}
```

**Step 3: Commit**

```bash
git add apps/mobile/features/mental-health/journal/components/
git commit -m "feat(mental-health): add JournalCard and AIInsightCard components"
```

---

## Task 11: Journal screens

**Files:**
- Create: `apps/mobile/app/(patient)/mental-health/journal/index.tsx`
- Create: `apps/mobile/app/(patient)/mental-health/journal/new.tsx`
- Create: `apps/mobile/app/(patient)/mental-health/journal/[id].tsx`

**Step 1: Write journal list screen**

```typescript
// apps/mobile/app/(patient)/mental-health/journal/index.tsx
import { View, Text, FlatList, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useJournalEntries } from '@/features/mental-health/journal/hooks/useJournalEntries'
import { JournalCard } from '@/features/mental-health/journal/components/JournalCard'
import { useAuth } from '@/features/auth/hooks/useAuth'

export default function JournalList() {
  const router = useRouter()
  const { profile } = useAuth()
  const { data: entries = [], isLoading } = useJournalEntries(profile?.id ?? '')

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-6 pt-8 pb-4 flex-row items-center justify-between">
        <View>
          <Text className="text-xs text-primary font-manrope uppercase tracking-wider">Wellness Space</Text>
          <Text className="text-2xl font-bold text-on-surface font-manrope">Mon Journal</Text>
        </View>
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-sm text-outline font-manrope">Retour</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={entries}
        keyExtractor={e => e.id}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100, gap: 8 }}
        renderItem={({ item }) => (
          <JournalCard
            entry={item}
            onPress={() => router.push(`/(patient)/mental-health/journal/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <View className="items-center py-16 gap-3">
            <Text className="text-4xl">📓</Text>
            <Text className="text-sm text-outline font-manrope text-center">Votre journal est vide.{'\n'}Commencez à écrire.</Text>
          </View>
        }
      />
      <TouchableOpacity
        onPress={() => router.push('/(patient)/mental-health/journal/new')}
        className="absolute bottom-8 right-6 w-14 h-14 bg-primary rounded-full items-center justify-center"
        style={{ shadowColor: '#006685', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 30, elevation: 8 }}
      >
        <Text className="text-white text-2xl">+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}
```

**Step 2: Write journal new screen**

```typescript
// apps/mobile/app/(patient)/mental-health/journal/new.tsx
import { useState } from 'react'
import { View, Text, TextInput, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { EmotionPicker } from '@/features/mental-health/mood/components/EmotionPicker'
import { useCreateJournalEntry } from '@/features/mental-health/journal/hooks/useJournalEntries'
import { useAuth } from '@/features/auth/hooks/useAuth'
import type { EmotionId } from '@/types/mentalHealth'

const REFLECTION_PROMPTS = [
  'Quelle sensation physique est la plus présente en ce moment ?',
  'Identifiez une petite victoire des dernières 24 heures.',
  'Si votre humeur avait une couleur, laquelle serait-ce ?',
]

export default function JournalNew() {
  const router = useRouter()
  const { profile } = useAuth()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [emotions, setEmotions] = useState<EmotionId[]>([])
  const createEntry = useCreateJournalEntry()

  const toggleEmotion = (id: EmotionId) => {
    setEmotions(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id])
  }

  const handleSave = async () => {
    if (!content.trim() || !profile?.id) return
    const id = await createEntry.mutateAsync({
      patientId: profile.id,
      title: title.trim() || undefined,
      content: content.trim(),
      emotions,
    })
    router.replace(`/(patient)/mental-health/journal/${id}`)
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <View className="px-6 pt-6 pb-3 flex-row items-center justify-between">
          <TouchableOpacity onPress={() => router.back()}>
            <Text className="text-primary text-2xl">←</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSave}
            disabled={!content.trim() || createEntry.isPending}
            className="bg-primary px-5 py-2 rounded-full"
          >
            <Text className="text-white text-sm font-semibold font-manrope">Enregistrer</Text>
          </TouchableOpacity>
        </View>
        <ScrollView className="flex-1 px-6">
          <View className="bg-white/60 rounded-3xl p-6 min-h-96 border border-white/50 gap-4"
            style={{ shadowColor: '#006685', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.06, shadowRadius: 40, elevation: 4 }}>
            <View className="border-b-2 border-transparent pb-4" style={{ borderBottomColor: title ? '#82d8ff' : 'transparent' }}>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Titre de l'entrée..."
                placeholderTextColor="#6f787e66"
                className="text-2xl font-semibold text-on-surface font-manrope"
                style={{ fontFamily: 'Manrope', fontSize: 22, fontWeight: '600' }}
              />
            </View>
            <View className="gap-2">
              <Text className="text-xs text-on-surface-variant font-manrope uppercase tracking-wider">Vos émotions</Text>
              <EmotionPicker selected={emotions} onToggle={toggleEmotion} />
            </View>
            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="Écrivez librement. Comment votre esprit traite-t-il la journée ?"
              placeholderTextColor="#6f787e44"
              multiline
              className="text-base text-on-surface-variant font-manrope flex-1"
              style={{ fontFamily: 'Manrope', minHeight: 200, textAlignVertical: 'top', lineHeight: 24 }}
            />
          </View>
          <View className="mt-6 bg-primary-fixed/30 rounded-2xl p-5 gap-3 border border-white/60">
            <Text className="text-xs text-on-surface-variant font-manrope uppercase tracking-wider">Réflexions guidées</Text>
            {REFLECTION_PROMPTS.map((p, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => setContent(prev => prev + (prev ? '\n\n' : '') + p + '\n')}
                className="bg-white/50 rounded-xl p-4 border border-white/40"
              >
                <Text className="text-sm text-on-surface font-manrope">{p}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
```

**Step 3: Write journal detail screen**

```typescript
// apps/mobile/app/(patient)/mental-health/journal/[id].tsx
import { useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { AIInsightCard } from '@/features/mental-health/journal/components/AIInsightCard'
import { useJournalAnalysis } from '@/features/mental-health/journal/hooks/useJournalAnalysis'
import { useAuth } from '@/features/auth/hooks/useAuth'
import type { JournalEntry } from '@/types/mentalHealth'

export default function JournalDetail() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { profile } = useAuth()
  const analyze = useJournalAnalysis()

  const { data: entry } = useQuery({
    queryKey: ['journal_entry', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('journal_entries').select('*').eq('id', id).single()
      if (error) throw error
      return data as JournalEntry
    },
    enabled: !!id && !id.startsWith('local_'),
  })

  useEffect(() => {
    if (entry && !entry.aiSentiment && profile?.id) {
      analyze.mutate({
        journalId: entry.id,
        content: entry.content,
        moodScore: entry.moodScore,
        patientId: profile.id,
      })
    }
  }, [entry?.id])

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-6 pt-6 pb-3 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-primary text-2xl">←</Text>
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-on-surface font-manrope flex-1" numberOfLines={1}>
          {entry?.title ?? 'Entrée journal'}
        </Text>
      </View>
      <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingBottom: 40, gap: 16 }}>
        <View className="bg-white/60 rounded-3xl p-6 border border-white/50">
          <Text className="text-sm text-outline font-manrope mb-4">
            {entry ? new Date(entry.createdAt).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : ''}
          </Text>
          <Text className="text-base text-on-surface font-manrope leading-relaxed">{entry?.content}</Text>
        </View>
        {entry?.aiSentiment && (
          <AIInsightCard
            sentiment={entry.aiSentiment}
            themes={entry.aiThemes ?? []}
            suggestion={entry.aiSuggestion ?? ''}
          />
        )}
        {analyze.isPending && (
          <View className="bg-primary-fixed/20 rounded-2xl p-4 items-center">
            <Text className="text-sm text-primary font-manrope">✨ Ami analyse votre entrée...</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
```

**Step 4: Commit**

```bash
git add "apps/mobile/app/(patient)/mental-health/journal/"
git commit -m "feat(mental-health): add journal list, new and detail screens"
```

---

## Task 12: ami-analysis Edge Function

**Files:**
- Create: `supabase/functions/ami-analysis/index.ts`

**Step 1: Write Edge Function**

```typescript
// supabase/functions/ami-analysis/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    const { journalId, content, moodScore } = await req.json()
    if (!content) return new Response('Missing content', { status: 400, headers: corsHeaders })

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: `Tu es Ami, un assistant bien-être bienveillant. Analyse cette entrée de journal.
Réponds UNIQUEMENT en JSON valide avec ce format exact :
{"sentiment": "string", "themes": ["theme1", "theme2"], "suggestion": "string"}
- sentiment: en 1-3 mots (ex: "anxieux", "serein", "reconnaissant")
- themes: 2-3 thèmes identifiés (ex: "stress au travail", "relations")
- suggestion: 1 phrase douce et bienveillante, non-clinique
N'inclus AUCUN autre texte.`,
      messages: [{ role: 'user', content: `Score humeur: ${moodScore ?? 'non renseigné'}/10\n\n${content}` }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : '{}'
    const result = JSON.parse(raw)

    if (journalId && !journalId.startsWith('local_')) {
      const sbAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )
      await sbAdmin.from('journal_entries').update({
        ai_sentiment: result.sentiment,
        ai_themes: result.themes,
        ai_suggestion: result.suggestion,
      }).eq('id', journalId)
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
```

**Step 2: Commit**

```bash
git add supabase/functions/ami-analysis/
git commit -m "feat(edge): add ami-analysis Edge Function (journal AI insights)"
```

---

## Task 13: BreathingRing + useMeditationTimer

**Files:**
- Create: `apps/mobile/features/mental-health/meditation/components/BreathingRing.tsx`
- Create: `apps/mobile/features/mental-health/meditation/hooks/useMeditationTimer.ts`

**Step 1: Write BreathingRing**

```typescript
// apps/mobile/features/mental-health/meditation/components/BreathingRing.tsx
import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming,
  withSequence, Easing,
} from 'react-native-reanimated'

interface Props {
  isActive: boolean
  size?: number
}

export function BreathingRing({ isActive, size = 128 }: Props) {
  const scale = useSharedValue(0.85)
  const opacity = useSharedValue(0.4)

  useEffect(() => {
    if (isActive) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 4000, easing: Easing.bezier(0.4, 0, 0.2, 1) }),
          withTiming(0.85, { duration: 4000, easing: Easing.bezier(0.4, 0, 0.2, 1) })
        ),
        -1, false
      )
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.8, { duration: 4000 }),
          withTiming(0.4, { duration: 4000 })
        ),
        -1, false
      )
    } else {
      scale.value = withTiming(0.85)
      opacity.value = withTiming(0.4)
    }
  }, [isActive])

  const outerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))

  return (
    <View style={{ width: size * 2, height: size * 2, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[outerStyle, {
          position: 'absolute', width: size * 2, height: size * 2, borderRadius: size,
          backgroundColor: '#bee9ff4d',
        }]}
      />
      <View style={{
        position: 'absolute', width: size * 1.5, height: size * 1.5, borderRadius: size,
        backgroundColor: '#006685', opacity: 0.15,
      }} />
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: '#006685',
        shadowColor: '#006685', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 40,
        alignItems: 'center', justifyContent: 'center',
        elevation: 8,
      }} />
    </View>
  )
}
```

**Step 2: Write useMeditationTimer**

```typescript
// apps/mobile/features/mental-health/meditation/hooks/useMeditationTimer.ts
import { useState, useEffect, useRef } from 'react'

export type BreathPhase = 'inhale' | 'hold' | 'exhale' | 'hold2'

interface PhaseConfig {
  phase: BreathPhase
  duration: number
  label: string
}

const TECHNIQUES: Record<string, PhaseConfig[]> = {
  coherence: [
    { phase: 'inhale', duration: 5, label: 'Inspirez' },
    { phase: 'exhale', duration: 5, label: 'Expirez' },
  ],
  box: [
    { phase: 'inhale', duration: 4, label: 'Inspirez' },
    { phase: 'hold', duration: 4, label: 'Retenez' },
    { phase: 'exhale', duration: 4, label: 'Expirez' },
    { phase: 'hold2', duration: 4, label: 'Retenez' },
  ],
  '478': [
    { phase: 'inhale', duration: 4, label: 'Inspirez' },
    { phase: 'hold', duration: 7, label: 'Retenez' },
    { phase: 'exhale', duration: 8, label: 'Expirez' },
  ],
}

export function useMeditationTimer(technique: string, totalSeconds: number) {
  const [isActive, setIsActive] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [phaseElapsed, setPhaseElapsed] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const phases = TECHNIQUES[technique] ?? TECHNIQUES.coherence

  useEffect(() => {
    if (isActive) {
      intervalRef.current = setInterval(() => {
        setElapsed(e => {
          if (e + 1 >= totalSeconds) {
            setIsActive(false)
            return totalSeconds
          }
          return e + 1
        })
        setPhaseElapsed(pe => {
          const currentPhase = phases[phaseIndex]
          if (pe + 1 >= currentPhase.duration) {
            setPhaseIndex(i => (i + 1) % phases.length)
            return 0
          }
          return pe + 1
        })
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [isActive, phaseIndex, totalSeconds])

  const currentPhase = phases[phaseIndex]
  const progress = elapsed / totalSeconds
  const isComplete = elapsed >= totalSeconds

  return {
    isActive, elapsed, progress, isComplete,
    currentLabel: currentPhase.label,
    phaseProgress: phaseElapsed / currentPhase.duration,
    start: () => { setElapsed(0); setPhaseIndex(0); setPhaseElapsed(0); setIsActive(true) },
    stop: () => setIsActive(false),
    reset: () => { setIsActive(false); setElapsed(0); setPhaseIndex(0); setPhaseElapsed(0) },
  }
}
```

**Step 3: Commit**

```bash
git add apps/mobile/features/mental-health/meditation/
git commit -m "feat(mental-health): add BreathingRing component and useMeditationTimer hook"
```

---

## Task 14: Meditation screens

**Files:**
- Create: `apps/mobile/app/(patient)/mental-health/meditation/index.tsx`
- Create: `apps/mobile/app/(patient)/mental-health/meditation/session.tsx`

**Step 1: Write meditation catalogue**

```typescript
// apps/mobile/app/(patient)/mental-health/meditation/index.tsx
import { View, Text, FlatList, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'

const SESSIONS = [
  { id: 'coherence', title: 'Cohérence cardiaque', duration: 300, technique: 'coherence', desc: 'Inspirez 5s / Expirez 5s' },
  { id: 'box', title: 'Box Breathing', duration: 480, technique: 'box', desc: '4-4-4-4 · Clarté mentale' },
  { id: '478', title: 'Relaxation profonde', duration: 1200, technique: '478', desc: '4-7-8 · Réduction stress' },
]

export default function MeditationCatalogue() {
  const router = useRouter()

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-6 pt-8 pb-6">
        <Text className="text-xs text-primary font-manrope uppercase tracking-wider mb-1">Wellness Space</Text>
        <Text className="text-2xl font-bold text-on-surface font-manrope">Méditation guidée</Text>
        <Text className="text-sm text-tertiary font-manrope mt-1">Inspirez confiance, expirez la tension</Text>
      </View>
      <FlatList
        data={SESSIONS}
        keyExtractor={s => s.id}
        contentContainerStyle={{ paddingHorizontal: 24, gap: 16, paddingBottom: 100 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/(patient)/mental-health/meditation/session', params: { technique: item.technique, duration: item.duration, title: item.title } })}
            className="bg-white/60 rounded-3xl p-6 border border-white/50 flex-row items-center gap-4"
            style={{ shadowColor: '#006685', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.05, shadowRadius: 24, elevation: 3 }}
          >
            <View className="w-14 h-14 rounded-2xl bg-primary-container/30 items-center justify-center">
              <Text className="text-2xl">🌬️</Text>
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-on-surface font-manrope">{item.title}</Text>
              <Text className="text-sm text-outline font-manrope">{item.desc}</Text>
              <Text className="text-xs text-primary font-manrope mt-1">{Math.round(item.duration / 60)} min</Text>
            </View>
            <Text className="text-primary text-xl">→</Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  )
}
```

**Step 2: Write meditation session screen**

```typescript
// apps/mobile/app/(patient)/mental-health/meditation/session.tsx
import { View, Text, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import Animated, { useAnimatedStyle, withTiming, useSharedValue, useEffect } from 'react-native-reanimated'
import { BreathingRing } from '@/features/mental-health/meditation/components/BreathingRing'
import { useMeditationTimer } from '@/features/mental-health/meditation/hooks/useMeditationTimer'

export default function MeditationSession() {
  const router = useRouter()
  const { technique = 'coherence', duration = '300', title = 'Méditation' } = useLocalSearchParams<{ technique: string; duration: string; title: string }>()
  const totalSec = Number(duration)

  const { isActive, progress, currentLabel, isComplete, start, stop, reset } = useMeditationTimer(technique, totalSec)

  const remaining = Math.max(0, totalSec - Math.round(progress * totalSec))
  const mins = Math.floor(remaining / 60).toString().padStart(2, '0')
  const secs = (remaining % 60).toString().padStart(2, '0')

  return (
    <SafeAreaView className="flex-1 bg-background items-center">
      <View className="fixed top-0 left-0 right-0 bottom-0 pointer-events-none">
        <View className="absolute w-96 h-96 rounded-full bg-primary-fixed/40 -top-20 -left-20"
          style={{ position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: '#bee9ff66', top: -60, left: -60 }} />
      </View>
      <View className="w-full px-6 pt-6 flex-row items-center justify-between">
        <TouchableOpacity onPress={() => { reset(); router.back() }}>
          <Text className="text-primary text-2xl">←</Text>
        </TouchableOpacity>
        <Text className="text-base font-semibold text-on-surface font-manrope">{title}</Text>
        <View style={{ width: 32 }} />
      </View>
      <View className="flex-1 items-center justify-center gap-8">
        <BreathingRing isActive={isActive} size={80} />
        <View className="items-center gap-2">
          <Text className="text-2xl font-bold text-on-surface font-manrope">{currentLabel}</Text>
          <Text className="text-4xl font-bold text-primary font-manrope">{mins}:{secs}</Text>
        </View>
        {isComplete ? (
          <View className="items-center gap-4">
            <Text className="text-lg font-semibold text-on-surface font-manrope">Session terminée 🎉</Text>
            <TouchableOpacity
              onPress={() => router.back()}
              className="bg-primary px-8 py-3 rounded-full"
            >
              <Text className="text-white font-semibold font-manrope">Retour</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            onPress={isActive ? stop : start}
            className={`px-10 py-4 rounded-full ${isActive ? 'bg-outline/20 border border-outline' : 'bg-primary'}`}
            style={{ shadowColor: '#006685', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 5 }}
          >
            <Text className={`font-semibold font-manrope text-sm uppercase tracking-wider ${isActive ? 'text-on-surface' : 'text-white'}`}>
              {isActive ? 'Pause' : 'Commencer'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  )
}
```

**Step 3: Commit**

```bash
git add "apps/mobile/app/(patient)/mental-health/meditation/"
git commit -m "feat(mental-health): add meditation catalogue and session screens"
```

---

## Task 15: Ami system prompt + ami-chat Edge Function

**Files:**
- Create: `apps/mobile/features/mental-health/ai-companion/constants/systemPrompt.ts`
- Create: `supabase/functions/ami-chat/index.ts`

**Step 1: Write systemPrompt**

```typescript
// apps/mobile/features/mental-health/ai-companion/constants/systemPrompt.ts
export const AMI_SYSTEM_PROMPT = `Tu es Ami, l'assistant bien-être de M-Santé.
Tu n'es PAS un médecin, thérapeute, ou professionnel de santé.
Tu offres un espace d'écoute bienveillant et de soutien émotionnel.

RÈGLES ABSOLUES :
- Ne diagnostique JAMAIS une condition médicale ou psychiatrique
- Ne prescris JAMAIS de traitement, médicament, ou thérapie  
- Ne promets JAMAIS de guérison ou d'amélioration garantie
- Si l'utilisateur exprime une détresse sévère, des pensées suicidaires ou une urgence :
  réponds avec "CRISIS_DETECTED" sur la première ligne, puis ta réponse bienveillante
- Termine chaque réponse par : "💙 Cet espace ne remplace pas un professionnel de santé."

Langue : français. Ton : chaleureux, empathique, non-clinique. Réponses courtes (3-5 phrases max).`

export const CRISIS_KEYWORDS_REGEX = /suicid|mourir|me tuer|fin de vie|plus envie de vivre|désespoir total|tout arrêter|plus la force/i
```

**Step 2: Write ami-chat Edge Function**

```typescript
// supabase/functions/ami-chat/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const AMI_SYSTEM = `Tu es Ami, l'assistant bien-être de M-Santé.
Tu n'es PAS un médecin ou thérapeute.
Tu offres un espace d'écoute bienveillant.
RÈGLES : Ne diagnostique jamais. Ne prescris jamais.
Si détresse sévère ou pensées suicidaires : commence ta réponse par "CRISIS_DETECTED\n"
puis offre soutien et mentionne SOS Amitié Sénégal +221 33 823 8020.
Termine par : "💙 Cet espace ne remplace pas un professionnel de santé."
Langue : français. Ton : chaleureux. Réponses courtes (3-5 phrases).`

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

    const { messages } = await req.json()
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response('Missing messages', { status: 400, headers: corsHeaders })
    }

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: AMI_SYSTEM,
      messages: messages.slice(-10),
    })

    const content = response.content[0].type === 'text' ? response.content[0].text : ''
    const isCrisis = content.startsWith('CRISIS_DETECTED')
    const text = isCrisis ? content.replace(/^CRISIS_DETECTED\n?/, '') : content

    return new Response(JSON.stringify({ text, isCrisis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
```

**Step 3: Commit**

```bash
git add apps/mobile/features/mental-health/ai-companion/constants/systemPrompt.ts \
        supabase/functions/ami-chat/
git commit -m "feat(edge): add ami-chat Edge Function (Claude Haiku streaming)"
```

---

## Task 16: Ami components — ChatBubble + ActionCards + CrisisCard

**Files:**
- Create: `apps/mobile/features/mental-health/ai-companion/components/ChatBubble.tsx`
- Create: `apps/mobile/features/mental-health/ai-companion/components/ActionCards.tsx`
- Create: `apps/mobile/features/mental-health/ai-companion/components/CrisisCard.tsx`

**Step 1: Write ChatBubble**

```typescript
// apps/mobile/features/mental-health/ai-companion/components/ChatBubble.tsx
import { View, Text } from 'react-native'
import type { AmiMessage } from '@/types/mentalHealth'

interface Props {
  message: AmiMessage
}

export function ChatBubble({ message }: Props) {
  const isUser = message.role === 'user'
  const time = new Date(message.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  if (isUser) {
    return (
      <View className="self-end max-w-[85%]">
        <View className="bg-surface-container-low/80 rounded-2xl rounded-tr-none p-5 border border-white/50"
          style={{ shadowColor: '#006685', shadowOpacity: 0.05, shadowRadius: 8, elevation: 1 }}>
          <Text className="text-sm text-on-surface font-manrope">{message.content}</Text>
        </View>
        <Text className="text-right text-[10px] text-outline font-manrope mt-1 mr-2">{time}</Text>
      </View>
    )
  }

  return (
    <View className="self-start max-w-[90%] mt-4">
      <View className="bg-surface-container/60 rounded-2xl rounded-tl-none p-5 border border-white/50 border-l-4 border-l-primary-container"
        style={{ shadowColor: '#006685', shadowOpacity: 0.05, shadowRadius: 8, elevation: 1 }}>
        <View className="flex-row items-center gap-2 mb-2">
          <Text className="text-xs font-semibold text-primary font-manrope uppercase tracking-wider">M-Santé Assistant</Text>
        </View>
        <Text className="text-sm text-on-surface font-manrope leading-relaxed">{message.content}</Text>
      </View>
    </View>
  )
}
```

**Step 2: Write ActionCards**

```typescript
// apps/mobile/features/mental-health/ai-companion/components/ActionCards.tsx
import { View, Text, TouchableOpacity, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'

interface Props {
  showCrisis?: boolean
}

export function ActionCards({ showCrisis = false }: Props) {
  const router = useRouter()

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-6 px-6">
      <View className="flex-row gap-4 py-2">
        <View className="bg-white/60 rounded-xl p-5 w-64 border border-white/50 gap-4"
          style={{ shadowColor: '#006685', shadowOpacity: 0.05, shadowRadius: 16, elevation: 2 }}>
          <View className="w-10 h-10 rounded-full bg-primary-container/30 items-center justify-center">
            <Text className="text-xl">🌬️</Text>
          </View>
          <View>
            <Text className="text-base font-semibold text-on-surface font-manrope leading-tight mb-1">Exercice respiratoire 5 min</Text>
            <Text className="text-xs text-outline font-manrope">Cohérence cardiaque guidée</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/(patient)/mental-health/meditation/session', params: { technique: 'coherence', duration: '300', title: 'Cohérence cardiaque' } })}
            className="bg-primary py-2 rounded-lg items-center"
          >
            <Text className="text-white text-xs font-semibold font-manrope uppercase tracking-wider">Commencer</Text>
          </TouchableOpacity>
        </View>
        <View className="bg-white/60 rounded-xl p-5 w-64 border border-white/50 gap-4"
          style={{ shadowColor: '#006685', shadowOpacity: 0.05, shadowRadius: 16, elevation: 2 }}>
          <View className="w-10 h-10 rounded-full bg-surface-variant items-center justify-center">
            <Text className="text-xl">👨‍⚕️</Text>
          </View>
          <View>
            <Text className="text-base font-semibold text-on-surface font-manrope leading-tight mb-1">Parler à un spécialiste</Text>
            <Text className="text-xs text-outline font-manrope">+200 praticiens disponibles</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(patient)/find-practitioners')}
            className="border border-primary py-2 rounded-lg items-center"
          >
            <Text className="text-primary text-xs font-semibold font-manrope uppercase tracking-wider">Réserver</Text>
          </TouchableOpacity>
        </View>
        {showCrisis && (
          <View className="bg-error-container/10 rounded-xl p-5 w-64 border border-error-container gap-4">
            <View className="w-10 h-10 rounded-full bg-error-container items-center justify-center">
              <Text className="text-xl">🆘</Text>
            </View>
            <View>
              <Text className="text-base font-semibold text-on-surface font-manrope leading-tight mb-1">Ligne de crise 24h/24</Text>
              <Text className="text-xs text-outline font-manrope">SOS Amitié Sénégal</Text>
            </View>
            <TouchableOpacity className="bg-error py-2 rounded-lg items-center">
              <Text className="text-white text-xs font-semibold font-manrope uppercase tracking-wider">+221 33 823 8020</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  )
}
```

**Step 3: Commit**

```bash
git add apps/mobile/features/mental-health/ai-companion/components/
git commit -m "feat(mental-health): add ChatBubble, ActionCards, CrisisCard components"
```

---

## Task 17: useAmiFriend hook

**Files:**
- Create: `apps/mobile/features/mental-health/ai-companion/hooks/useAmiFriend.ts`

**Step 1: Write hook**

```typescript
// apps/mobile/features/mental-health/ai-companion/hooks/useAmiFriend.ts
import { useState, useCallback } from 'react'
import { supabase } from '@/services/supabase'
import type { AmiMessage } from '@/types/mentalHealth'
import { CRISIS_KEYWORDS_REGEX } from '../constants/systemPrompt'

export function useAmiFriend() {
  const [messages, setMessages] = useState<AmiMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showCrisis, setShowCrisis] = useState(false)

  const sendMessage = useCallback(async (text: string) => {
    const userMsg: AmiMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }

    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)

    if (CRISIS_KEYWORDS_REGEX.test(text)) {
      setShowCrisis(true)
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const history = [...messages, userMsg].map(m => ({
        role: m.role,
        content: m.content,
      }))

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ami-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ messages: history }),
        }
      )

      if (!res.ok) throw new Error('Chat request failed')
      const { text: replyText, isCrisis } = await res.json()

      if (isCrisis) setShowCrisis(true)

      const amiMsg: AmiMessage = {
        id: `a_${Date.now()}`,
        role: 'assistant',
        content: replyText,
        timestamp: Date.now(),
        showCrisis: isCrisis,
      }
      setMessages(prev => [...prev, amiMsg])
    } catch {
      const errMsg: AmiMessage = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: 'Je suis temporairement indisponible. Réessayez dans quelques instants. 💙',
        timestamp: Date.now(),
      }
      setMessages(prev => [...prev, errMsg])
    } finally {
      setIsLoading(false)
    }
  }, [messages])

  return { messages, isLoading, showCrisis, sendMessage, reset: () => { setMessages([]); setShowCrisis(false) } }
}
```

**Step 2: Commit**

```bash
git add apps/mobile/features/mental-health/ai-companion/hooks/useAmiFriend.ts
git commit -m "feat(mental-health): add useAmiFriend hook with crisis detection"
```

---

## Task 18: Ami screen

**Files:**
- Create: `apps/mobile/app/(patient)/mental-health/ami/index.tsx`

**Step 1: Write screen**

```typescript
// apps/mobile/app/(patient)/mental-health/ami/index.tsx
import { useState, useRef } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ChatBubble } from '@/features/mental-health/ai-companion/components/ChatBubble'
import { ActionCards } from '@/features/mental-health/ai-companion/components/ActionCards'
import { useAmiFriend } from '@/features/mental-health/ai-companion/hooks/useAmiFriend'

export default function AmiChat() {
  const [input, setInput] = useState('')
  const { messages, isLoading, showCrisis, sendMessage } = useAmiFriend()
  const listRef = useRef<FlatList>(null)

  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    const text = input.trim()
    setInput('')
    await sendMessage(text)
    listRef.current?.scrollToEnd({ animated: true })
  }

  const showWelcome = messages.length === 0

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View style={{ position: 'absolute', top: -80, left: -80, width: 300, height: 300, borderRadius: 150, backgroundColor: '#dce9ff', opacity: 0.6 }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <View className="px-6 pt-6 pb-3 flex-row items-center justify-between">
          <View>
            <Text className="text-xs text-primary font-manrope uppercase tracking-wider">M-Santé</Text>
            <Text className="text-xl font-bold text-on-surface font-manrope">Ami 💙</Text>
          </View>
        </View>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 16, gap: 4 }}
          ListHeaderComponent={
            showWelcome ? (
              <View className="items-center py-8 gap-6">
                <View className="w-32 h-32 rounded-full items-center justify-center"
                  style={{ backgroundColor: '#006685', shadowColor: '#82d8ff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 40, elevation: 10 }}>
                  <Text className="text-5xl">🌊</Text>
                </View>
                <View className="items-center gap-2">
                  <Text className="text-2xl font-semibold text-on-surface font-manrope text-center">Comment vous sentez-vous ?</Text>
                  <Text className="text-base text-outline font-manrope">Je vous écoute...</Text>
                </View>
                <ActionCards showCrisis={false} />
              </View>
            ) : null
          }
          ListFooterComponent={
            <>
              {showCrisis && <ActionCards showCrisis={true} />}
              {isLoading && (
                <View className="self-start bg-surface-container/60 rounded-2xl rounded-tl-none px-5 py-3 mt-4 border-l-4 border-l-primary-container">
                  <Text className="text-sm text-outline font-manrope">Ami écrit...</Text>
                </View>
              )}
            </>
          }
          renderItem={({ item }) => <ChatBubble message={item} />}
          onContentSizeChange={() => messages.length > 0 && listRef.current?.scrollToEnd()}
        />
        <View className="px-6 pb-4">
          <Text className="text-xs text-outline font-manrope text-center mb-3">
            Cet espace ne remplace pas un professionnel de santé
          </Text>
          <View className="flex-row items-center gap-3 bg-surface-container-high/90 rounded-full px-5 py-3 border border-white/40">
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Partagez ce que vous ressentez..."
              placeholderTextColor="#6f787e"
              className="flex-1 text-sm text-on-surface font-manrope"
              style={{ fontFamily: 'Manrope' }}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={!input.trim() || isLoading}
              className="w-10 h-10 rounded-full bg-primary items-center justify-center"
              style={{ opacity: !input.trim() || isLoading ? 0.4 : 1 }}
            >
              <Text className="text-white font-bold">→</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
```

**Step 2: Commit**

```bash
git add "apps/mobile/app/(patient)/mental-health/ami/"
git commit -m "feat(mental-health): add Ami chat screen with orb, bubbles and action cards"
```

---

## Task 19: Wellness Hub screen

**Files:**
- Create: `apps/mobile/app/(patient)/mental-health/index.tsx`

**Step 1: Write hub screen (bento grid)**

```typescript
// apps/mobile/app/(patient)/mental-health/index.tsx
import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { BreathingRing } from '@/features/mental-health/meditation/components/BreathingRing'
import { useMoodStore } from '@/features/mental-health/store/moodStore'
import { useMoodEntries } from '@/features/mental-health/mood/hooks/useMoodEntries'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useEffect, useState } from 'react'

const DAYS_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

export default function WellnessHub() {
  const router = useRouter()
  const { profile } = useAuth()
  const { todayScore, loadLocal } = useMoodStore()
  const { data: entries = [] } = useMoodEntries(profile?.id ?? '')
  const [quickNote, setQuickNote] = useState('')

  useEffect(() => { loadLocal() }, [])

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i))
    const dateStr = d.toISOString().split('T')[0]
    const entry = entries.find(e => e.entryDate === dateStr)
    return { label: DAYS_SHORT[d.getDay() === 0 ? 6 : d.getDay() - 1], score: entry?.score ?? null, isToday: i === 6 }
  })

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View style={{ position: 'absolute', top: -80, left: -80, width: 300, height: 300, borderRadius: 150, backgroundColor: '#bee9ff', opacity: 0.4 }} pointerEvents="none" />
      <View style={{ position: 'absolute', bottom: -60, right: -60, width: 250, height: 250, borderRadius: 125, backgroundColor: '#d3e4fe', opacity: 0.6 }} pointerEvents="none" />
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
        <View className="px-6 pt-8 pb-4">
          <Text className="text-xs text-primary font-manrope uppercase tracking-wider">Mindfulness Sanctuary</Text>
          <Text className="text-2xl font-bold text-on-surface font-manrope">Bonjour, {profile?.full_name?.split(' ')[0] ?? 'vous'}</Text>
          <Text className="text-sm text-tertiary font-manrope mt-1">Votre espace bien-être du jour</Text>
        </View>
        <View className="px-6 gap-4">
          {/* Breathing Module */}
          <TouchableOpacity
            onPress={() => router.push('/(patient)/mental-health/meditation')}
            className="bg-white/60 rounded-[32px] p-6 items-center border border-white/50 overflow-hidden"
            style={{ shadowColor: '#006685', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.05, shadowRadius: 30, elevation: 3 }}>
            <View className="absolute inset-0 opacity-30" style={{ backgroundColor: '#e5eeff' }} />
            <Text className="text-base font-semibold text-on-surface font-manrope mb-6">Respiration guidée</Text>
            <BreathingRing isActive={false} size={56} />
            <View className="flex-row gap-3 mt-6">
              <View className="bg-primary px-8 py-3 rounded-full">
                <Text className="text-white font-semibold font-manrope">Commencer</Text>
              </View>
              <View className="bg-white/60 border border-outline-variant px-8 py-3 rounded-full">
                <Text className="text-on-surface font-manrope text-sm">4-7-8</Text>
              </View>
            </View>
          </TouchableOpacity>
          {/* Mood Tracker 7j */}
          <TouchableOpacity
            onPress={() => router.push('/(patient)/mental-health/mood-history')}
            className="bg-white/60 rounded-[32px] p-5 border border-white/50"
            style={{ shadowColor: '#006685', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.05, shadowRadius: 30, elevation: 3 }}>
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-base font-semibold text-on-surface font-manrope">Humeur 7 jours</Text>
              <Text className="text-primary text-xl">📊</Text>
            </View>
            <View className="flex-row items-end justify-between gap-1" style={{ height: 80 }}>
              {last7.map((d, i) => {
                const h = d.score ? (d.score / 10) * 72 : 6
                return (
                  <View key={i} className="flex-1 items-center gap-1">
                    <View className={`w-full rounded-t-lg ${d.isToday ? 'bg-primary' : 'bg-primary-container/40'}`} style={{ height: h }} />
                    <Text className={`text-[9px] font-manrope ${d.isToday ? 'text-primary font-bold' : 'text-outline'}`}>{d.label}</Text>
                  </View>
                )
              })}
            </View>
            {todayScore ? (
              <View className="bg-surface-container-low rounded-2xl p-3 flex-row items-center gap-3 mt-3">
                <Text className="text-lg">💡</Text>
                <Text className="text-xs text-on-surface font-manrope flex-1">Humeur du jour : {todayScore}/10</Text>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => router.push('/(patient)/mental-health/mood-checkin')}
                className="bg-primary/10 rounded-2xl p-3 mt-3 items-center"
              >
                <Text className="text-sm text-primary font-semibold font-manrope">Renseigner mon humeur →</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
          {/* Quick Journal */}
          <View className="bg-white/60 rounded-[32px] p-5 border border-white/50"
            style={{ shadowColor: '#006685', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.05, shadowRadius: 30, elevation: 3 }}>
            <View className="flex-row items-center gap-3 mb-3">
              <Text className="text-xl">📓</Text>
              <Text className="text-base font-bold text-on-surface font-manrope">Journaling rapide</Text>
            </View>
            <Text className="text-sm text-tertiary font-manrope mb-3">Pour quoi êtes-vous reconnaissant aujourd'hui ?</Text>
            <TextInput
              value={quickNote}
              onChangeText={setQuickNote}
              placeholder="Tapez pour commencer..."
              placeholderTextColor="#6f787e66"
              multiline
              className="border border-outline-variant/30 rounded-2xl bg-white/20 p-3 text-sm text-on-surface font-manrope min-h-20"
              style={{ fontFamily: 'Manrope', textAlignVertical: 'top' }}
            />
            <TouchableOpacity
              onPress={() => router.push('/(patient)/mental-health/journal/new')}
              className="mt-3 items-center py-2 rounded-xl bg-on-surface-variant/5"
            >
              <Text className="text-xs font-semibold text-on-surface-variant font-manrope uppercase tracking-wider">Ouvrir le journal complet</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
```

**Step 2: Commit**

```bash
git add "apps/mobile/app/(patient)/mental-health/index.tsx"
git commit -m "feat(mental-health): add Wellness Hub (bento grid: breathing + mood + journal)"
```

---

## Task 20: Bottom nav — 5 onglets patient

**Files:**
- Modify: `apps/mobile/app/(patient)/_layout.tsx`

**Step 1: Read current layout**

Read `apps/mobile/app/(patient)/_layout.tsx` (uses Stack).

**Step 2: Replace with Tabs layout**

```typescript
// apps/mobile/app/(patient)/_layout.tsx
import { Redirect, Tabs } from 'expo-router'
import { View, Text, TouchableOpacity } from 'react-native'
import { useAuth } from '@/features/auth/hooks/useAuth'

function TabBar({ state, descriptors, navigation }: any) {
  const TABS = [
    { name: 'home', label: 'Home', icon: '🏠' },
    { name: 'mental-health/ami/index', label: 'Assistant', icon: '💙' },
    { name: 'mental-health/index', label: 'Activities', icon: '🌿' },
    { name: 'find-practitioners', label: 'Providers', icon: '👨‍⚕️' },
    { name: 'support', label: 'Support', icon: '🆘' },
  ]

  return (
    <View
      className="flex-row justify-around items-center px-4 pt-3 pb-6 bg-white/60 border-t border-white/30"
      style={{ backdropFilter: 'blur(24px)', borderTopLeftRadius: 24, borderTopRightRadius: 24, shadowColor: '#82d8ff', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.1, shadowRadius: 40, elevation: 10 }}
    >
      {state.routes.map((route: any, i: number) => {
        const tab = TABS.find(t => route.name.includes(t.name.split('/')[0]))
        if (!tab) return null
        const focused = state.index === i
        return (
          <TouchableOpacity
            key={route.key}
            onPress={() => navigation.navigate(route.name)}
            className={`flex-col items-center justify-center px-3 py-1 rounded-2xl ${focused ? 'bg-sky-50/50' : ''}`}
          >
            <Text style={{ fontSize: 20 }}>{tab.icon}</Text>
            <Text className={`text-[10px] font-manrope font-semibold uppercase tracking-wider mt-1 ${focused ? 'text-sky-500' : 'text-slate-400'}`}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

export default function PatientLayout() {
  const { isAuthenticated, profile } = useAuth()
  if (!isAuthenticated || profile?.role !== 'patient') {
    return <Redirect href="/(auth)/welcome" />
  }
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <TabBar {...props} />}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="mental-health/ami/index" />
      <Tabs.Screen name="mental-health/index" />
      <Tabs.Screen name="find-practitioners" />
      <Tabs.Screen name="support" options={{ href: null }} />
    </Tabs>
  )
}
```

**Step 3: Create placeholder support screen**

```typescript
// apps/mobile/app/(patient)/support.tsx
import { View, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function Support() {
  return (
    <SafeAreaView className="flex-1 bg-background items-center justify-center">
      <Text className="text-xl font-bold text-on-surface font-manrope">Support 🆘</Text>
      <Text className="text-sm text-outline font-manrope mt-2">SOS Amitié Sénégal : +221 33 823 8020</Text>
    </SafeAreaView>
  )
}
```

**Step 4: Commit**

```bash
git add "apps/mobile/app/(patient)/_layout.tsx" "apps/mobile/app/(patient)/support.tsx"
git commit -m "feat(nav): add 5-tab bottom nav (Home/Assistant/Activities/Providers/Support)"
```

---

## Task 21: Install missing dependencies + typecheck

**Step 1: Add AsyncStorage and NetInfo**

```bash
cd "c:/Users/Khodiaou/Desktop/m-santé app"
pnpm --filter mobile add @react-native-async-storage/async-storage @react-native-community/netinfo
```

**Step 2: Run typecheck**

```bash
pnpm --filter mobile typecheck
```

Fix any TypeScript errors found.

**Step 3: Commit dependency updates**

```bash
git add apps/mobile/package.json pnpm-lock.yaml
git commit -m "chore(deps): add AsyncStorage and NetInfo dependencies for offline support"
```

---

## Task 22: Run all tests + push

**Step 1: Run full test suite**

```bash
cd "c:/Users/Khodiaou/Desktop/m-santé app"
pnpm --filter mobile test -- --no-coverage
```

Expected: all tests pass (moodStore + journalStore + existing auth/booking tests)

**Step 2: Push to GitHub**

```bash
git push
```

**Step 3: Confirm**

Report: "P2 complete. X tests passing. All pushed to GitHub."
