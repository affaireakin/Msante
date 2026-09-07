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

export interface MounimaMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  showCrisis?: boolean
}

/** @deprecated Use MounimaMessage instead */
export type AmiMessage = MounimaMessage

export const EMOTIONS = [
  { id: 'calm', label: 'Calme', icon: 'sentiment_satisfied' },
  { id: 'anxious', label: 'Anxieux', icon: 'water_drop' },
  { id: 'fatigued', label: 'Fatigué', icon: 'bedtime' },
  { id: 'hopeful', label: 'Confiant', icon: 'light_mode' },
  { id: 'sad', label: 'Triste', icon: 'sentiment_sad' },
  { id: 'angry', label: 'Irrité', icon: 'bolt' },
  { id: 'joyful', label: 'Joyeux', icon: 'celebration' },
] as const

export type EmotionId = typeof EMOTIONS[number]['id']

export const CRISIS_KEYWORDS_REGEX = /suicid|mourir|me tuer|fin de vie|plus envie de vivre|désespoir total|tout arrêter|plus la force/i
