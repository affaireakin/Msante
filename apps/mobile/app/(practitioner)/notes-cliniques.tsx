import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  StatusBar,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { supabase } from '@/services/supabase'
import { useResponsive } from '@/hooks/useResponsive'

// ─── Types ────────────────────────────────────────────────────────────────────

const NOTE_TYPES = [
  { key: 'observation',       label: 'Observation',          color: '#006685', bg: '#e5eeff' },
  { key: 'compte_rendu',      label: 'Compte-rendu',         color: '#1d7a3a', bg: '#dcfce7' },
  { key: 'note_suivi',        label: 'Note de suivi',        color: '#705d00', bg: '#fef9c3' },
  { key: 'bilan',             label: 'Bilan',                color: '#475569', bg: '#f1f5f9' },
  { key: 'alerte',            label: 'Alerte',               color: '#ba1a1a', bg: '#ffdad6' },
  { key: 'prescription_note', label: 'Note de prescription', color: '#0f766e', bg: '#ccfbf1' },
] as const

type NoteTypeKey = typeof NOTE_TYPES[number]['key']

interface NoteRow {
  id: string
  note_type: NoteTypeKey
  title: string | null
  content: string
  is_shared_with_patient: boolean
  tags: string[]
  created_at: string
  patient_id: string
  patient_name: string
}

function noteTypeMeta(type: string) {
  return NOTE_TYPES.find((t) => t.key === type) ?? { label: type, color: '#475569', bg: '#f1f5f9' }
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const AVATAR_COLORS = [
  '#006685',
  '#1d7a3a',
  '#705d00',
  '#ba1a1a',
  '#0f766e',
  '#475569',
]

function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

// ─── Query ────────────────────────────────────────────────────────────────────

function useAllNotes() {
  return useQuery<NoteRow[]>({
    queryKey: ['all-notes-cliniques-mobile'],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')

      const { data: pract, error: pErr } = await supabase
        .from('practitioners')
        .select('id')
        .eq('user_id', user.id)
        .single()
      if (pErr || !pract) throw new Error('Profil praticien introuvable')

      const { data, error } = await supabase
        .from('practitioner_notes')
        .select(
          'id, note_type, title, content, is_shared_with_patient, tags, created_at, patient_id, patient:users!practitioner_notes_patient_id_fkey(full_name)',
        )
        .eq('practitioner_id', pract.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      return (data ?? []).map((r) => ({
        id: r.id as string,
        note_type: r.note_type as NoteTypeKey,
        title: r.title as string | null,
        content: r.content as string,
        is_shared_with_patient: r.is_shared_with_patient as boolean,
        tags: (r.tags as string[]) ?? [],
        created_at: r.created_at as string,
        patient_id: r.patient_id as string,
        patient_name:
          (r.patient as unknown as { full_name: string })?.full_name ?? 'Inconnu',
      }))
    },
  })
}

// ─── Note Card ────────────────────────────────────────────────────────────────

interface NoteCardProps {
  note: NoteRow
  onPress: () => void
  px: number
}

function NoteCard({ note, onPress, px }: NoteCardProps) {
  const meta = noteTypeMeta(note.note_type)
  const bgColor = avatarColor(note.patient_name)

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        backgroundColor: 'rgba(255,255,255,0.92)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e5eeff',
        padding: 14,
        marginHorizontal: px,
        marginBottom: 10,
      }}
    >
      {/* Top row: avatar + name + badge + date */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
        {/* Avatar */}
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: bgColor,
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '700', color: '#fff' }}>
            {initials(note.patient_name)}
          </Text>
        </View>

        {/* Name + badge */}
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontFamily: 'Manrope', fontSize: 14, fontWeight: '700', color: '#0b1c30' }}>
            {note.patient_name}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 999,
                backgroundColor: meta.bg,
              }}
            >
              <Text style={{ fontFamily: 'Manrope', fontSize: 10, fontWeight: '700', color: meta.color }}>
                {meta.label}
              </Text>
            </View>
            {note.is_shared_with_patient && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 3,
                  paddingHorizontal: 7,
                  paddingVertical: 3,
                  borderRadius: 999,
                  backgroundColor: '#e5eeff',
                }}
              >
                <MaterialIcons name="share" size={10} color="#006685" />
                <Text style={{ fontFamily: 'Manrope', fontSize: 9, fontWeight: '600', color: '#006685' }}>
                  Partagé
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Date */}
        <Text style={{ fontFamily: 'Manrope', fontSize: 10, color: '#6f787e', flexShrink: 0 }}>
          {fmtDate(note.created_at)}
        </Text>
      </View>

      {/* Title */}
      {note.title ? (
        <Text
          style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '600', color: '#0b1c30', marginBottom: 3 }}
          numberOfLines={1}
        >
          {note.title}
        </Text>
      ) : null}

      {/* Content preview */}
      <Text
        style={{ fontFamily: 'Manrope', fontSize: 12, color: '#6f787e', lineHeight: 18 }}
        numberOfLines={2}
      >
        {note.content}
      </Text>

      {/* Tags */}
      {note.tags.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
          {note.tags.slice(0, 4).map((tag) => (
            <View
              key={tag}
              style={{
                paddingHorizontal: 7,
                paddingVertical: 2,
                borderRadius: 999,
                backgroundColor: '#f1f5f9',
              }}
            >
              <Text style={{ fontFamily: 'Manrope', fontSize: 10, color: '#6f787e' }}>
                #{tag}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Chevron */}
      <View style={{ position: 'absolute', right: 14, bottom: 14 }}>
        <MaterialIcons name="chevron-right" size={18} color="#bec8ce" />
      </View>
    </TouchableOpacity>
  )
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function NotesCliniquesScreen() {
  const router = useRouter()
  const { px } = useResponsive()
  const { data: notes = [], isLoading, error, refetch, isFetching } = useAllNotes()
  const [activeFilter, setActiveFilter] = useState<'all' | NoteTypeKey>('all')

  const filtered =
    activeFilter === 'all' ? notes : notes.filter((n) => n.note_type === activeFilter)

  const sharedCount = notes.filter((n) => n.is_shared_with_patient).length
  const alertCount = notes.filter((n) => n.note_type === 'alerte').length

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9ff" />

      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: px,
          paddingVertical: 14,
          backgroundColor: 'rgba(255,255,255,0.70)',
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(229,238,255,0.60)',
        }}
      >
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
          <MaterialIcons name="description" size={20} color="#006685" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'Manrope', fontSize: 18, fontWeight: '800', color: '#0b1c30', letterSpacing: -0.3 }}>
            Notes cliniques
          </Text>
          <Text style={{ fontFamily: 'Manrope', fontSize: 11, color: '#6f787e' }}>
            {notes.length} note{notes.length !== 1 ? 's' : ''} au total
          </Text>
        </View>
      </View>

      {/* Stats mini-bar */}
      <View
        style={{
          flexDirection: 'row',
          paddingHorizontal: px,
          paddingVertical: 10,
          gap: 8,
          backgroundColor: 'rgba(255,255,255,0.50)',
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(229,238,255,0.50)',
        }}
      >
        <View style={{ flex: 1, alignItems: 'center', padding: 8, backgroundColor: '#e5eeff', borderRadius: 12 }}>
          <Text style={{ fontFamily: 'Manrope', fontSize: 18, fontWeight: '800', color: '#006685' }}>
            {notes.length}
          </Text>
          <Text style={{ fontFamily: 'Manrope', fontSize: 10, color: '#006685' }}>Total</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', padding: 8, backgroundColor: '#dcfce7', borderRadius: 12 }}>
          <Text style={{ fontFamily: 'Manrope', fontSize: 18, fontWeight: '800', color: '#1d7a3a' }}>
            {sharedCount}
          </Text>
          <Text style={{ fontFamily: 'Manrope', fontSize: 10, color: '#1d7a3a' }}>Partagées</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', padding: 8, backgroundColor: '#ffdad6', borderRadius: 12 }}>
          <Text style={{ fontFamily: 'Manrope', fontSize: 18, fontWeight: '800', color: '#ba1a1a' }}>
            {alertCount}
          </Text>
          <Text style={{ fontFamily: 'Manrope', fontSize: 10, color: '#ba1a1a' }}>Alertes</Text>
        </View>
      </View>

      {/* Filter chips */}
      <View style={{ backgroundColor: 'rgba(255,255,255,0.50)' }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: px, paddingVertical: 10, gap: 6 }}
        >
          {/* Chip "Tous" */}
          <TouchableOpacity
            onPress={() => setActiveFilter('all')}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: activeFilter === 'all' ? '#006685' : 'rgba(255,255,255,0.80)',
              borderWidth: 1,
              borderColor: activeFilter === 'all' ? '#006685' : 'rgba(190,200,206,0.50)',
            }}
          >
            <Text
              style={{
                fontFamily: 'Manrope',
                fontSize: 12,
                fontWeight: '700',
                color: activeFilter === 'all' ? '#fff' : '#475569',
              }}
            >
              Tous
            </Text>
          </TouchableOpacity>

          {NOTE_TYPES.map((t) => {
            const active = activeFilter === t.key
            return (
              <TouchableOpacity
                key={t.key}
                onPress={() => setActiveFilter(active ? 'all' : t.key)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: active ? t.color : 'rgba(255,255,255,0.80)',
                  borderWidth: 1,
                  borderColor: active ? t.color : `${t.color}40`,
                }}
              >
                <Text
                  style={{
                    fontFamily: 'Manrope',
                    fontSize: 12,
                    fontWeight: '700',
                    color: active ? '#fff' : t.color,
                  }}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      </View>

      {/* Content */}
      {isLoading ? (
        <ScrollView contentContainerStyle={{ padding: px, gap: 10 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <View
              key={i}
              style={{
                height: 120,
                backgroundColor: 'rgba(229,238,255,0.60)',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: '#e5eeff',
              }}
            />
          ))}
        </ScrollView>
      ) : error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: px }}>
          <MaterialIcons name="error-outline" size={40} color="#ba1a1a" />
          <Text style={{ fontFamily: 'Manrope', fontSize: 14, color: '#ba1a1a', marginTop: 12, textAlign: 'center' }}>
            {(error as Error).message}
          </Text>
          <TouchableOpacity
            onPress={() => refetch()}
            style={{
              marginTop: 16,
              paddingHorizontal: 20,
              paddingVertical: 10,
              backgroundColor: '#006685',
              borderRadius: 12,
            }}
          >
            <Text style={{ fontFamily: 'Manrope', fontSize: 14, fontWeight: '700', color: '#fff' }}>
              Réessayer
            </Text>
          </TouchableOpacity>
        </View>
      ) : filtered.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: px }}>
          <MaterialIcons name="description" size={48} color="#bec8ce" />
          <Text style={{ fontFamily: 'Manrope', fontSize: 14, color: '#6f787e', marginTop: 12, textAlign: 'center' }}>
            Aucune note{activeFilter !== 'all' ? ' dans cette catégorie' : ''}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NoteCard
              note={item}
              px={px}
              onPress={() =>
                router.push(`/(practitioner)/patient-notes/${item.patient_id}` as never)
              }
            />
          )}
          contentContainerStyle={{ paddingTop: 10, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={refetch}
              tintColor="#006685"
            />
          }
        />
      )}
    </SafeAreaView>
  )
}
