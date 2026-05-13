import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  interpolateColor,
  useDerivedValue,
} from 'react-native-reanimated'
import type { BreathPhase } from '../hooks/useMeditationTimer'

// Phase → visual configuration
const PHASE_CONFIG = {
  inhale: { targetScale: 1.0,  glowOpacity: 0.65, colorT: 0 },
  hold:   { targetScale: 1.0,  glowOpacity: 0.5,  colorT: 0.4 },
  exhale: { targetScale: 0.62, glowOpacity: 0.2,  colorT: 1 },
  hold2:  { targetScale: 0.62, glowOpacity: 0.15, colorT: 0.8 },
} as const

// Colors: 0 = inhale (bright sky), 1 = exhale (deep ocean)
const COLOR_A = '#82d8ff'  // inhale
const COLOR_B = '#004d65'  // exhale

interface Props {
  phase: BreathPhase
  phaseDuration: number  // seconds — drives animation timing
  isActive: boolean
  size?: number          // inner circle radius (default 100)
}

export function BreathingRing({ phase, phaseDuration, isActive, size = 100 }: Props) {
  const scale        = useSharedValue(0.62)
  const glowOpacity  = useSharedValue(0.15)
  const colorT       = useSharedValue(1)   // 0 = COLOR_A, 1 = COLOR_B
  const idleScale    = useSharedValue(1)

  // Idle gentle pulse when not active
  useEffect(() => {
    if (!isActive) {
      scale.value       = withTiming(0.75, { duration: 600 })
      glowOpacity.value = withTiming(0.15, { duration: 600 })
      colorT.value      = withTiming(0.5,  { duration: 600 })
      idleScale.value   = withRepeat(
        withSequence(
          withTiming(1.04, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.96, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        ), -1, true,
      )
    } else {
      idleScale.value = withTiming(1, { duration: 300 })
    }
  }, [isActive])

  // Phase-driven animation — starts fresh on each phase transition
  useEffect(() => {
    if (!isActive) return
    const cfg = PHASE_CONFIG[phase]
    const dur = phaseDuration * 1000

    const ease = phase === 'inhale'
      ? Easing.out(Easing.cubic)
      : phase === 'exhale'
        ? Easing.in(Easing.cubic)
        : Easing.inOut(Easing.sin)

    scale.value       = withTiming(cfg.targetScale,  { duration: dur, easing: ease })
    glowOpacity.value = withTiming(cfg.glowOpacity,  { duration: dur })
    colorT.value      = withTiming(cfg.colorT,       { duration: dur })

    // Hold phases: subtle pulse on top of stable scale
    if (phase === 'hold' || phase === 'hold2') {
      const pulseAmp = phase === 'hold' ? 0.03 : 0.02
      const pulseDur = phase === 'hold' ? 900 : 700
      const target = cfg.targetScale
      scale.value = withRepeat(
        withSequence(
          withTiming(target + pulseAmp, { duration: pulseDur, easing: Easing.inOut(Easing.sin) }),
          withTiming(target - pulseAmp, { duration: pulseDur, easing: Easing.inOut(Easing.sin) }),
        ), -1, true,
      )
    }
  }, [phase, isActive, phaseDuration])

  // Derived color
  const animColor = useDerivedValue(() =>
    interpolateColor(colorT.value, [0, 1], [COLOR_A, COLOR_B]),
  )

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * idleScale.value }],
  }))

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: (scale.value * idleScale.value) * 1.35 }],
  }))

  const midGlowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value * 0.55,
    transform: [{ scale: (scale.value * idleScale.value) * 1.15 }],
  }))

  const innerStyle = useAnimatedStyle(() => ({
    backgroundColor: animColor.value,
    shadowColor:     animColor.value,
    transform: [{ scale: scale.value * idleScale.value }],
  }))

  const s = size

  return (
    <View style={{ width: s * 2.8, height: s * 2.8, alignItems: 'center', justifyContent: 'center' }}>
      {/* Outer glow */}
      <Animated.View style={[
        glowStyle,
        { position: 'absolute', width: s * 2.4, height: s * 2.4, borderRadius: s * 1.2, backgroundColor: COLOR_A, opacity: 0.1 },
      ]} />

      {/* Mid ring */}
      <Animated.View style={[
        midGlowStyle,
        { position: 'absolute', width: s * 1.9, height: s * 1.9, borderRadius: s * 0.95, backgroundColor: '#bee9ff', opacity: 0.15 },
      ]} />

      {/* Track ring */}
      <View style={{
        position: 'absolute',
        width: s * 2.2, height: s * 2.2, borderRadius: s * 1.1,
        borderWidth: 1.5,
        borderColor: 'rgba(130,216,255,0.18)',
        backgroundColor: 'transparent',
      }} />

      {/* Main animated circle */}
      <Animated.View style={[
        ringStyle,
        {
          width: s * 2, height: s * 2, borderRadius: s,
          backgroundColor: 'transparent',
          borderWidth: 2.5,
          borderColor: 'rgba(130,216,255,0.30)',
          alignItems: 'center',
          justifyContent: 'center',
        },
      ]}>
        {/* Inner filled circle */}
        <Animated.View style={[
          innerStyle,
          {
            width: s * 1.6, height: s * 1.6, borderRadius: s * 0.8,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.55,
            shadowRadius: 40,
            elevation: 12,
          },
        ]} />
      </Animated.View>
    </View>
  )
}
