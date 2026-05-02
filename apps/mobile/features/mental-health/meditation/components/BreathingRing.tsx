import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated'

interface Props {
  isActive: boolean
  size?: number
}

export function BreathingRing({ isActive, size = 80 }: Props) {
  const scale = useSharedValue(0.85)
  const opacity = useSharedValue(0.4)

  useEffect(() => {
    if (isActive) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 4000, easing: Easing.bezier(0.4, 0, 0.2, 1) }),
          withTiming(0.85, { duration: 4000, easing: Easing.bezier(0.4, 0, 0.2, 1) })
        ),
        -1,
        false
      )
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.8, { duration: 4000 }),
          withTiming(0.4, { duration: 4000 })
        ),
        -1,
        false
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
        style={[
          outerStyle,
          {
            position: 'absolute',
            width: size * 2,
            height: size * 2,
            borderRadius: size,
            backgroundColor: '#bee9ff4d',
          },
        ]}
      />
      <View
        style={{
          position: 'absolute',
          width: size * 1.5,
          height: size * 1.5,
          borderRadius: size,
          backgroundColor: '#006685',
          opacity: 0.15,
        }}
      />
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#006685',
          shadowColor: '#006685',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.3,
          shadowRadius: 40,
          elevation: 8,
        }}
      />
    </View>
  )
}
