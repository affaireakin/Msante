import { useState, useMemo } from 'react'
import { ScrollView, View, Text, TouchableOpacity, TextInput, StatusBar, Alert, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { usePatients, type PatientItem } from '@/features/practitioner/hooks/usePatients'
import { usePatientBlocks, type PatientBlock } from '@/features/practitioner/hooks/usePatientBlocks'
import { GlassCard } from '@/components/ui/GlassCard'

type FilterTab = 'all' | 'follow-up' | 'stable' | 'blocked'

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'follow-up', label: 'Suivi requis' },
  { key: 'stable', label: 'Stable' },
  { key: 'blocked', label: 'Bloqués' },
]

const AVATAR_COLORS = ['#82d8ff', '#705d00', '#1d7a3a', '#5c5f61', '#ba1a1a']

function PatientCard({
  patient,
  noShowCount,
  isBlocked,
  onBlock,
  onUnblock,
  onDossier,
  onMessage,
}: {
  patient: PatientItem
  noShowCount: number
  isBlocked: boolean
  onBlock: () => void
  onUnblock: () => void
  onDossier: () => void
  onMessage: () => void
}) {
  const colorIndex = patient.shortId.charCodeAt(patient.shortId.length - 1) % AVATAR_COLORS.length
  const avatarColor = AVATAR_COLORS[colorIndex]

  return (
    <GlassCard style={{ gap: 12 }}>
      {/* Header row */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: avatarColor,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontFamily: 'Manrope', fontWeight: '700', fontSize: 16, color: '#fff' }}>
              {patient.patientInitials}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: 16, fontWeight: '700', color: '#0b1c30' }}>
              {patient.patientName}
            </Text>
            <Text style={{ fontFamily: 'Manrope', fontSize: 12, color: '#6f787e', marginTop: 1 }}>
              ID: {patient.shortId}
            </Text>
          </View>
        </View>
        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 999,
            backgroundColor: patient.status === 'follow-up' ? '#ffdad6' : '#d1fae5',
          }}
        >
          <Text
            style={{
              fontFamily: 'Manrope',
              fontSize: 11,
              fontWeight: '700',
              color: patient.status === 'follow-up' ? '#ba1a1a' : '#1d7a3a',
            }}
          >
            {patient.status === 'follow-up' ? 'Suivi requis' : 'Stable'}
          </Text>
        </View>
      </View>

      {/* No-show warning */}
      {noShowCount > 0 && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 10,
            backgroundColor: '#ffdad6',
          }}
        >
          <MaterialIcons name="warning" size={14} color="#ba1a1a" />
          <Text style={{ fontFamily: 'Manrope', fontSize: 12, fontWeight: '600', color: '#ba1a1a', flex: 1 }}>
            {noShowCount} absence{noShowCount > 1 ? 's' : ''} non justifiée{noShowCount > 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {/* Last consultation */}
      {patient.lastConsultDate && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: 12,
            backgroundColor: '#eff4ff',
          }}
        >
          <MaterialIcons name="event" size={15} color="#82d8ff" style={{ marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: 12, color: '#6f787e' }}>
              Dernière consultation :{' '}
              {new Date(patient.lastConsultDate).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </Text>
            {patient.lastConsultNotes ? (
              <Text
                style={{ fontFamily: 'Manrope', fontSize: 12, color: '#3f484d', marginTop: 2 }}
                numberOfLines={2}
              >
                {patient.lastConsultNotes}
              </Text>
            ) : null}
          </View>
        </View>
      )}

      {/* Actions */}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <TouchableOpacity
          onPress={onDossier}
          style={{
            flex: 1,
            paddingVertical: 10,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: '#bec8ce',
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 6,
            backgroundColor: 'rgba(255,255,255,0.60)',
          }}
        >
          <MaterialIcons name="folder" size={15} color="#0b1c30" />
          <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '600', color: '#0b1c30' }}>
            Dossier
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onMessage}
          style={{
            flex: 1,
            paddingVertical: 10,
            borderRadius: 999,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 6,
            backgroundColor: '#82d8ff',
          }}
        >
          <MaterialIcons name="chat-bubble" size={15} color="#0b1c30" />
          <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '800', color: '#0b1c30' }}>
            Message
          </Text>
        </TouchableOpacity>
      </View>

      {/* Block / Unblock */}
      {isBlocked ? (
        <TouchableOpacity
          onPress={onUnblock}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: 9,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: '#82d8ff',
            backgroundColor: 'rgba(0,102,133,0.06)',
          }}
        >
          <MaterialIcons name="lock-open" size={14} color="#82d8ff" />
          <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '600', color: '#82d8ff' }}>
            Débloquer ce patient
          </Text>
        </TouchableOpacity>
      ) : noShowCount > 0 ? (
        <TouchableOpacity
          onPress={onBlock}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: 9,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: '#ba1a1a',
            backgroundColor: 'rgba(186,26,26,0.05)',
          }}
        >
          <MaterialIcons name="block" size={14} color="#ba1a1a" />
          <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '600', color: '#ba1a1a' }}>
            Bloquer ce patient
          </Text>
        </TouchableOpacity>
      ) : null}
    </GlassCard>
  )
}

function BlockedCard({ block, onUnblock }: { block: PatientBlock; onUnblock: () => void }) {
  const name = block.patient?.full_name ?? 'Patient inconnu'
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <GlassCard style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: '#ba1a1a',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontFamily: 'Manrope', fontWeight: '700', fontSize: 16, color: '#fff' }}>
            {initials}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: '700', color: '#0b1c30' }}>
            {name}
          </Text>
          {block.cooldown_until ? (
            <Text style={{ fontFamily: 'Manrope', fontSize: 12, color: '#6f787e', marginTop: 1 }}>
              Jusqu'au{' '}
              {new Date(block.cooldown_until).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </Text>
          ) : (
            <Text style={{ fontFamily: 'Manrope', fontSize: 12, color: '#ba1a1a', marginTop: 1 }}>
              Blocage permanent
            </Text>
          )}
        </View>
        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 999,
            backgroundColor: '#ffdad6',
          }}
        >
          <Text style={{ fontFamily: 'Manrope', fontSize: 11, fontWeight: '700', color: '#ba1a1a' }}>
            Bloqué
          </Text>
        </View>
      </View>

      {block.reason ? (
        <Text style={{ fontFamily: 'Manrope', fontSize: 12, color: '#3f484d', fontStyle: 'italic' }}>
          « {block.reason} »
        </Text>
      ) : null}

      <TouchableOpacity
        onPress={onUnblock}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          paddingVertical: 9,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: '#82d8ff',
          backgroundColor: 'rgba(0,102,133,0.06)',
        }}
      >
        <MaterialIcons name="lock-open" size={14} color="#82d8ff" />
        <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '600', color: '#82d8ff' }}>
          Débloquer
        </Text>
      </TouchableOpacity>
    </GlassCard>
  )
}

export default function PatientsScreen() {
  const router = useRouter()
  const { practitioner } = useAuth()
  const { data: patients, isLoading, isError, refetch, isRefetching } = usePatients(practitioner?.id ?? '')
  const { noShowPatients, blocks, blockPatient, unblockPatient } = usePatientBlocks()
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<FilterTab>('all')

  const noShowMap = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    for (const p of noShowPatients.data ?? []) map[p.patient.id] = p.count
    return map
  }, [noShowPatients.data])

  const blockedIds = useMemo<Set<string>>(() => {
    return new Set((blocks.data ?? []).map((b) => b.patient_id))
  }, [blocks.data])

  const filtered = useMemo(() => {
    if (activeTab === 'blocked') return []
    let list = patients ?? []
    if (activeTab !== 'all') list = list.filter((p) => p.status === activeTab)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (p) => p.patientName.toLowerCase().includes(q) || p.shortId.toLowerCase().includes(q),
      )
    }
    return list
  }, [patients, activeTab, search])

  const handleBlock = (patientId: string, patientName: string) => {
    Alert.alert(
      `Bloquer ${patientName}`,
      'Choisissez la durée du blocage. Le patient ne pourra plus réserver de séance pendant cette période.',
      [
        {
          text: '7 jours',
          onPress: () => blockPatient.mutate({ patientId, cooldownDays: 7, reason: 'Absences répétées' }),
        },
        {
          text: '30 jours',
          onPress: () => blockPatient.mutate({ patientId, cooldownDays: 30, reason: 'Absences répétées' }),
        },
        {
          text: 'Permanent',
          style: 'destructive',
          onPress: () => blockPatient.mutate({ patientId, cooldownDays: null, reason: 'Absences répétées' }),
        },
        { text: 'Annuler', style: 'cancel' },
      ],
    )
  }

  const handleUnblock = (patientId: string, patientName: string) => {
    Alert.alert(
      `Débloquer ${patientName}`,
      'Ce patient pourra à nouveau réserver des séances.',
      [
        { text: 'Débloquer', onPress: () => unblockPatient.mutate(patientId) },
        { text: 'Annuler', style: 'cancel' },
      ],
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View
        style={{
          paddingHorizontal: 24,
          paddingTop: 16,
          paddingBottom: 12,
          backgroundColor: 'rgba(255,255,255,0.70)',
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.20)',
          gap: 12,
        }}
      >
        <Text style={{ fontFamily: 'Manrope', fontSize: 22, fontWeight: '700', color: '#0b1c30' }}>
          Patients
        </Text>

        {/* Search bar */}
        {activeTab !== 'blocked' && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: 'rgba(190,200,206,0.60)',
              backgroundColor: 'rgba(255,255,255,0.70)',
            }}
          >
            <MaterialIcons name="search" size={18} color="#6f787e" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Rechercher un patient..."
              placeholderTextColor="#6f787e"
              style={{ flex: 1, fontFamily: 'Manrope', fontSize: 14, color: '#0b1c30' }}
            />
          </View>
        )}

        {/* Filter tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 999,
                borderWidth: 1,
                backgroundColor: activeTab === tab.key ? '#82d8ff' : 'rgba(255,255,255,0.60)',
                borderColor: activeTab === tab.key ? '#82d8ff' : 'rgba(190,200,206,0.50)',
              }}
            >
              <Text
                style={{
                  fontFamily: 'Manrope',
                  fontSize: 13,
                  fontWeight: '600',
                  color: activeTab === tab.key ? '#fff' : '#3f484d',
                }}
              >
                {tab.label}
                {tab.key === 'blocked' && (blocks.data?.length ?? 0) > 0
                  ? ` (${blocks.data!.length})`
                  : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 24, gap: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      >
        {isError ? (
          <View style={{ paddingVertical: 64, alignItems: 'center', gap: 12 }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: 16, fontWeight: '600', color: '#6f787e' }}>
              Une erreur est survenue
            </Text>
            <TouchableOpacity
              onPress={() => refetch()}
              style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999, backgroundColor: '#82d8ff' }}
            >
              <Text style={{ fontFamily: 'Manrope', fontSize: 14, fontWeight: '700', color: '#0b1c30' }}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        ) : activeTab === 'blocked' ? (
          (blocks.data ?? []).length === 0 ? (
            <View style={{ paddingVertical: 64, alignItems: 'center' }}>
              <Text style={{ fontFamily: 'Manrope', fontSize: 16, fontWeight: '600', color: '#6f787e' }}>
                Aucun patient bloqué
              </Text>
            </View>
          ) : (
            (blocks.data ?? []).map((block) => (
              <BlockedCard
                key={block.id}
                block={block}
                onUnblock={() =>
                  handleUnblock(block.patient_id, block.patient?.full_name ?? 'ce patient')
                }
              />
            ))
          )
        ) : isLoading ? (
          [1, 2, 3].map((i) => (
            <View
              key={i}
              style={{ height: 176, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.40)' }}
            />
          ))
        ) : filtered.length === 0 ? (
          <View style={{ paddingVertical: 64, alignItems: 'center' }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: 16, fontWeight: '600', color: '#6f787e' }}>
              Aucun patient trouvé
            </Text>
          </View>
        ) : (
          filtered.map((patient) => (
            <PatientCard
              key={patient.patientId}
              patient={patient}
              noShowCount={noShowMap[patient.patientId] ?? 0}
              isBlocked={blockedIds.has(patient.patientId)}
              onBlock={() => handleBlock(patient.patientId, patient.patientName)}
              onUnblock={() => handleUnblock(patient.patientId, patient.patientName)}
              onDossier={() => router.push({ pathname: '/(practitioner)/patient-notes/[patientId]', params: { patientId: patient.patientId, patientName: patient.patientName } })}
              onMessage={() => router.push({ pathname: '/(practitioner)/messages/[id]', params: { id: patient.patientId, name: patient.patientName } })}
            />
          ))
        )}
        <View style={{ height: 16 }} />
      </ScrollView>
    </SafeAreaView>
  )
}
