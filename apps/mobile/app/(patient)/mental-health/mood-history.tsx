import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useMoodEntries } from '@/features/mental-health/mood/hooks/useMoodEntries'
import { useAuth } from '@/features/auth/hooks/useAuth'

const DAYS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

export default function MoodHistory() {
  const router = useRouter()
  const { profile } = useAuth()
  const { data: entries = [], isError, refetch, isRefetching } = useMoodEntries(profile?.id ?? '')

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const dateStr = d.toISOString().split('T')[0]
    const entry = entries.find(e => e.entryDate === dateStr)
    return { label: DAYS[d.getDay()], score: entry?.score ?? null, isToday: i === 6 }
  })

  const maxH = 180

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      <ScrollView
        style={{ flex: 1, paddingHorizontal: 24 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        <View style={{ paddingTop: 32, paddingBottom: 24, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color="#82d8ff" />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#0b1c30', fontFamily: 'Manrope' }}>Historique humeur</Text>
        </View>
        {isError && (
          <View style={{ alignItems: 'center', gap: 8, paddingVertical: 24 }}>
            <Text style={{ fontSize: 14, color: '#6f787e', fontFamily: 'Manrope' }}>Une erreur est survenue</Text>
            <TouchableOpacity onPress={() => refetch()} style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999, backgroundColor: '#82d8ff' }}>
              <Text style={{ fontFamily: 'Manrope', fontSize: 14, fontWeight: '700', color: '#0b1c30' }}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={{
          backgroundColor: 'rgba(255,255,255,0.6)',
          borderRadius: 24,
          padding: 24,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.5)',
          shadowColor: '#82d8ff',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.05,
          shadowRadius: 30,
          elevation: 3,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, height: maxH + 40 }}>
            {last7.map((day, i) => {
              const barH = day.score ? (day.score / 10) * maxH : 6
              return (
                <View key={i} style={{ flex: 1, alignItems: 'center', gap: 8 }}>
                  <View
                    style={{
                      width: '100%',
                      borderTopLeftRadius: 8,
                      borderTopRightRadius: 8,
                      height: barH,
                      backgroundColor: day.isToday ? '#82d8ff' : 'rgba(130,216,255,0.4)',
                    }}
                  />
                  <Text style={{
                    fontSize: 12,
                    fontFamily: 'Manrope',
                    color: day.isToday ? '#82d8ff' : '#6f787e',
                    fontWeight: day.isToday ? '700' : '400',
                  }}>
                    {day.label}
                  </Text>
                </View>
              )
            })}
          </View>
          {entries.length > 0 && (
            <View style={{
              marginTop: 16,
              backgroundColor: '#eff4ff',
              borderRadius: 16,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}>
              <MaterialIcons name="lightbulb" size={22} color="#82d8ff" />
              <Text style={{ flex: 1, fontSize: 14, color: '#0b1c30', fontFamily: 'Manrope' }}>
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
