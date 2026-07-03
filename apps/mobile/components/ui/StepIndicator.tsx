import { View } from 'react-native'

interface StepIndicatorProps {
  total: number
  current: number
}

export function StepIndicator({ total, current }: StepIndicatorProps) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={{
            height: 8,
            borderRadius: 4,
            width: i === current ? 32 : 8,
            backgroundColor: i === current ? '#82d8ff' : '#bec8ce',
          }}
        />
      ))}
    </View>
  )
}
