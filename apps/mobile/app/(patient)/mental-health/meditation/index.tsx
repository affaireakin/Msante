import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StatusBar } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'

// ── Catalogue data ─────────────────────────────────────────────────────────────

interface Session {
  id: string
  title: string
  technique: string
  duration: number   // seconds
  desc: string
  detail: string
  emoji: string
  tag: string
  tagColor: string
  tagBg: string
  accent: string
  recommended?: boolean
}

const SESSIONS: Session[] = [
  {
    id: 'coherence_5',
    title: 'Cohérence cardiaque',
    technique: 'coherence',
    duration: 300,
    desc: 'Inspirez 5s · Expirez 5s',
    detail: 'Réduit le cortisol. Idéal matin et soir.',
    emoji: '💙',
    tag: 'Anxiété',
    tagColor: '#005e7a',
    tagBg: '#bee9ff',
    accent: '#82d8ff',
    recommended: true,
  },
  {
    id: 'coherence_10',
    title: 'Cohérence 10 min',
    technique: 'coherence',
    duration: 600,
    desc: 'Inspirez 5s · Expirez 5s',
    detail: 'Version longue pour ancrage profond.',
    emoji: '🫁',
    tag: 'Stress',
    tagColor: '#005e7a',
    tagBg: '#bee9ff',
    accent: '#82d8ff',
  },
  {
    id: 'box',
    title: 'Box Breathing',
    technique: 'box',
    duration: 480,
    desc: '4-4-4-4 · Quatre temps égaux',
    detail: 'Technique des Navy SEALs. Clarté et contrôle.',
    emoji: '🧠',
    tag: 'Concentration',
    tagColor: '#544600',
    tagBg: '#ffe170',
    accent: '#e4c546',
  },
  {
    id: 'triangle',
    title: 'Respiration triangulaire',
    technique: 'triangle',
    duration: 360,
    desc: 'Inspirez 4s · Retenez 4s · Expirez 4s',
    detail: 'Équilibre du système nerveux. Énergie douce.',
    emoji: '🔺',
    tag: 'Équilibre',
    tagColor: '#3d6b3a',
    tagBg: '#dcfce7',
    accent: '#4ade80',
  },
  {
    id: '478',
    title: 'Relaxation profonde',
    technique: '478',
    duration: 600,
    desc: '4-7-8 · Inspirez · Retenez · Expirez',
    detail: 'Technique du Dr. Weil. Endormissement rapide.',
    emoji: '🌙',
    tag: 'Sommeil',
    tagColor: '#4b2c7a',
    tagBg: '#ede9fe',
    accent: '#a78bfa',
  },
  {
    id: '478_long',
    title: 'Sommeil profond',
    technique: '478',
    duration: 1200,
    desc: '4-7-8 · Session longue 20 min',
    detail: 'Pour les insomnies chroniques. À pratiquer allongé.',
    emoji: '🌠',
    tag: 'Sommeil',
    tagColor: '#4b2c7a',
    tagBg: '#ede9fe',
    accent: '#a78bfa',
  },
]

const TAGS = ['Tous', 'Anxiété', 'Stress', 'Concentration', 'Équilibre', 'Sommeil']

// ── Session card ──────────────────────────────────────────────────────────────

function SessionCard({ item, onPress }: { item: Session; onPress: () => void }) {
  const mins = Math.ceil(item.duration / 60)
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      style={{
        backgroundColor: 'rgba(255,255,255,0.72)',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(190,200,206,0.35)',
        overflow: 'hidden',
        shadowColor: '#82d8ff',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.06,
        shadowRadius: 20,
        elevation: 3,
      }}
    >
      {/* Accent stripe */}
      <View style={{ height: 3, backgroundColor: item.accent, opacity: 0.7 }} />

      <View style={{ padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        {/* Icon */}
        <View style={{
          width: 58, height: 58, borderRadius: 16,
          backgroundColor: `${item.accent}22`,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 28 }}>{item.emoji}</Text>
        </View>

        {/* Content */}
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: '700', color: '#0b1c30' }}>
              {item.title}
            </Text>
            {item.recommended && (
              <View style={{ backgroundColor: '#82d8ff', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                <Text style={{ fontFamily: 'Manrope', fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 0.5 }}>
                  RECOMMANDÉ
                </Text>
              </View>
            )}
          </View>
          <Text style={{ fontFamily: 'Manrope', fontSize: 12, color: '#3f484d' }}>{item.desc}</Text>
          <Text style={{ fontFamily: 'Manrope', fontSize: 11, color: '#6f787e', marginTop: 1 }} numberOfLines={1}>
            {item.detail}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <View style={{ backgroundColor: item.tagBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ fontFamily: 'Manrope', fontSize: 10, fontWeight: '700', color: item.tagColor }}>
                {item.tag}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <MaterialIcons name="schedule" size={11} color="#6f787e" />
              <Text style={{ fontFamily: 'Manrope', fontSize: 11, color: '#6f787e' }}>{mins} min</Text>
            </View>
          </View>
        </View>

        <MaterialIcons name="play-circle-filled" size={34} color={item.accent} />
      </View>
    </TouchableOpacity>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function MeditationCatalogue() {
  const router = useRouter()
  const [activeTag, setActiveTag] = useState('Tous')

  const filtered = activeTag === 'Tous'
    ? SESSIONS
    : SESSIONS.filter(s => s.tag === activeTag)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 8 }}>
        <Text style={{ fontFamily: 'Manrope', fontSize: 24, fontWeight: '800', color: '#0b1c30' }}>
          Méditation guidée
        </Text>
        <Text style={{ fontFamily: 'Manrope', fontSize: 14, color: '#6f787e', marginTop: 3 }}>
          Inspirez confiance, expirez la tension
        </Text>
      </View>

      {/* Category filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 14, gap: 8 }}
      >
        {TAGS.map(tag => (
          <TouchableOpacity
            key={tag}
            onPress={() => setActiveTag(tag)}
            style={{
              paddingHorizontal: 16, paddingVertical: 7, borderRadius: 999,
              backgroundColor: activeTag === tag ? '#82d8ff' : 'rgba(255,255,255,0.80)',
              borderWidth: 1,
              borderColor: activeTag === tag ? '#82d8ff' : 'rgba(190,200,206,0.50)',
            }}
          >
            <Text style={{
              fontFamily: 'Manrope', fontSize: 13, fontWeight: '600',
              color: activeTag === tag ? '#fff' : '#3f484d',
            }}>
              {tag}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Session list */}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, gap: 14, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Tip banner */}
        <View style={{
          backgroundColor: 'rgba(130,216,255,0.15)',
          borderRadius: 14, padding: 14,
          flexDirection: 'row', alignItems: 'flex-start', gap: 10,
          borderWidth: 1, borderColor: 'rgba(130,216,255,0.30)',
          marginBottom: 2,
        }}>
          <Text style={{ fontSize: 18 }}>💡</Text>
          <Text style={{ fontFamily: 'Manrope', fontSize: 12, color: '#005e7a', flex: 1, lineHeight: 18 }}>
            Pratiquez au moins <Text style={{ fontWeight: '700' }}>5 minutes par jour</Text> pour ressentir les bénéfices sur votre stress et votre sommeil.
          </Text>
        </View>

        {filtered.map(item => (
          <SessionCard
            key={item.id}
            item={item}
            onPress={() =>
              router.push({
                pathname: '/(patient)/mental-health/meditation/session',
                params: {
                  technique: item.technique,
                  duration: String(item.duration),
                  title: item.title,
                  accent: item.accent,
                  emoji: item.emoji,
                },
              })
            }
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}
