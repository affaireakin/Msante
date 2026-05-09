import { useState } from 'react'
import { View, Text, FlatList, TextInput, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { usePractitioners } from '@/features/practitioners/hooks/usePractitioners'
import { PractitionerCard } from '@/features/practitioners/components/PractitionerCard'
import { FilterBar } from '@/features/practitioners/components/FilterBar'
import { useBookingStore } from '@/features/booking/store/bookingStore'

export default function FindPractitionersScreen() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [speciality, setSpeciality] = useState<string | null>(null)
  const [language, setLanguage] = useState<string | null>(null)

  const { data: practitioners, isLoading, error } = usePractitioners({
    speciality: speciality ?? undefined,
    language: language ?? undefined,
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
      <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16, gap: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#0b1c30', fontFamily: 'Manrope' }}>
          Trouver un praticien
        </Text>

        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: 'rgba(255,255,255,0.6)',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.8)',
          paddingHorizontal: 16,
          gap: 8,
        }}>
          <MaterialIcons name="search" size={20} color="#6f787e" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Nom, spécialité..."
            style={{ flex: 1, paddingVertical: 12, fontSize: 16, fontFamily: 'Manrope', color: '#0b1c30' }}
            placeholderTextColor="#6f787e"
          />
        </View>

        <FilterBar
          activeSpeciality={speciality}
          activeLanguage={language}
          onSpecialityChange={setSpeciality}
          onLanguageChange={setLanguage}
        />
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#006685" size="large" />
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <Text style={{ color: '#ba1a1a', fontFamily: 'Manrope', textAlign: 'center' }}>
            Impossible de charger les praticiens
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 24, gap: 12 }}
          renderItem={({ item }) => (
            <PractitionerCard practitioner={item} onPress={() => handleSelect(item)} />
          )}
          ListEmptyComponent={
            <View style={{ paddingVertical: 48, alignItems: 'center' }}>
              <Text style={{ color: '#3f484d', fontFamily: 'Manrope' }}>
                Aucun praticien trouvé
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}
