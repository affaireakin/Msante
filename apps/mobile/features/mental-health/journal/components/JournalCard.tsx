import { View, Text, TouchableOpacity } from 'react-native'
import type { JournalEntry } from '@/types/mentalHealth'

const SCORE_DOT_COLOR: Record<number, string> = {
  1: '#ba1a1a', 2: '#ba1a1a', 3: '#e4c546',
  4: '#e4c546', 5: '#e4c546', 6: '#1d7a3a',
  7: '#1d7a3a', 8: '#1d7a3a', 9: '#82d8ff', 10: '#82d8ff',
}

interface Props {
  entry: JournalEntry
  onPress: () => void
}

export function JournalCard({ entry, onPress }: Props) {
  const date = new Date(entry.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  const dotColor = entry.moodScore ? (SCORE_DOT_COLOR[entry.moodScore] ?? '#6f787e') : '#6f787e'

  return (
    <TouchableOpacity
      onPress={onPress}
      className="p-3 rounded-xl bg-white/40 border border-transparent"
      style={{ shadowColor: '#82d8ff', shadowOpacity: 0.03, shadowRadius: 8, elevation: 1 }}
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
