import { View, Text, FlatList, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'

const SESSIONS = [
  { id: 'coherence', title: 'Cohérence cardiaque', duration: 300, technique: 'coherence', desc: 'Inspirez 5s / Expirez 5s' },
  { id: 'box', title: 'Box Breathing', duration: 480, technique: 'box', desc: '4-4-4-4 · Clarté mentale' },
  { id: '478', title: 'Relaxation profonde', duration: 1200, technique: '478', desc: '4-7-8 · Réduction stress' },
]

export default function MeditationCatalogue() {
  const router = useRouter()

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      <View style={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 24 }}>
        <Text style={{ fontSize: 12, color: '#006685', fontFamily: 'Manrope', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4 }}>Wellness Space</Text>
        <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#0b1c30', fontFamily: 'Manrope' }}>Méditation guidée</Text>
        <Text style={{ fontSize: 14, color: '#5c5f61', fontFamily: 'Manrope', marginTop: 4 }}>Inspirez confiance, expirez la tension</Text>
      </View>
      <FlatList
        data={SESSIONS}
        keyExtractor={s => s.id}
        contentContainerStyle={{ paddingHorizontal: 24, gap: 16, paddingBottom: 100 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: '/(patient)/mental-health/meditation/session',
                params: { technique: item.technique, duration: String(item.duration), title: item.title },
              })
            }
            style={{
              backgroundColor: 'rgba(255,255,255,0.6)',
              borderRadius: 24,
              padding: 24,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.5)',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 16,
              shadowColor: '#006685',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.05,
              shadowRadius: 24,
              elevation: 3,
            }}
          >
            <View style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              backgroundColor: 'rgba(130,216,255,0.3)',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <MaterialIcons name="self-improvement" size={28} color="#006685" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#0b1c30', fontFamily: 'Manrope' }}>{item.title}</Text>
              <Text style={{ fontSize: 14, color: '#6f787e', fontFamily: 'Manrope' }}>{item.desc}</Text>
              <Text style={{ fontSize: 12, color: '#006685', fontFamily: 'Manrope', marginTop: 4 }}>{Math.round(item.duration / 60)} min</Text>
            </View>
            <MaterialIcons name="arrow-forward" size={20} color="#006685" />
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  )
}
