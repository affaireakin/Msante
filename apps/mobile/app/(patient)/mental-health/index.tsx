import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useMoodEntries } from '@/features/mental-health/mood/hooks/useMoodEntries'
import { useMoodStore } from '@/features/mental-health/store/moodStore'
import { BreathingRing } from '@/features/mental-health/meditation/components/BreathingRing'
import type { MoodEntry } from '@/types/mentalHealth'

const BAR_HEIGHT = 110
const DAYS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

function MoodChart({ entries }: { entries: MoodEntry[] }) {
  const today = new Date()
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - 6 + i)
    const dateStr = d.toISOString().split('T')[0]
    const entry = entries.find(e => e.entryDate === dateStr)
    return { day: DAYS[d.getDay()], score: entry?.score ?? 0, isToday: i === 6 }
  })

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: BAR_HEIGHT, paddingHorizontal: 4 }}>
      {last7.map((item, idx) => {
        const barH = item.score > 0 ? Math.max((item.score / 10) * BAR_HEIGHT * 0.88, 6) : 4
        return (
          <View key={idx} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <View
              style={{
                height: barH,
                borderRadius: 6,
                backgroundColor: item.isToday ? '#006685' : 'rgba(130,216,255,0.4)',
                width: '68%',
              }}
            />
            <Text
              style={{
                fontSize: 10,
                fontFamily: 'Manrope',
                color: item.isToday ? '#006685' : '#6f787e',
                fontWeight: item.isToday ? '700' : '400',
              }}
            >
              {item.day}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

export default function WellnessHub() {
  const router = useRouter()
  const { user } = useAuth()
  const patientId = user?.id ?? ''
  const { data: moodEntries = [] } = useMoodEntries(patientId)
  const todayScore = useMoodStore(s => s.todayScore)

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Header */}
        <View className="px-6 pt-6 pb-4">
          <Text className="text-xs text-primary font-manrope uppercase tracking-wider">Mindfulness Sanctuary</Text>
          <Text className="text-2xl font-bold text-on-surface font-manrope mt-1">Espace bien-être</Text>
          <Text className="text-sm text-outline font-manrope mt-1">
            Respirez. Écoutez-vous. Avancez doucement.
          </Text>
        </View>

        <View className="px-6 gap-4">
          {/* ─── Breathing Module ─── */}
          <View
            className="rounded-3xl p-6 items-center border border-white/50"
            style={{ backgroundColor: 'rgba(255,255,255,0.60)', shadowColor: '#006685', shadowOpacity: 0.06, shadowRadius: 24, elevation: 3 }}
          >
            <View className="items-center gap-5 w-full">
              <View className="items-center gap-1">
                <Text className="text-lg font-semibold text-on-surface font-manrope">Respiration guidée</Text>
                <Text className="text-xs text-outline font-manrope">Inspirez la sérénité, expirez la tension</Text>
              </View>

              <BreathingRing isActive size={80} />

              <View className="flex-row gap-3 w-full">
                <TouchableOpacity
                  onPress={() =>
                    router.push({
                      pathname: '/(patient)/mental-health/meditation/session',
                      params: { technique: 'coherence', duration: '300', title: 'Cohérence cardiaque' },
                    })
                  }
                  className="flex-1 bg-primary rounded-full py-3 items-center"
                >
                  <Text className="text-white text-sm font-semibold font-manrope">Commencer</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() =>
                    router.push({
                      pathname: '/(patient)/mental-health/meditation/session',
                      params: { technique: '478', duration: '480', title: '4-7-8' },
                    })
                  }
                  className="flex-1 border border-outline-variant rounded-full py-3 items-center bg-white/40"
                >
                  <Text className="text-on-surface text-sm font-semibold font-manrope">4-7-8</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* ─── Mood Row (chart + today check-in) ─── */}
          <View className="flex-row gap-4">
            <View
              className="flex-1 rounded-3xl p-5 border border-white/50"
              style={{ backgroundColor: 'rgba(255,255,255,0.60)', shadowColor: '#006685', shadowOpacity: 0.05, shadowRadius: 16, elevation: 2 }}
            >
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-base font-semibold text-on-surface font-manrope">Humeur 7j</Text>
                <Text style={{ fontSize: 18 }}>📊</Text>
              </View>
              <MoodChart entries={moodEntries} />
            </View>

            <TouchableOpacity
              onPress={() => router.push('/(patient)/mental-health/mood-checkin')}
              className="rounded-3xl p-5 border border-white/50 items-center justify-center gap-2"
              style={{
                width: 110,
                backgroundColor: todayScore != null ? '#006685' : 'rgba(255,255,255,0.60)',
                shadowColor: '#006685',
                shadowOpacity: 0.08,
                shadowRadius: 16,
                elevation: 2,
              }}
            >
              {todayScore != null ? (
                <>
                  <Text style={{ fontSize: 28 }}>
                    {todayScore >= 8 ? '😊' : todayScore >= 5 ? '🙂' : todayScore >= 3 ? '😐' : '😔'}
                  </Text>
                  <Text className="text-2xl font-bold text-white font-manrope">{todayScore}</Text>
                  <Text className="text-[10px] text-white/70 font-manrope text-center">Aujourd'hui</Text>
                </>
              ) : (
                <>
                  <Text style={{ fontSize: 26 }}>🎯</Text>
                  <Text className="text-xs font-semibold text-on-surface font-manrope text-center">Check-in</Text>
                  <Text className="text-[10px] text-outline font-manrope text-center">du jour</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* ─── Quick Journal ─── */}
          <TouchableOpacity
            onPress={() => router.push('/(patient)/mental-health/journal/new')}
            className="rounded-3xl p-5 border border-white/50"
            style={{ backgroundColor: 'rgba(255,255,255,0.60)', shadowColor: '#006685', shadowOpacity: 0.05, shadowRadius: 16, elevation: 2 }}
          >
            <View className="flex-row items-center gap-3 mb-3">
              <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: '#e0f2fe' }}>
                <Text style={{ fontSize: 20 }}>📝</Text>
              </View>
              <Text className="text-base font-bold text-on-surface font-manrope">Journal rapide</Text>
            </View>
            <Text className="text-sm text-outline font-manrope mb-3">
              Pour quoi êtes-vous reconnaissant(e) aujourd'hui ?
            </Text>
            <View
              className="rounded-2xl px-4 py-3 border border-outline-variant/30"
              style={{ backgroundColor: 'rgba(255,255,255,0.20)' }}
            >
              <Text className="text-sm text-outline font-manrope italic">Appuyez pour écrire...</Text>
            </View>
          </TouchableOpacity>

          {/* ─── Quick Nav ─── */}
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => router.push('/(patient)/mental-health/meditation')}
              className="flex-1 rounded-2xl p-4 border border-white/50 items-center gap-2"
              style={{ backgroundColor: 'rgba(255,255,255,0.60)', shadowColor: '#006685', shadowOpacity: 0.05, shadowRadius: 12, elevation: 2 }}
            >
              <Text style={{ fontSize: 24 }}>🧘</Text>
              <Text className="text-xs font-semibold text-on-surface font-manrope text-center">Méditation</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/(patient)/mental-health/journal')}
              className="flex-1 rounded-2xl p-4 border border-white/50 items-center gap-2"
              style={{ backgroundColor: 'rgba(255,255,255,0.60)', shadowColor: '#006685', shadowOpacity: 0.05, shadowRadius: 12, elevation: 2 }}
            >
              <Text style={{ fontSize: 24 }}>📓</Text>
              <Text className="text-xs font-semibold text-on-surface font-manrope text-center">Journal</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/(patient)/mental-health/mood-history')}
              className="flex-1 rounded-2xl p-4 border border-white/50 items-center gap-2"
              style={{ backgroundColor: 'rgba(255,255,255,0.60)', shadowColor: '#006685', shadowOpacity: 0.05, shadowRadius: 12, elevation: 2 }}
            >
              <Text style={{ fontSize: 24 }}>📈</Text>
              <Text className="text-xs font-semibold text-on-surface font-manrope text-center">Historique</Text>
            </TouchableOpacity>
          </View>

          {/* ─── Ami CTA ─── */}
          <TouchableOpacity
            onPress={() => router.push('/(patient)/mental-health/ami')}
            className="rounded-3xl p-5 border border-primary/20 flex-row items-center gap-4"
            style={{ backgroundColor: 'rgba(0,102,133,0.07)', shadowColor: '#006685', shadowOpacity: 0.08, shadowRadius: 16, elevation: 2 }}
          >
            <View
              className="w-14 h-14 rounded-full bg-primary items-center justify-center"
              style={{ shadowColor: '#82d8ff', shadowOpacity: 1, shadowRadius: 20, elevation: 4 }}
            >
              <Text style={{ fontSize: 24 }}>🌊</Text>
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold text-on-surface font-manrope">Parler à Ami 💙</Text>
              <Text className="text-xs text-outline font-manrope mt-0.5">
                Votre espace d'écoute bienveillant
              </Text>
            </View>
            <Text className="text-primary text-xl">→</Text>
          </TouchableOpacity>

          <Text className="text-xs text-outline font-manrope text-center mt-2">
            Cet espace ne remplace pas un professionnel de santé
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
