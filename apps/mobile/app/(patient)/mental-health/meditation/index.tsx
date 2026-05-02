import { View, Text, FlatList, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'

const SESSIONS = [
  { id: 'coherence', title: 'Cohérence cardiaque', duration: 300, technique: 'coherence', desc: 'Inspirez 5s / Expirez 5s' },
  { id: 'box', title: 'Box Breathing', duration: 480, technique: 'box', desc: '4-4-4-4 · Clarté mentale' },
  { id: '478', title: 'Relaxation profonde', duration: 1200, technique: '478', desc: '4-7-8 · Réduction stress' },
]

export default function MeditationCatalogue() {
  const router = useRouter()

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-6 pt-8 pb-6">
        <Text className="text-xs text-primary font-manrope uppercase tracking-wider mb-1">Wellness Space</Text>
        <Text className="text-2xl font-bold text-on-surface font-manrope">Méditation guidée</Text>
        <Text className="text-sm text-tertiary font-manrope mt-1">Inspirez confiance, expirez la tension</Text>
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
            className="bg-white/60 rounded-3xl p-6 border border-white/50 flex-row items-center gap-4"
            style={{ shadowColor: '#006685', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.05, shadowRadius: 24, elevation: 3 }}
          >
            <View className="w-14 h-14 rounded-2xl bg-primary-container/30 items-center justify-center">
              <Text className="text-2xl">🌬️</Text>
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-on-surface font-manrope">{item.title}</Text>
              <Text className="text-sm text-outline font-manrope">{item.desc}</Text>
              <Text className="text-xs text-primary font-manrope mt-1">{Math.round(item.duration / 60)} min</Text>
            </View>
            <Text className="text-primary text-xl">→</Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  )
}
