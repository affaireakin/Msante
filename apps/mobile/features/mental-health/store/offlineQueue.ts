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
