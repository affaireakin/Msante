import { useState, useMemo } from 'react'
import { ScrollView, View, Text, TouchableOpacity, TextInput, StatusBar } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { usePatients, type PatientItem } from '@/features/practitioner/hooks/usePatients'
import { GlassCard } from '@/components/ui/GlassCard'

type FilterTab = 'all' | 'follow-up' | 'stable'

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All Patients' },
  { key: 'follow-up', label: 'Requires Follow-up' },
  { key: 'stable', label: 'Stable' },
]

const AVATAR_COLORS = ['#006685', '#705d00', '#1d7a3a', '#5c5f61', '#ba1a1a']

function PatientCard({ patient }: { patient: PatientItem }) {
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
            <Text
              style={{ fontFamily: 'Manrope', fontWeight: '700', fontSize: 16, color: '#fff' }}
            >
              {patient.patientInitials}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: 'Manrope',
                fontSize: 16,
                fontWeight: '700',
                color: '#0b1c30',
              }}
            >
              {patient.patientName}
            </Text>
            <Text
              style={{ fontFamily: 'Manrope', fontSize: 12, color: '#6f787e', marginTop: 1 }}
            >
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
            {patient.status === 'follow-up' ? 'Follow-up' : 'Stable'}
          </Text>
        </View>
      </View>

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
          <Text style={{ fontSize: 14, marginTop: 1 }}>📅</Text>
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
                style={{
                  fontFamily: 'Manrope',
                  fontSize: 12,
                  color: '#3f484d',
                  marginTop: 2,
                }}
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
          <Text style={{ fontSize: 13 }}>📁</Text>
          <Text
            style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '600', color: '#0b1c30' }}
          >
            Records
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{
            flex: 1,
            paddingVertical: 10,
            borderRadius: 999,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 6,
            backgroundColor: '#006685',
          }}
        >
          <Text style={{ fontSize: 13 }}>💬</Text>
          <Text
            style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '600', color: '#fff' }}
          >
            Message
          </Text>
        </TouchableOpacity>
      </View>
    </GlassCard>
  )
}

export default function PatientsScreen() {
  const { practitioner } = useAuth()
  const { data: patients, isLoading } = usePatients(practitioner?.id ?? '')
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<FilterTab>('all')

  const filtered = useMemo(() => {
    let list = patients ?? []
    if (activeTab !== 'all') list = list.filter((p) => p.status === activeTab)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (p) =>
          p.patientName.toLowerCase().includes(q) || p.shortId.toLowerCase().includes(q),
      )
    }
    return list
  }, [patients, activeTab, search])

  return (
    <SafeAreaView className="flex-1 bg-[#f8f9ff]" edges={['top']}>
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
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text
            style={{ fontFamily: 'Manrope', fontSize: 22, fontWeight: '700', color: '#0b1c30' }}
          >
            M-Santé
          </Text>
          <TouchableOpacity
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: 'rgba(255,255,255,0.60)',
              borderWidth: 1,
              borderColor: 'rgba(190,200,206,0.50)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 16 }}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Search bar */}
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
          <Text style={{ fontSize: 16 }}>🔍</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search patients, IDs..."
            placeholderTextColor="#6f787e"
            style={{ flex: 1, fontFamily: 'Manrope', fontSize: 14, color: '#0b1c30' }}
          />
        </View>

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
                backgroundColor: activeTab === tab.key ? '#006685' : 'rgba(255,255,255,0.60)',
                borderColor: activeTab === tab.key ? '#006685' : 'rgba(190,200,206,0.50)',
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
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 24, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          [1, 2, 3].map((i) => (
            <View
              key={i}
              style={{ height: 176, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.40)' }}
            />
          ))
        ) : filtered.length === 0 ? (
          <View style={{ paddingVertical: 64, alignItems: 'center' }}>
            <Text
              style={{
                fontFamily: 'Manrope',
                fontSize: 16,
                fontWeight: '600',
                color: '#6f787e',
              }}
            >
              Aucun patient trouvé
            </Text>
          </View>
        ) : (
          filtered.map((patient) => (
            <PatientCard key={patient.patientId} patient={patient} />
          ))
        )}
        <View style={{ height: 16 }} />
      </ScrollView>
    </SafeAreaView>
  )
}
