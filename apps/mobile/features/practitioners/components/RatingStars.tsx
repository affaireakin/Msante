import { View, Text } from 'react-native'

interface RatingStarsProps {
  rating: number
  total?: number
  size?: 'sm' | 'md'
}

export function RatingStars({ rating, total, size = 'md' }: RatingStarsProps) {
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm'
  return (
    <View className="flex-row items-center gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <Text key={i} className={`${textSize} ${i <= Math.round(rating) ? 'text-amber-400' : 'text-outline-variant'}`}>
          ★
        </Text>
      ))}
      <Text className={`${textSize} text-on-surface-variant font-manrope`}>
        {rating.toFixed(1)}{total ? ` (${total})` : ''}
      </Text>
    </View>
  )
}
