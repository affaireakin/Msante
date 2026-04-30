import { View } from 'react-native'

interface StepIndicatorProps {
  total: number
  current: number
}

export function StepIndicator({ total, current }: StepIndicatorProps) {
  return (
    <View className="flex-row gap-2 justify-center">
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          className={`h-2 rounded-full transition-all ${
            i === current ? 'bg-primary w-8' : 'bg-outline-variant w-2'
          }`}
        />
      ))}
    </View>
  )
}
