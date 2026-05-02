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
