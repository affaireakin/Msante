import { useState } from 'react'
import { View, Text, FlatList, TextInput, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { usePractitioners } from '@/features/practitioners/hooks/usePractitioners'
import { PractitionerCard } from '@/features/practitioners/components/PractitionerCard'
import { FilterBar } from '@/features/practitioners/components/FilterBar'
import { useBookingStore } from '@/features/booking/store/bookingStore'
import { useResponsive } from '@/hooks/useResponsive'

export default function FindPractitionersScreen() {
  const router = useRouter()
  const { px, fs, scale } = useResponsive()
  const [search, setSearch] = useState('')
  const [speciality, setSpeciality] = useState<string | null>(null)
  const [language, setLanguage] = useState<string | null>(null)
  const [acceptingNewOnly, setAcceptingNewOnly] = useState(false)

  const { data: practitioners, isLoading, error, refetch, isRefetching } = usePractitioners({
    speciality: speciality ?? undefined,
    language: language ?? undefined,
    acceptingNewPatients: acceptingNewOnly || undefined,
  })

  const { setPractitioner } = useBookingStore()

  const filtered = practitioners?.filter(p =>
    !search ||
    p.users?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.speciality.toLowerCase().includes(search.toLowerCase())
  ) ?? []

  const handleSelect = (p: typeof filtered[0]) => {
    setPractitioner(p.id, p.users?.full_name ?? 'Praticien')
    router.push(`/(patient)/practitioner/${p.id}`)
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      {/* Header */}
      <View style={{ paddingHorizontal: px, paddingTop: scale(20), paddingBottom: scale(16), gap: scale(14) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ fontSize: fs.xxl, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope', letterSpacing: -0.5 }}>
              Praticiens
            </Text>
            <Text style={{ fontSize: fs.sm, color: '#6f787e', fontFamily: 'Manrope', marginTop: 2 }}>
              500+ experts certifiés au Sénégal
            </Text>
          </View>
          <View style={{ backgroundColor: '#e5eeff', borderRadius: scale(12), paddingHorizontal: scale(12), paddingVertical: scale(6), flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <MaterialIcons name="verified" size={scale(14)} color="#82d8ff" />
            <Text style={{ fontSize: fs.xs, fontWeight: '700', color: '#82d8ff', fontFamily: 'Manrope' }}>Vérifiés</Text>
          </View>
        </View>

        {/* Search bar */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: 'rgba(255,255,255,0.85)',
          borderRadius: scale(14),
          borderWidth: 1,
          borderColor: '#e5eeff',
          paddingHorizontal: scale(14),
          gap: scale(8),
          shadowColor: '#82d8ff',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.04,
          shadowRadius: 8,
          elevation: 1,
        }}>
          <MaterialIcons name="search" size={scale(20)} color="#6f787e" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Nom, spécialité..."
            style={{ flex: 1, paddingVertical: scale(12), fontSize: fs.md, fontFamily: 'Manrope', color: '#0b1c30' }}
            placeholderTextColor="#bec8ce"
          />
          {search.length > 0 && (
            <MaterialIcons name="close" size={scale(16)} color="#6f787e" onPress={() => setSearch('')} />
          )}
        </View>

        <FilterBar
          activeSpeciality={speciality}
          activeLanguage={language}
          onSpecialityChange={setSpeciality}
          onLanguageChange={setLanguage}
        />
        {/* Toggle accepte nouveaux patients */}
        <TouchableOpacity
          onPress={() => setAcceptingNewOnly(v => !v)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: scale(8), paddingVertical: scale(4) }}
        >
          <View style={{
            width: scale(40), height: scale(22), borderRadius: scale(11),
            backgroundColor: acceptingNewOnly ? '#82d8ff' : '#bec8ce',
            justifyContent: 'center', paddingHorizontal: 2,
          }}>
            <View style={{
              width: scale(18), height: scale(18), borderRadius: scale(9),
              backgroundColor: '#fff',
              transform: [{ translateX: acceptingNewOnly ? scale(18) : 0 }],
            }} />
          </View>
          <Text style={{ fontSize: fs.sm, color: '#3f484d', fontFamily: 'Manrope', fontWeight: '600' }}>
            Accepte de nouveaux patients
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: scale(12) }}>
          <ActivityIndicator color="#82d8ff" size="large" />
          <Text style={{ fontSize: fs.sm, color: '#6f787e', fontFamily: 'Manrope' }}>Chargement des praticiens…</Text>
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: px }}>
          <View style={{ width: scale(64), height: scale(64), borderRadius: scale(32), backgroundColor: '#fce4ec', alignItems: 'center', justifyContent: 'center', marginBottom: scale(12) }}>
            <MaterialIcons name="wifi-off" size={scale(30)} color="#ba1a1a" />
          </View>
          <Text style={{ color: '#ba1a1a', fontFamily: 'Manrope', textAlign: 'center', fontSize: fs.md, fontWeight: '600' }}>
            Impossible de charger les praticiens
          </Text>
          <Text style={{ color: '#6f787e', fontFamily: 'Manrope', textAlign: 'center', fontSize: fs.sm, marginTop: 6 }}>
            Vérifiez votre connexion et réessayez.
          </Text>
          <TouchableOpacity onPress={() => refetch()} style={{ marginTop: scale(16), paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999, backgroundColor: '#82d8ff' }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: 14, fontWeight: '700', color: '#0b1c30' }}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingHorizontal: px, paddingBottom: 100, gap: scale(12), paddingTop: scale(4) }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          renderItem={({ item }) => (
            <PractitionerCard practitioner={item} onPress={() => handleSelect(item)} />
          )}
          ListHeaderComponent={
            filtered.length > 0 ? (
              <Text style={{ fontSize: fs.xs, fontWeight: '700', color: '#6f787e', letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'Manrope', marginBottom: scale(4) }}>
                {filtered.length} praticien{filtered.length > 1 ? 's' : ''} trouvé{filtered.length > 1 ? 's' : ''}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <View style={{ paddingVertical: scale(48), alignItems: 'center', gap: scale(12) }}>
              <View style={{ width: scale(72), height: scale(72), borderRadius: scale(36), backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcons name="search-off" size={scale(34)} color="#82d8ff" />
              </View>
              <Text style={{ fontSize: fs.lg, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope' }}>
                Aucun résultat
              </Text>
              <Text style={{ color: '#6f787e', fontFamily: 'Manrope', fontSize: fs.sm, textAlign: 'center' }}>
                Essayez d'autres mots-clés ou filtres
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}
