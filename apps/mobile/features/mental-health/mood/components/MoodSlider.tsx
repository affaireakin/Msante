import { View, Text } from 'react-native'
import Slider from '@react-native-community/slider'

const SCORE_EMOJI = ['', '😔', '😟', '😕', '😐', '🙂', '😊', '😄', '😁', '🥰', '🤩']

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
