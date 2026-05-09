import { View, Text, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff', alignItems: 'center' }}>
      <View style={{ width: '100%', paddingHorizontal: 24, paddingTop: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <TouchableOpacity onPress={() => { reset(); router.back() }}>
          <MaterialIcons name="arrow-back" size={24} color="#006685" />
        </TouchableOpacity>
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#0b1c30', fontFamily: 'Manrope' }}>{title}</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 32 }}>
        <BreathingRing isActive={isActive} size={80} />
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#0b1c30', fontFamily: 'Manrope' }}>{currentLabel}</Text>
          <Text style={{ fontSize: 36, fontWeight: 'bold', color: '#006685', fontFamily: 'Manrope' }}>{mins}:{secs}</Text>
        </View>
        {isComplete ? (
          <View style={{ alignItems: 'center', gap: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MaterialIcons name="celebration" size={22} color="#0b1c30" />
              <Text style={{ fontSize: 18, fontWeight: '600', color: '#0b1c30', fontFamily: 'Manrope' }}>Session terminée</Text>
            </View>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ backgroundColor: '#006685', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 9999 }}
            >
              <Text style={{ color: '#ffffff', fontWeight: '600', fontFamily: 'Manrope' }}>Retour</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            onPress={isActive ? stop : start}
            style={{
              paddingHorizontal: 40,
              paddingVertical: 16,
              borderRadius: 9999,
              backgroundColor: isActive ? 'rgba(111,120,126,0.2)' : '#006685',
              borderWidth: isActive ? 1 : 0,
              borderColor: isActive ? '#6f787e' : 'transparent',
              shadowColor: '#006685',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: isActive ? 0 : 0.3,
              shadowRadius: 20,
              elevation: isActive ? 0 : 5,
            }}
          >
            <Text style={{
              fontWeight: '600',
              fontFamily: 'Manrope',
              fontSize: 14,
              textTransform: 'uppercase',
              letterSpacing: 1.2,
              color: isActive ? '#0b1c30' : '#ffffff',
            }}>
              {isActive ? 'Pause' : 'Commencer'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  )
}
