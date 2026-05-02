import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useMoodEntries } from '@/features/mental-health/mood/hooks/useMoodEntries'
import { useAuth } from '@/features/auth/hooks/useAuth'

const DAYS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

export default function MoodHistory() {
  const router = useRouter()
  const { profile } = useAuth()
  const { data: entries = [] } = useMoodEntries(profile?.id ?? '')

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const dateStr = d.toISOString().split('T')[0]
    const entry = entries.find(e => e.entryDate === dateStr)
    return { label: DAYS[d.getDay()], score: entry?.score ?? null, isToday: i === 6 }
  })

  const maxH = 180

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="pt-8 pb-6 flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()}>
            <Text className="text-primary text-2xl">←</Text>
          </TouchableOpacity>
          <Text className="text-xl font-bold text-on-surface font-manrope">Historique humeur</Text>
        </View>
        <View
          className="bg-white/60 rounded-3xl p-6 border border-white/50"
          style={{ shadowColor: '#006685', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.05, shadowRadius: 30, elevation: 3 }}
        >
          <View className="flex-row items-end justify-between gap-2" style={{ height: maxH + 40 }}>
            {last7.map((day, i) => {
              const barH = day.score ? (day.score / 10) * maxH : 6
              return (
                <View key={i} className="flex-1 items-center gap-2">
                  <View
                    className={`w-full rounded-t-xl ${day.isToday ? 'bg-primary' : 'bg-primary-container/40'}`}
                    style={{ height: barH }}
                  />
                  <Text className={`text-xs font-manrope ${day.isToday ? 'text-primary font-bold' : 'text-outline'}`}>
                    {day.label}
                  </Text>
                </View>
              )
            })}
          </View>
          {entries.length > 0 && (
            <View className="mt-4 bg-surface-container-low rounded-2xl p-4 flex-row items-center gap-3">
              <Text className="text-xl">💡</Text>
              <Text className="flex-1 text-sm text-on-surface font-manrope">
                Score moyen 7j :{' '}
                {(entries.slice(0, 7).reduce((a, e) => a + e.score, 0) / Math.min(entries.length, 7)).toFixed(1)}/10
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
