import { useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { GlassCard } from '@/components/ui/GlassCard'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/features/auth/store/authStore'

interface Sentiment {
  score: number
  stress: number
  emotion: string
  crisis: boolean
}

interface Exchange {
  transcript: string
  response: string
  sentiment: Sentiment
  timestamp: number
}

function scoreColor(score: number): string {
  if (score >= 7) return '#1d7a3a'
  if (score >= 4) return '#705d00'
  return '#ba1a1a'
}

export default function VoiceInsightsScreen() {
  const router = useRouter()
  const { exchanges: exchangesRaw, duration } = useLocalSearchParams<{
    exchanges: string
    duration: string
  }>()
  const { profile } = useAuthStore()

  const exchanges = useMemo((): Exchange[] => {
    try {
      const parsed = JSON.parse(exchangesRaw ?? '[]')
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }, [exchangesRaw])

  const durationSec = useMemo(() => {
    const n = parseInt(duration ?? '0', 10)
    return Number.isFinite(n) && n >= 0 ? n : 0
  }, [duration])

  const avgScore = useMemo(() => {
    if (exchanges.length === 0) return 0
    return (
      Math.round(
        (exchanges.reduce((s, e) => s + e.sentiment.score, 0) / exchanges.length) * 10
      ) / 10
    )
  }, [exchanges])

  const avgStress = useMemo(() => {
    if (exchanges.length === 0) return 0
    return Math.round(
      exchanges.reduce((s, e) => s + e.sentiment.stress, 0) / exchanges.length
    )
  }, [exchanges])

  const CHART_H = 80

  const handleSaveToJournal = async () => {
    if (!profile?.id) return
    if (exchanges.length === 0) {
      Alert.alert('Session vide', 'Aucun échange à enregistrer.')
      return
    }

    const content = exchanges
      .map(e => `**Moi :** ${e.transcript}\n\n**Mounima :** ${e.response}`)
      .join('\n\n---\n\n')

    const { error } = await supabase.from('journal_entries').insert({
      patient_id: profile.id,
      title: `Session vocale Mounima — ${new Date().toLocaleDateString('fr-FR')}`,
      content,
      mood_score: Math.round(avgScore),
      tags: ['mounima', 'session-vocale'],
      is_private: true,
    })

    if (error) {
      Alert.alert('Erreur', "Impossible d'enregistrer dans le journal. Réessayez.")
      return
    }

    router.push('/(patient)/mental-health/journal')
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>

        {/* Header */}
        <View style={{ paddingHorizontal: 24, paddingTop: 16, marginBottom: 24 }}>
          <TouchableOpacity
            onPress={() => router.push('/(patient)/mental-health')}
            style={{ marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <MaterialIcons name="arrow-back" size={20} color="#82d8ff" />
            <Text style={{ color: '#82d8ff', fontFamily: 'Manrope', fontWeight: '500' }}>
              Accueil
            </Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#0b1c30', fontFamily: 'Manrope' }}>
            Fin de session
          </Text>
          <Text style={{ fontSize: 14, color: '#3f484d', fontFamily: 'Manrope', marginTop: 4 }}>
            {Math.floor(durationSec / 60)} min {durationSec % 60} sec · {exchanges.length} échange{exchanges.length !== 1 ? 's' : ''}
          </Text>
        </View>

        <View style={{ paddingHorizontal: 24, gap: 16 }}>

          {/* Empty state */}
          {exchanges.length === 0 && (
            <GlassCard style={{ alignItems: 'center', paddingVertical: 32, gap: 12 }}>
              <MaterialIcons name="mic-off" size={40} color="#6f787e" />
              <Text style={{ fontFamily: 'Manrope', fontSize: 15, color: '#6f787e', textAlign: 'center' }}>
                Aucun échange enregistré.{'\n'}La session était peut-être trop courte.
              </Text>
            </GlassCard>
          )}

          {/* KPI cards */}
          {exchanges.length > 0 && (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <GlassCard style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                <Text style={{
                  fontSize: 28, fontWeight: '900', fontFamily: 'Manrope',
                  color: scoreColor(avgScore),
                }}>
                  {avgScore}
                </Text>
                <Text style={{ fontSize: 11, color: '#6f787e', fontFamily: 'Manrope', textAlign: 'center' }}>
                  Score émotionnel
                </Text>
              </GlassCard>
              <GlassCard style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                <Text style={{
                  fontSize: 28, fontWeight: '900', fontFamily: 'Manrope',
                  color: avgStress > 70 ? '#ba1a1a' : avgStress > 40 ? '#705d00' : '#1d7a3a',
                }}>
                  {avgStress}%
                </Text>
                <Text style={{ fontSize: 11, color: '#6f787e', fontFamily: 'Manrope', textAlign: 'center' }}>
                  Stress moyen
                </Text>
              </GlassCard>
            </View>
          )}

          {/* Emotional evolution chart */}
          {exchanges.length > 1 && (
            <GlassCard>
              <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '700', color: '#0b1c30', marginBottom: 12 }}>
                Évolution de l'humeur
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: CHART_H, gap: 6 }}>
                {exchanges.map((e, i) => {
                  const h = Math.max((e.sentiment.score / 10) * CHART_H * 0.9, 4)
                  const color = scoreColor(e.sentiment.score)
                  return (
                    <View
                      key={e.timestamp}
                      style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: CHART_H, gap: 4 }}
                    >
                      <View style={{ height: h, width: '70%', borderRadius: 4, backgroundColor: color }} />
                      <Text style={{ fontFamily: 'Manrope', fontSize: 9, color: '#6f787e' }}>
                        {i + 1}
                      </Text>
                    </View>
                  )
                })}
              </View>
            </GlassCard>
          )}

          {/* Clinical disclaimer */}
          <View style={{
            padding: 14, borderRadius: 12,
            backgroundColor: 'rgba(0,102,133,0.06)',
            flexDirection: 'row', alignItems: 'flex-start', gap: 8,
          }}>
            <MaterialIcons name="info" size={16} color="#82d8ff" style={{ marginTop: 1 }} />
            <Text style={{ fontFamily: 'Manrope', fontSize: 12, color: '#3f484d', flex: 1, lineHeight: 18 }}>
              Mounima n'est pas un médecin ou thérapeute. Pour un suivi clinique, consulte un praticien de santé.
            </Text>
          </View>

          {/* CTA — Save to journal */}
          <TouchableOpacity
            onPress={handleSaveToJournal}
            style={{
              paddingVertical: 14, borderRadius: 999,
              backgroundColor: '#82d8ff',
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <MaterialIcons name="book" size={18} color="#fff" />
            <Text style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: '700', color: '#fff' }}>
              Enregistrer dans le journal
            </Text>
          </TouchableOpacity>

          {/* CTA — Book session */}
          <TouchableOpacity
            onPress={() => router.push('/(patient)/find-practitioners')}
            style={{
              paddingVertical: 14, borderRadius: 999,
              borderWidth: 1, borderColor: '#82d8ff',
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <MaterialIcons name="calendar-today" size={18} color="#82d8ff" />
            <Text style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: '700', color: '#82d8ff' }}>
              Réserver une séance
            </Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
