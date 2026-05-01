import { useState } from 'react'
import { View, Text, FlatList, TextInput, SafeAreaView, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
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
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-6 pt-6 pb-4 gap-4">
        <Text className="text-2xl font-bold text-on-surface font-manrope">
          Trouver un praticien
        </Text>

        <View className="flex-row items-center bg-white/60 rounded-xl border border-white/80 px-4 gap-2">
          <Text className="text-outline">🔍</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Nom, spécialité..."
            className="flex-1 py-3 text-base font-manrope text-on-surface"
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
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#006685" size="large" />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-error font-manrope text-center">
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
            <View className="py-12 items-center">
              <Text className="text-on-surface-variant font-manrope">
                Aucun praticien trouvé
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}
