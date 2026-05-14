import { useEffect, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StatusBar, Vibration,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, FadeIn, FadeOut,
} from 'react-native-reanimated'
import { BreathingRing } from '@/features/mental-health/meditation/components/BreathingRing'
import { useMeditationTimer } from '@/features/mental-health/meditation/hooks/useMeditationTimer'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/features/auth/store/authStore'

// ── Progress bar ──────────────────────────────────────────────────────────────

function SessionProgressBar({ progress, accent }: { progress: number; accent: string }) {
  return (
    <View style={{ width: '100%', height: 3, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 2 }}>
      <Animated.View style={{
        height: '100%', borderRadius: 2, backgroundColor: accent,
        width: `${Math.min(100, progress * 100)}%`,
      }} />
    </View>
  )
}

// ── Completion overlay ────────────────────────────────────────────────────────

function CompletionScreen({
  title, emoji, durationMin, accent, onBack, onRestart,
}: {
  title: string; emoji: string; durationMin: number; accent: string
  onBack: () => void; onRestart: () => void
}) {
  return (
    <Animated.View
      entering={FadeIn.duration(600)}
      style={{
        position: 'absolute', inset: 0,
        backgroundColor: '#0b1c30',
        alignItems: 'center', justifyContent: 'center',
        padding: 32, gap: 28,
      }}
    >
      {/* Big check */}
      <View style={{
        width: 100, height: 100, borderRadius: 50,
        backgroundColor: `${accent}22`,
        borderWidth: 2, borderColor: accent,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontSize: 44 }}>✓</Text>
      </View>

      <View style={{ alignItems: 'center', gap: 8 }}>
        <Text style={{ fontFamily: 'Manrope', fontSize: 26, fontWeight: '800', color: '#fff', textAlign: 'center' }}>
          Session terminée !
        </Text>
        <Text style={{ fontFamily: 'Manrope', fontSize: 16, color: 'rgba(255,255,255,0.65)', textAlign: 'center' }}>
          {emoji}  {title}
        </Text>
      </View>

      {/* Stats */}
      <View style={{
        flexDirection: 'row', gap: 20,
        backgroundColor: 'rgba(255,255,255,0.07)',
        borderRadius: 20, padding: 20, width: '100%',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
      }}>
        {[
          { label: 'Durée', value: `${durationMin} min` },
          { label: 'Cycles', value: '—' },
          { label: 'Série', value: '1 jour' },
        ].map(({ label, value }) => (
          <View key={label} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: 18, fontWeight: '800', color: accent }}>{value}</Text>
            <Text style={{ fontFamily: 'Manrope', fontSize: 11, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</Text>
          </View>
        ))}
      </View>

      <View style={{ width: '100%', gap: 12 }}>
        <TouchableOpacity
          onPress={onRestart}
          style={{ backgroundColor: accent, borderRadius: 999, paddingVertical: 16, alignItems: 'center' }}
        >
          <Text style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: '700', color: '#0b1c30' }}>
            Recommencer
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onBack}
          style={{ borderRadius: 999, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)' }}
        >
          <Text style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.70)' }}>
            Retour au catalogue
          </Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  )
}

// ── Main session screen ───────────────────────────────────────────────────────

export default function MeditationSession() {
  const router = useRouter()
  const { profile } = useAuthStore()
  const {
    technique = 'coherence',
    duration  = '300',
    title     = 'Méditation',
    accent    = '#82d8ff',
    emoji     = '💙',
  } = useLocalSearchParams<{
    technique: string; duration: string; title: string; accent: string; emoji: string
  }>()

  const totalSec  = Number(duration)
  const durationMin = Math.ceil(totalSec / 60)
  const timer     = useMeditationTimer(technique, totalSec)

  // Vibrate on phase transitions
  const prevPhase = useRef(timer.currentPhase)
  useEffect(() => {
    if (timer.isActive && timer.currentPhase !== prevPhase.current) {
      Vibration.vibrate(40)
      prevPhase.current = timer.currentPhase
    }
  }, [timer.currentPhase, timer.isActive])

  // Countdown number flash animation
  const countOpacity = useSharedValue(1)
  const prevCountdown = useRef(timer.phaseTimeLeft)
  useEffect(() => {
    if (timer.isActive && timer.phaseTimeLeft !== prevCountdown.current) {
      countOpacity.value = 0
      countOpacity.value = withTiming(1, { duration: 300 })
      prevCountdown.current = timer.phaseTimeLeft
    }
  }, [timer.phaseTimeLeft, timer.isActive])

  const countStyle = useAnimatedStyle(() => ({ opacity: countOpacity.value }))

  // Total elapsed
  const elapsedMin = Math.floor(timer.elapsed / 60).toString().padStart(2, '0')
  const elapsedSec = (timer.elapsed % 60).toString().padStart(2, '0')

  const handleBack = () => { timer.reset(); router.back() }

  // Save completed session to DB (fire-and-forget — never blocks navigation)
  const handleComplete = () => {
    if (!Number.isFinite(totalSec) || totalSec <= 0) {
      handleBack()
      return
    }
    if (profile?.id) {
      supabase.from('meditation_sessions').insert({
        patient_id:   profile.id,
        title:        title as string,
        duration_min: durationMin,
        session_date: new Date().toISOString().split('T')[0],
      }).then(() => {}, (err) => { console.warn('[meditation] session save failed', err) })
    }
    handleBack()
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0b1c30' }}>
      <StatusBar barStyle="light-content" backgroundColor="#0b1c30" />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>

        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 16 }}>
          <TouchableOpacity onPress={handleBack} style={{ padding: 4 }}>
            <Text style={{ fontSize: 22, color: 'rgba(255,255,255,0.60)' }}>←</Text>
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: '700', color: '#fff' }}>
              {emoji}  {title}
            </Text>
          </View>
          {/* Elapsed timer */}
          <View style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.60)', fontVariant: ['tabular-nums'] }}>
              {elapsedMin}:{elapsedSec}
            </Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={{ paddingHorizontal: 24 }}>
          <SessionProgressBar progress={timer.progress} accent={accent} />
        </View>

        {/* Center — breathing ring + labels */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 0 }}>

          {/* Phase label */}
          <Animated.Text
            key={timer.currentPhase}
            entering={FadeIn.duration(350)}
            exiting={FadeOut.duration(200)}
            style={{
              fontFamily: 'Manrope', fontSize: 15, fontWeight: '600',
              color: 'rgba(255,255,255,0.55)',
              textTransform: 'uppercase', letterSpacing: 2.5,
              marginBottom: 24,
            }}
          >
            {timer.isActive ? timer.currentLabel : 'Prêt ?'}
          </Animated.Text>

          {/* Breathing ring */}
          <BreathingRing
            phase={timer.currentPhase}
            phaseDuration={timer.phaseDuration}
            isActive={timer.isActive}
            size={100}
          />

          {/* Phase countdown */}
          <View style={{ height: 64, alignItems: 'center', justifyContent: 'center', marginTop: 20 }}>
            {timer.isActive && (
              <Animated.Text style={[countStyle, {
                fontFamily: 'Manrope', fontSize: 52, fontWeight: '800',
                color: accent,
                fontVariant: ['tabular-nums'],
              }]}>
                {timer.phaseTimeLeft}
              </Animated.Text>
            )}
          </View>

          {/* Technique hint */}
          {!timer.isActive && !timer.isComplete && (
            <Animated.Text
              entering={FadeIn.duration(400)}
              style={{
                fontFamily: 'Manrope', fontSize: 13, color: 'rgba(255,255,255,0.35)',
                textAlign: 'center', marginTop: 8, paddingHorizontal: 32, lineHeight: 20,
              }}
            >
              {technique === 'coherence' && 'Inspirez 5s · Expirez 5s'}
              {technique === 'box' && 'Inspirez · Retenez · Expirez · Retenez (4s chacun)'}
              {technique === '478' && 'Inspirez 4s · Retenez 7s · Expirez 8s'}
              {technique === 'triangle' && 'Inspirez · Retenez · Expirez (4s chacun)'}
            </Animated.Text>
          )}
        </View>

        {/* Bottom controls */}
        <View style={{ paddingHorizontal: 32, paddingBottom: 32, gap: 16 }}>
          {!timer.isComplete && (
            <TouchableOpacity
              onPress={timer.isActive ? timer.pause : (timer.elapsed > 0 ? timer.resume : timer.start)}
              style={{
                height: 60, borderRadius: 999,
                backgroundColor: timer.isActive ? 'rgba(255,255,255,0.10)' : accent,
                borderWidth: timer.isActive ? 1 : 0,
                borderColor: 'rgba(255,255,255,0.20)',
                alignItems: 'center', justifyContent: 'center',
                shadowColor: accent,
                shadowOpacity: timer.isActive ? 0 : 0.4,
                shadowRadius: 20,
                shadowOffset: { width: 0, height: 8 },
                elevation: timer.isActive ? 0 : 6,
              }}
            >
              <Text style={{
                fontFamily: 'Manrope', fontSize: 15, fontWeight: '700',
                textTransform: 'uppercase', letterSpacing: 1.5,
                color: timer.isActive ? 'rgba(255,255,255,0.70)' : '#0b1c30',
              }}>
                {timer.isActive ? 'Pause' : timer.elapsed > 0 ? 'Reprendre' : 'Commencer'}
              </Text>
            </TouchableOpacity>
          )}

          {timer.isActive && (
            <TouchableOpacity onPress={() => { timer.reset(); router.back() }} style={{ alignItems: 'center', paddingVertical: 8 }}>
              <Text style={{ fontFamily: 'Manrope', fontSize: 13, color: 'rgba(255,255,255,0.30)' }}>
                Abandonner la session
              </Text>
            </TouchableOpacity>
          )}
        </View>

      </SafeAreaView>

      {/* Completion overlay */}
      {timer.isComplete && (
        <CompletionScreen
          title={title}
          emoji={emoji}
          durationMin={durationMin}
          accent={accent}
          onBack={handleComplete}
          onRestart={() => timer.start()}
        />
      )}
    </View>
  )
}
