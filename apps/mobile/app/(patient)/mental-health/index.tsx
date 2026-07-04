import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
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
                backgroundColor: item.isToday ? '#82d8ff' : 'rgba(130,216,255,0.4)',
                width: '68%',
              }}
            />
            <Text
              style={{
                fontSize: 10,
                fontFamily: 'Manrope',
                color: item.isToday ? '#82d8ff' : '#6f787e',
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Header */}
        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16 }}>
          <Text style={{ fontSize: 12, color: '#82d8ff', fontFamily: 'Manrope', textTransform: 'uppercase', letterSpacing: 1.2 }}>Mindfulness Sanctuary</Text>
          <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#0b1c30', fontFamily: 'Manrope', marginTop: 4 }}>Espace bien-être</Text>
          <Text style={{ fontSize: 14, color: '#6f787e', fontFamily: 'Manrope', marginTop: 4 }}>
            Respirez. Écoutez-vous. Avancez doucement.
          </Text>
        </View>

        <View style={{ paddingHorizontal: 24, gap: 16 }}>
          {/* ─── Breathing Module ─── */}
          <View style={{
            borderRadius: 24,
            padding: 24,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.5)',
            backgroundColor: 'rgba(255,255,255,0.60)',
            shadowColor: '#82d8ff',
            shadowOpacity: 0.06,
            shadowRadius: 24,
            elevation: 3,
          }}>
            <View style={{ alignItems: 'center', gap: 20, width: '100%' }}>
              <View style={{ alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: 18, fontWeight: '600', color: '#0b1c30', fontFamily: 'Manrope' }}>Respiration guidée</Text>
                <Text style={{ fontSize: 12, color: '#6f787e', fontFamily: 'Manrope' }}>Inspirez la sérénité, expirez la tension</Text>
              </View>

              <BreathingRing phase="inhale" phaseDuration={5} isActive={false} size={80} />

              <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
                <TouchableOpacity
                  onPress={() =>
                    router.push({
                      pathname: '/(patient)/mental-health/meditation/session',
                      params: { technique: 'coherence', duration: '300', title: 'Cohérence cardiaque' },
                    })
                  }
                  style={{ flex: 1, backgroundColor: '#82d8ff', borderRadius: 9999, paddingVertical: 12, alignItems: 'center' }}
                >
                  <Text style={{ color: '#0b1c30', fontSize: 14, fontWeight: '800', fontFamily: 'Manrope' }}>Commencer</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() =>
                    router.push({
                      pathname: '/(patient)/mental-health/meditation/session',
                      params: { technique: '478', duration: '480', title: '4-7-8' },
                    })
                  }
                  style={{ flex: 1, borderWidth: 1, borderColor: '#bec8ce', borderRadius: 9999, paddingVertical: 12, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.4)' }}
                >
                  <Text style={{ color: '#0b1c30', fontSize: 14, fontWeight: '600', fontFamily: 'Manrope' }}>4-7-8</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* ─── Mood Row (chart + today check-in) ─── */}
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <View style={{
              flex: 1,
              borderRadius: 24,
              padding: 20,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.5)',
              backgroundColor: 'rgba(255,255,255,0.60)',
              shadowColor: '#82d8ff',
              shadowOpacity: 0.05,
              shadowRadius: 16,
              elevation: 2,
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#0b1c30', fontFamily: 'Manrope' }}>Humeur 7j</Text>
                <MaterialIcons name="bar-chart" size={20} color="#82d8ff" />
              </View>
              <MoodChart entries={moodEntries} />
            </View>

            <TouchableOpacity
              onPress={() => router.push('/(patient)/mental-health/mood-checkin')}
              style={{
                width: 110,
                borderRadius: 24,
                padding: 20,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.5)',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                backgroundColor: todayScore != null ? '#82d8ff' : 'rgba(255,255,255,0.60)',
                shadowColor: '#82d8ff',
                shadowOpacity: 0.08,
                shadowRadius: 16,
                elevation: 2,
              }}
            >
              {todayScore != null ? (
                <>
                  <MaterialIcons
                    name={todayScore >= 8 ? 'sentiment-satisfied' : todayScore >= 5 ? 'sentiment-neutral' : todayScore >= 3 ? 'sentiment-dissatisfied' : 'sentiment-very-dissatisfied'}
                    size={28}
                    color="#ffffff"
                  />
                  <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#ffffff', fontFamily: 'Manrope' }}>{todayScore}</Text>
                  <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', fontFamily: 'Manrope', textAlign: 'center' }}>Aujourd'hui</Text>
                </>
              ) : (
                <>
                  <MaterialIcons name="gps-fixed" size={26} color="#0b1c30" />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#0b1c30', fontFamily: 'Manrope', textAlign: 'center' }}>Check-in</Text>
                  <Text style={{ fontSize: 10, color: '#6f787e', fontFamily: 'Manrope', textAlign: 'center' }}>du jour</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* ─── Analytics CTA ─── */}
          <TouchableOpacity
            onPress={() => router.push('/(patient)/mental-health/mood-analytics')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingVertical: 12,
              borderRadius: 999,
              backgroundColor: 'rgba(0,102,133,0.08)',
              borderWidth: 1,
              borderColor: 'rgba(0,102,133,0.20)',
            }}
          >
            <MaterialIcons name="bar-chart" size={18} color="#82d8ff" />
            <Text
              style={{
                fontFamily: 'Manrope',
                fontSize: 14,
                fontWeight: '600',
                color: '#82d8ff',
              }}
            >
              Voir mes statistiques — 30 jours
            </Text>
          </TouchableOpacity>

          {/* ─── Quick Journal ─── */}
          <TouchableOpacity
            onPress={() => router.push('/(patient)/mental-health/journal/new')}
            style={{
              borderRadius: 24,
              padding: 20,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.5)',
              backgroundColor: 'rgba(255,255,255,0.60)',
              shadowColor: '#82d8ff',
              shadowOpacity: 0.05,
              shadowRadius: 16,
              elevation: 2,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e0f2fe' }}>
                <MaterialIcons name="edit" size={20} color="#82d8ff" />
              </View>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#0b1c30', fontFamily: 'Manrope' }}>Journal rapide</Text>
            </View>
            <Text style={{ fontSize: 14, color: '#6f787e', fontFamily: 'Manrope', marginBottom: 12 }}>
              Pour quoi êtes-vous reconnaissant(e) aujourd'hui ?
            </Text>
            <View style={{
              borderRadius: 16,
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderWidth: 1,
              borderColor: 'rgba(190,200,206,0.3)',
              backgroundColor: 'rgba(255,255,255,0.20)',
            }}>
              <Text style={{ fontSize: 14, color: '#6f787e', fontFamily: 'Manrope', fontStyle: 'italic' }}>Appuyez pour écrire...</Text>
            </View>
          </TouchableOpacity>

          {/* ─── Quick Nav ─── */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              onPress={() => router.push('/(patient)/mental-health/meditation')}
              style={{
                flex: 1,
                borderRadius: 16,
                padding: 16,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.5)',
                alignItems: 'center',
                gap: 8,
                backgroundColor: 'rgba(255,255,255,0.60)',
                shadowColor: '#82d8ff',
                shadowOpacity: 0.05,
                shadowRadius: 12,
                elevation: 2,
              }}
            >
              <MaterialIcons name="self-improvement" size={24} color="#82d8ff" />
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#0b1c30', fontFamily: 'Manrope', textAlign: 'center' }}>Méditation</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/(patient)/mental-health/journal')}
              style={{
                flex: 1,
                borderRadius: 16,
                padding: 16,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.5)',
                alignItems: 'center',
                gap: 8,
                backgroundColor: 'rgba(255,255,255,0.60)',
                shadowColor: '#82d8ff',
                shadowOpacity: 0.05,
                shadowRadius: 12,
                elevation: 2,
              }}
            >
              <MaterialIcons name="book" size={24} color="#82d8ff" />
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#0b1c30', fontFamily: 'Manrope', textAlign: 'center' }}>Journal</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/(patient)/mental-health/mood-history')}
              style={{
                flex: 1,
                borderRadius: 16,
                padding: 16,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.5)',
                alignItems: 'center',
                gap: 8,
                backgroundColor: 'rgba(255,255,255,0.60)',
                shadowColor: '#82d8ff',
                shadowOpacity: 0.05,
                shadowRadius: 12,
                elevation: 2,
              }}
            >
              <MaterialIcons name="bar-chart" size={24} color="#82d8ff" />
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#0b1c30', fontFamily: 'Manrope', textAlign: 'center' }}>Historique</Text>
            </TouchableOpacity>
          </View>

          {/* ─── Mounima CTA ─── */}
          <TouchableOpacity
            onPress={() => router.push('/(patient)/mental-health/mounima')}
            style={{
              borderRadius: 24,
              padding: 20,
              borderWidth: 1,
              borderColor: 'rgba(0,102,133,0.2)',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 16,
              backgroundColor: 'rgba(0,102,133,0.07)',
              shadowColor: '#82d8ff',
              shadowOpacity: 0.08,
              shadowRadius: 16,
              elevation: 2,
            }}
          >
            <View style={{
              width: 56, height: 56, borderRadius: 28, backgroundColor: '#82d8ff',
              alignItems: 'center', justifyContent: 'center',
              shadowColor: '#82d8ff', shadowOpacity: 1, shadowRadius: 20, elevation: 4,
            }}>
              <MaterialIcons name="waves" size={28} color="#ffffff" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#0b1c30', fontFamily: 'Manrope' }}>Parler à Mounima</Text>
                <MaterialIcons name="favorite" size={14} color="#82d8ff" />
              </View>
              <Text style={{ fontSize: 12, color: '#6f787e', fontFamily: 'Manrope', marginTop: 2 }}>
                Votre espace d'écoute bienveillant
              </Text>
            </View>
            <MaterialIcons name="arrow-forward" size={20} color="#82d8ff" />
          </TouchableOpacity>

          <Text style={{ fontSize: 12, color: '#6f787e', fontFamily: 'Manrope', textAlign: 'center', marginTop: 8 }}>
            Cet espace ne remplace pas un professionnel de santé
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
