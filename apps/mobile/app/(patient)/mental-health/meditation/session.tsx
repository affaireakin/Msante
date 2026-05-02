import { View, Text, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { BreathingRing } from '@/features/mental-health/meditation/components/BreathingRing'
import { useMeditationTimer } from '@/features/mental-health/meditation/hooks/useMeditationTimer'

export default function MeditationSession() {
  const router = useRouter()
  const {
    technique = 'coherence',
    duration = '300',
    title = 'Méditation',
  } = useLocalSearchParams<{ technique: string; duration: string; title: string }>()

  const totalSec = Number(duration)
  const { isActive, progress, currentLabel, isComplete, start, stop, reset } =
    useMeditationTimer(technique, totalSec)

  const remaining = Math.max(0, totalSec - Math.round(progress * totalSec))
  const mins = Math.floor(remaining / 60).toString().padStart(2, '0')
  const secs = (remaining % 60).toString().padStart(2, '0')

  return (
    <SafeAreaView className="flex-1 bg-background items-center">
      <View className="w-full px-6 pt-6 flex-row items-center justify-between">
        <TouchableOpacity onPress={() => { reset(); router.back() }}>
          <Text className="text-primary text-2xl">←</Text>
        </TouchableOpacity>
        <Text className="text-base font-semibold text-on-surface font-manrope">{title}</Text>
        <View style={{ width: 32 }} />
      </View>

      <View className="flex-1 items-center justify-center gap-8">
        <BreathingRing isActive={isActive} size={80} />
        <View className="items-center gap-2">
          <Text className="text-2xl font-bold text-on-surface font-manrope">{currentLabel}</Text>
          <Text className="text-4xl font-bold text-primary font-manrope">{mins}:{secs}</Text>
        </View>
        {isComplete ? (
          <View className="items-center gap-4">
            <Text className="text-lg font-semibold text-on-surface font-manrope">Session terminée 🎉</Text>
            <TouchableOpacity
              onPress={() => router.back()}
              className="bg-primary px-8 py-3 rounded-full"
            >
              <Text className="text-white font-semibold font-manrope">Retour</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            onPress={isActive ? stop : start}
            className={`px-10 py-4 rounded-full ${isActive ? 'bg-outline/20 border border-outline' : 'bg-primary'}`}
            style={{ shadowColor: '#006685', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 5 }}
          >
            <Text className={`font-semibold font-manrope text-sm uppercase tracking-wider ${isActive ? 'text-on-surface' : 'text-white'}`}>
              {isActive ? 'Pause' : 'Commencer'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  )
}
