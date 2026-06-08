import React, { useState, useMemo } from 'react'
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useMedicalHistory, type HistoryEvent } from '@/features/patient/hooks/useMedicalHistory'
import { useResponsive } from '@/hooks/useResponsive'

// ─── Constants ───────────────────────────────────────────────────────────────

const TZ = { timeZone: 'Africa/Dakar' }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...TZ,
  })
}

type EventConfig = {
  icon: React.ComponentProps<typeof MaterialIcons>['name']
  color: string
  bg: string
  label: string
}

const EVENT_CONFIG: Record<HistoryEvent['event_type'], EventConfig> = {
  consultation: {
    icon: 'stethoscope',
    color: '#006685',
    bg: '#e5eeff',
    label: 'Consultation',
  },
  prescription: {
    icon: 'medication',
    color: '#1d7a3a',
    bg: '#e8f5e9',
    label: 'Ordonnance',
  },
  note_shared: {
    icon: 'note',
    color: '#705d00',
    bg: '#fff8e1',
    label: 'Note partagée',
  },
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonEntry({ scale }: { scale: (n: number) => number }) {
  return (
    <View style={{ flexDirection: 'row', marginBottom: scale(20) }}>
      {/* Left timeline */}
      <View style={{ alignItems: 'center', marginRight: scale(14), width: scale(28) }}>
        <View
          style={{
            width: scale(28),
            height: scale(28),
            borderRadius: scale(14),
            backgroundColor: '#e5eeff',
          }}
        />
        <View style={{ width: 2, flex: 1, backgroundColor: '#e5eeff', marginTop: scale(4) }} />
      </View>
      {/* Card placeholder */}
      <View style={{ flex: 1, marginBottom: scale(8) }}>
        <View
          style={{
            height: scale(14),
            width: '40%',
            backgroundColor: '#e5eeff',
            borderRadius: scale(6),
            marginBottom: scale(8),
          }}
        />
        <View
          style={{
            height: scale(80),
            backgroundColor: '#eff4ff',
            borderRadius: scale(16),
          }}
        />
      </View>
    </View>
  )
}

// ─── Timeline Item ────────────────────────────────────────────────────────────

function TimelineItem({
  item,
  isLast,
}: {
  item: HistoryEvent
  isLast: boolean
}) {
  const { fs, scale, px } = useResponsive()
  const cfg = EVENT_CONFIG[item.event_type]
  const dateLabel = formatDate(item.date)

  return (
    <View style={{ flexDirection: 'row', paddingHorizontal: px }}>
      {/* Left: line + dot */}
      <View
        style={{
          alignItems: 'center',
          marginRight: scale(14),
          width: scale(28),
        }}
      >
        {/* Dot */}
        <View
          style={{
            width: scale(28),
            height: scale(28),
            borderRadius: scale(14),
            backgroundColor: cfg.bg,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1.5,
            borderColor: cfg.color + '40',
          }}
        >
          <MaterialIcons name={cfg.icon} size={scale(14)} color={cfg.color} />
        </View>
        {/* Vertical line */}
        {!isLast && (
          <View
            style={{
              width: 2,
              flex: 1,
              backgroundColor: '#e5eeff',
              marginTop: scale(4),
              minHeight: scale(24),
            }}
          />
        )}
      </View>

      {/* Right: date label + card */}
      <View style={{ flex: 1, paddingBottom: scale(20) }}>
        {/* Date */}
        <Text
          style={{
            fontSize: fs.xs,
            fontWeight: '700',
            color: '#6f787e',
            fontFamily: 'Manrope',
            letterSpacing: 0.3,
            marginBottom: scale(6),
            textTransform: 'capitalize',
          }}
        >
          {dateLabel}
        </Text>

        {/* Glass card */}
        <View
          style={{
            backgroundColor: 'rgba(255,255,255,0.88)',
            borderRadius: scale(16),
            borderWidth: 1,
            borderColor: '#e5eeff',
            shadowColor: '#006685',
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.06,
            shadowRadius: 10,
            elevation: 2,
            overflow: 'hidden',
          }}
        >
          {/* Top band: event type badge */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: scale(14),
              paddingVertical: scale(8),
              backgroundColor: cfg.bg,
              borderBottomWidth: 1,
              borderBottomColor: cfg.color + '20',
            }}
          >
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: scale(6) }}
            >
              <MaterialIcons
                name={cfg.icon}
                size={scale(14)}
                color={cfg.color}
              />
              <Text
                style={{
                  fontSize: scale(10),
                  fontWeight: '700',
                  color: cfg.color,
                  fontFamily: 'Manrope',
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                }}
              >
                {cfg.label}
              </Text>
            </View>
            <MaterialIcons
              name="chevron-right"
              size={scale(18)}
              color={cfg.color}
            />
          </View>

          {/* Body */}
          <View style={{ padding: scale(14) }}>
            {/* Title */}
            <Text
              style={{
                fontSize: fs.md,
                fontWeight: '700',
                color: '#0b1c30',
                fontFamily: 'Manrope',
                marginBottom: scale(4),
              }}
              numberOfLines={1}
            >
              {item.title}
            </Text>

            {/* Practitioner */}
            {item.practitioner_name && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: scale(4),
                  marginBottom: scale(4),
                }}
              >
                <MaterialIcons
                  name="person"
                  size={scale(13)}
                  color="#6f787e"
                />
                <Text
                  style={{
                    fontSize: fs.sm,
                    color: '#6f787e',
                    fontFamily: 'Manrope',
                    fontWeight: '600',
                  }}
                  numberOfLines={1}
                >
                  {item.practitioner_name}
                  {item.practitioner_speciality
                    ? ` · ${item.practitioner_speciality}`
                    : ''}
                </Text>
              </View>
            )}

            {/* Summary */}
            {item.summary && (
              <Text
                style={{
                  fontSize: fs.sm,
                  color: '#3f484d',
                  fontFamily: 'Manrope',
                  fontStyle: 'italic',
                  lineHeight: scale(18),
                }}
                numberOfLines={2}
              >
                {item.summary}
              </Text>
            )}
          </View>
        </View>
      </View>
    </View>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function DossierScreen() {
  const router = useRouter()
  const { px, fs, scale } = useResponsive()
  const [search, setSearch] = useState('')

  const { data, isLoading, refetch, isRefetching } = useMedicalHistory()

  const filtered = useMemo(() => {
    if (!data) return []
    if (!search.trim()) return data
    const q = search.toLowerCase()
    return data.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        (e.practitioner_name ?? '').toLowerCase().includes(q) ||
        (e.practitioner_speciality ?? '').toLowerCase().includes(q) ||
        (e.summary ?? '').toLowerCase().includes(q)
    )
  }, [data, search])

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      {/* Header */}
      <View
        style={{
          paddingHorizontal: px,
          paddingTop: scale(16),
          paddingBottom: scale(12),
          flexDirection: 'row',
          alignItems: 'center',
          gap: scale(10),
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: scale(38),
            height: scale(38),
            borderRadius: scale(12),
            backgroundColor: 'rgba(255,255,255,0.88)',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: '#e5eeff',
          }}
        >
          <MaterialIcons name="arrow-back" size={scale(20)} color="#0b1c30" />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: fs.xxl,
              fontWeight: '800',
              color: '#0b1c30',
              fontFamily: 'Manrope',
              letterSpacing: -0.5,
            }}
          >
            Mon dossier
          </Text>
          <Text
            style={{
              fontSize: fs.sm,
              color: '#6f787e',
              fontFamily: 'Manrope',
              marginTop: 1,
            }}
          >
            Historique médical complet
          </Text>
        </View>

        {/* Event count badge */}
        {(data ?? []).length > 0 && (
          <View
            style={{
              backgroundColor: '#e5eeff',
              borderRadius: scale(20),
              paddingHorizontal: scale(10),
              paddingVertical: scale(4),
              borderWidth: 1,
              borderColor: '#006685' + '30',
            }}
          >
            <Text
              style={{
                fontSize: fs.xs,
                fontWeight: '700',
                color: '#006685',
                fontFamily: 'Manrope',
              }}
            >
              {data!.length}
            </Text>
          </View>
        )}
      </View>

      {/* Search bar */}
      <View style={{ paddingHorizontal: px, marginBottom: scale(12) }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'rgba(255,255,255,0.88)',
            borderRadius: scale(14),
            borderWidth: 1,
            borderColor: '#e5eeff',
            paddingHorizontal: scale(12),
            gap: scale(8),
          }}
        >
          <MaterialIcons name="search" size={scale(18)} color="#6f787e" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher dans l'historique…"
            placeholderTextColor="#bec8ce"
            style={{
              flex: 1,
              paddingVertical: scale(11),
              fontSize: fs.md,
              fontFamily: 'Manrope',
              color: '#0b1c30',
            }}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <MaterialIcons name="close" size={scale(16)} color="#6f787e" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Legend */}
      {!isLoading && (data ?? []).length > 0 && (
        <View
          style={{
            flexDirection: 'row',
            paddingHorizontal: px,
            gap: scale(10),
            marginBottom: scale(14),
            flexWrap: 'wrap',
          }}
        >
          {(Object.entries(EVENT_CONFIG) as [HistoryEvent['event_type'], EventConfig][]).map(
            ([, cfg]) => (
              <View
                key={cfg.label}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: scale(4),
                  backgroundColor: cfg.bg,
                  borderRadius: scale(20),
                  paddingHorizontal: scale(8),
                  paddingVertical: scale(3),
                  borderWidth: 1,
                  borderColor: cfg.color + '30',
                }}
              >
                <MaterialIcons name={cfg.icon} size={scale(11)} color={cfg.color} />
                <Text
                  style={{
                    fontSize: scale(10),
                    fontWeight: '700',
                    color: cfg.color,
                    fontFamily: 'Manrope',
                  }}
                >
                  {cfg.label}
                </Text>
              </View>
            )
          )}
        </View>
      )}

      {/* Loading skeletons */}
      {isLoading ? (
        <View style={{ paddingHorizontal: px, paddingTop: scale(8) }}>
          {[1, 2, 3].map((k) => (
            <SkeletonEntry key={k} scale={scale} />
          ))}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100, paddingTop: scale(4) }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#006685"
            />
          }
          renderItem={({ item, index }) => (
            <TimelineItem
              item={item}
              isLast={index === filtered.length - 1}
            />
          )}
          ListEmptyComponent={
            <View
              style={{
                alignItems: 'center',
                paddingTop: scale(60),
                paddingHorizontal: px,
              }}
            >
              <View
                style={{
                  width: scale(80),
                  height: scale(80),
                  borderRadius: scale(40),
                  backgroundColor: '#e5eeff',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: scale(16),
                }}
              >
                <MaterialIcons
                  name="history"
                  size={scale(38)}
                  color="#006685"
                />
              </View>
              <Text
                style={{
                  fontSize: fs.xl,
                  fontWeight: '700',
                  color: '#0b1c30',
                  fontFamily: 'Manrope',
                  marginBottom: scale(8),
                  textAlign: 'center',
                }}
              >
                {search.trim()
                  ? 'Aucun résultat'
                  : 'Votre historique médical apparaîtra ici'}
              </Text>
              <Text
                style={{
                  fontSize: fs.md,
                  color: '#6f787e',
                  fontFamily: 'Manrope',
                  textAlign: 'center',
                  lineHeight: scale(22),
                  paddingHorizontal: scale(20),
                }}
              >
                {search.trim()
                  ? 'Essayez un autre terme de recherche.'
                  : 'Vos consultations, ordonnances et notes partagées par vos praticiens apparaîtront ici.'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}
