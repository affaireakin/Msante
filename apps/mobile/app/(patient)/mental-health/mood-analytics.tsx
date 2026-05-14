import { useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useMoodEntries } from '@/features/mental-health/mood/hooks/useMoodEntries'
import { useJournalEntries } from '@/features/mental-health/journal/hooks/useJournalEntries'
import { supabase } from '@/services/supabase'
import { GlassCard } from '@/components/ui/GlassCard'
import type { MoodEntry } from '@/types/mentalHealth'

interface MeditationSession {
  session_date: string
  duration_min: number
}

interface DayStat {
  date: string
  score: number | null
  hasMeditation: boolean
  hasJournal: boolean
}

function scoreColor(score: number): string {
  if (score >= 7) return '#1d7a3a'
  if (score >= 4) return '#705d00'
  return '#ba1a1a'
}

const CHART_H = 120

export default function MoodAnalyticsScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const patientId = user?.id ?? ''

  const { data: moodEntries = [] } = useMoodEntries(patientId)
  const { data: journalEntries = [] } = useJournalEntries(patientId)

  const { data: meditationSessions = [] } = useQuery<MeditationSession[]>({
    queryKey: ['meditation-sessions', patientId],
    enabled: !!patientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meditation_sessions')
        .select('session_date, duration_min')
        .eq('patient_id', patientId)
        .order('session_date', { ascending: false })
        .limit(90)
      if (error) throw error
      return (data ?? []) as MeditationSession[]
    },
  })

  const { data: extendedMoodEntries = [] } = useQuery({
    queryKey: ['mood_entries_90', patientId],
    enabled: !!patientId,
    queryFn: async (): Promise<MoodEntry[]> => {
      const { data, error } = await supabase
        .from('mood_entries')
        .select('id, patient_id, score, emotions, note, entry_date, created_at')
        .eq('patient_id', patientId)
        .order('entry_date', { ascending: false })
        .limit(90)
      if (error) throw error
      // Map snake_case to camelCase to match MoodEntry type
      return (data ?? []).map(e => ({
        id: e.id,
        patientId: e.patient_id,
        score: e.score,
        emotions: e.emotions,
        note: e.note,
        entryDate: e.entry_date,
        createdAt: e.created_at,
      })) as MoodEntry[]
    },
    staleTime: 5 * 60 * 1000,
  })

  const todayDateStr = new Date().toISOString().split('T')[0]

  const stats = useMemo(() => {
    const today = new Date(todayDateStr)
    const days30: DayStat[] = []

    for (let i = 29; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      const entry = moodEntries.find(e => e.entryDate === dateStr)
      const hasMeditation = meditationSessions.some(m => m.session_date === dateStr)
      const hasJournal = journalEntries.some(j => j.createdAt.startsWith(dateStr))
      days30.push({ date: dateStr, score: entry?.score ?? null, hasMeditation, hasJournal })
    }

    const scored = days30.filter(d => d.score !== null)
    const avgScore =
      scored.length > 0
        ? Math.round((scored.reduce((s, d) => s + (d.score ?? 0), 0) / scored.length) * 10) / 10
        : 0

    // Consecutive-day streak (most recent days)
    let streak = 0
    for (let i = days30.length - 1; i >= 0; i--) {
      if (days30[i].score !== null) streak++
      else break
    }

    // Trend vs previous 30 days
    const cutoff30 = new Date(today)
    cutoff30.setDate(today.getDate() - 30)
    const cutoff60 = new Date(today)
    cutoff60.setDate(today.getDate() - 60)

    const prev30Entries = extendedMoodEntries.filter(e => {
      if (!e.entryDate) return false
      const d = new Date(e.entryDate)
      return d >= cutoff60 && d < cutoff30
    })
    const prevAvg =
      prev30Entries.length > 0
        ? prev30Entries.reduce((s, e) => s + e.score, 0) / prev30Entries.length
        : null
    const trend = prevAvg !== null ? Math.round((avgScore - prevAvg) * 10) / 10 : null

    // Top 3 emotions from last 30 entries
    const emotionCounts: Record<string, number> = {}
    for (const e of moodEntries.slice(0, 30)) {
      for (const em of e.emotions ?? []) {
        emotionCounts[em] = (emotionCounts[em] ?? 0) + 1
      }
    }
    const top3Emotions = Object.entries(emotionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)

    // Meditation count this calendar month
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
      .toISOString()
      .split('T')[0]
    const meditThisMonth = meditationSessions.filter(m => m.session_date >= monthStart).length

    // Journal this week vs last week
    const weekAgo = new Date(today)
    weekAgo.setDate(today.getDate() - 7)
    const twoWeeksAgo = new Date(today)
    twoWeeksAgo.setDate(today.getDate() - 14)

    const journalThisWeek = journalEntries.filter(j => {
      const d = new Date(j.createdAt)
      return d >= weekAgo
    }).length
    const journalLastWeek = journalEntries.filter(j => {
      const d = new Date(j.createdAt)
      return d >= twoWeeksAgo && d < weekAgo
    }).length

    // Meditation × mood correlation
    const daysWithMedit = days30.filter(d => d.hasMeditation && d.score !== null)
    const daysWithoutMedit = days30.filter(d => !d.hasMeditation && d.score !== null)
    const avgWith =
      daysWithMedit.length > 0
        ? daysWithMedit.reduce((s, d) => s + (d.score ?? 0), 0) / daysWithMedit.length
        : null
    const avgWithout =
      daysWithoutMedit.length > 0
        ? daysWithoutMedit.reduce((s, d) => s + (d.score ?? 0), 0) / daysWithoutMedit.length
        : null
    const correlationDelta =
      avgWith !== null && avgWithout !== null
        ? Math.round((avgWith - avgWithout) * 10) / 10
        : null

    return {
      days30,
      avgScore,
      streak,
      trend,
      top3Emotions,
      meditThisMonth,
      journalThisWeek,
      journalLastWeek,
      correlationDelta,
      daysWithMeditCount: daysWithMedit.length,
    }
  }, [moodEntries, extendedMoodEntries, meditationSessions, journalEntries, todayDateStr])

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={{ paddingHorizontal: 24, paddingTop: 16, marginBottom: 24 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <MaterialIcons name="arrow-back" size={20} color="#006685" />
            <Text style={{ color: '#006685', fontFamily: 'Manrope', fontWeight: '500' }}>Retour</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#0b1c30', fontFamily: 'Manrope' }}>
            Mes statistiques
          </Text>
          <Text style={{ fontSize: 14, color: '#3f484d', fontFamily: 'Manrope', marginTop: 4 }}>
            30 derniers jours
          </Text>
        </View>

        <View style={{ paddingHorizontal: 24, gap: 16 }}>
          {/* KPI row */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <GlassCard style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <Text
                style={{
                  fontSize: 28,
                  fontWeight: '900',
                  color: scoreColor(stats.avgScore),
                  fontFamily: 'Manrope',
                }}
              >
                {stats.avgScore}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  color: '#6f787e',
                  fontFamily: 'Manrope',
                  textAlign: 'center',
                }}
              >
                Score moyen
              </Text>
              {stats.trend !== null && (
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: stats.trend >= 0 ? '#1d7a3a' : '#ba1a1a',
                    fontFamily: 'Manrope',
                  }}
                >
                  {stats.trend >= 0 ? '+' : ''}
                  {stats.trend} pts
                </Text>
              )}
            </GlassCard>
            <GlassCard style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <Text
                style={{
                  fontSize: 28,
                  fontWeight: '900',
                  color: '#006685',
                  fontFamily: 'Manrope',
                }}
              >
                {stats.streak}
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  color: '#6f787e',
                  fontFamily: 'Manrope',
                  textAlign: 'center',
                }}
              >
                Jours consécutifs
              </Text>
            </GlassCard>
          </View>

          {/* 30-day bar chart */}
          <GlassCard>
            <Text
              style={{
                fontFamily: 'Manrope',
                fontSize: 13,
                fontWeight: '700',
                color: '#0b1c30',
                marginBottom: 12,
              }}
            >
              Humeur — 30 jours
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-end',
                height: CHART_H,
                gap: 2,
              }}
            >
              {stats.days30.map((d, i) => {
                const barH =
                  d.score !== null
                    ? Math.max((d.score / 10) * CHART_H * 0.9, 4)
                    : 3
                const isToday = i === 29
                return (
                  <View
                    key={d.date}
                    style={{
                      flex: 1,
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      height: CHART_H,
                    }}
                  >
                    <View
                      style={{
                        height: barH,
                        width: '80%',
                        borderRadius: 3,
                        backgroundColor:
                          d.score !== null
                            ? isToday
                              ? '#006685'
                              : scoreColor(d.score) + '99'
                            : 'rgba(190,200,206,0.3)',
                      }}
                    />
                  </View>
                )
              })}
            </View>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginTop: 6,
              }}
            >
              <Text style={{ fontFamily: 'Manrope', fontSize: 10, color: '#6f787e' }}>J-29</Text>
              <Text style={{ fontFamily: 'Manrope', fontSize: 10, color: '#6f787e' }}>
                Aujourd'hui
              </Text>
            </View>
          </GlassCard>

          {/* Top emotions */}
          {stats.top3Emotions.length > 0 && (
            <GlassCard style={{ gap: 10 }}>
              <Text
                style={{
                  fontFamily: 'Manrope',
                  fontSize: 13,
                  fontWeight: '700',
                  color: '#0b1c30',
                }}
              >
                Émotions fréquentes
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {stats.top3Emotions.map(([emotion, count]) => (
                  <View
                    key={emotion}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 999,
                      backgroundColor: '#e5eeff',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: 'Manrope',
                        fontSize: 13,
                        color: '#006685',
                        fontWeight: '600',
                      }}
                    >
                      {emotion}
                    </Text>
                    <Text
                      style={{ fontFamily: 'Manrope', fontSize: 11, color: '#6f787e' }}
                    >
                      ×{count}
                    </Text>
                  </View>
                ))}
              </View>
            </GlassCard>
          )}

          {/* Engagement */}
          <GlassCard style={{ gap: 14 }}>
            <Text
              style={{
                fontFamily: 'Manrope',
                fontSize: 13,
                fontWeight: '700',
                color: '#0b1c30',
              }}
            >
              Engagement bien-être
            </Text>

            {/* Meditation progress bar */}
            <View style={{ gap: 6 }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontFamily: 'Manrope', fontSize: 13, color: '#3f484d' }}>
                  🧘 Méditations ce mois
                </Text>
                <Text
                  style={{
                    fontFamily: 'Manrope',
                    fontSize: 13,
                    fontWeight: '700',
                    color: '#006685',
                  }}
                >
                  {stats.meditThisMonth} / 8
                </Text>
              </View>
              <View
                style={{
                  height: 6,
                  borderRadius: 999,
                  backgroundColor: 'rgba(190,200,206,0.3)',
                }}
              >
                <View
                  style={{
                    height: 6,
                    borderRadius: 999,
                    backgroundColor: '#006685',
                    width: `${Math.min((stats.meditThisMonth / 8) * 100, 100)}%`,
                  }}
                />
              </View>
            </View>

            {/* Journal count */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontFamily: 'Manrope', fontSize: 13, color: '#3f484d' }}>
                📝 Journal cette semaine
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text
                  style={{
                    fontFamily: 'Manrope',
                    fontSize: 13,
                    fontWeight: '700',
                    color: '#006685',
                  }}
                >
                  {stats.journalThisWeek}
                </Text>
                {stats.journalLastWeek > 0 && (
                  <Text
                    style={{
                      fontFamily: 'Manrope',
                      fontSize: 11,
                      color:
                        stats.journalThisWeek >= stats.journalLastWeek
                          ? '#1d7a3a'
                          : '#ba1a1a',
                    }}
                  >
                    ({stats.journalThisWeek >= stats.journalLastWeek ? '+' : ''}
                    {stats.journalThisWeek - stats.journalLastWeek} vs sem. passée)
                  </Text>
                )}
              </View>
            </View>

            {/* Activity heatmap */}
            <View style={{ gap: 4 }}>
              <Text style={{ fontFamily: 'Manrope', fontSize: 11, color: '#6f787e' }}>
                Activité quotidienne (30 jours)
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                {stats.days30.map(d => {
                  const actions =
                    (d.score !== null ? 1 : 0) +
                    (d.hasMeditation ? 1 : 0) +
                    (d.hasJournal ? 1 : 0)
                  const bg =
                    actions === 0
                      ? 'rgba(190,200,206,0.25)'
                      : actions === 1
                      ? 'rgba(0,102,133,0.25)'
                      : '#006685'
                  return (
                    <View
                      key={d.date}
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 3,
                        backgroundColor: bg,
                      }}
                    />
                  )
                })}
              </View>
            </View>
          </GlassCard>

          {/* Meditation × mood correlation */}
          <GlassCard style={{ gap: 8 }}>
            <Text
              style={{
                fontFamily: 'Manrope',
                fontSize: 13,
                fontWeight: '700',
                color: '#0b1c30',
              }}
            >
              Corrélation méditation × humeur
            </Text>
            {stats.daysWithMeditCount < 5 ? (
              <Text
                style={{
                  fontFamily: 'Manrope',
                  fontSize: 13,
                  color: '#6f787e',
                  fontStyle: 'italic',
                }}
              >
                Continue pour voir ta corrélation — il te faut au moins 5 séances.
              </Text>
            ) : stats.correlationDelta !== null ? (
              <View
                style={{
                  padding: 16,
                  borderRadius: 12,
                  backgroundColor:
                    stats.correlationDelta >= 0 ? '#d1fae5' : '#ffdad6',
                }}
              >
                <Text
                  style={{
                    fontFamily: 'Manrope',
                    fontSize: 15,
                    fontWeight: '700',
                    color: stats.correlationDelta >= 0 ? '#1d7a3a' : '#ba1a1a',
                    textAlign: 'center',
                  }}
                >
                  Les jours où tu médites, ton humeur est en moyenne{' '}
                  <Text style={{ fontSize: 18 }}>
                    {stats.correlationDelta >= 0 ? '+' : ''}
                    {stats.correlationDelta} pts
                  </Text>{' '}
                  plus {stats.correlationDelta >= 0 ? 'haute' : 'basse'} 🎯
                </Text>
              </View>
            ) : null}
          </GlassCard>

          <Text
            style={{
              fontSize: 12,
              color: '#6f787e',
              fontFamily: 'Manrope',
              textAlign: 'center',
              marginTop: 8,
            }}
          >
            Cet espace ne remplace pas un professionnel de santé
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
