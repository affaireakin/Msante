import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { PrimaryButton } from '@/components/ui'

type PractitionerType = 'healthcare' | 'wellness' | null

function useSpecialities(category: 'healthcare' | 'wellness' | null) {
  return useQuery<string[]>({
    queryKey: ['signup-specialities', category],
    enabled: !!category,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profession_permissions')
        .select('profession_label')
        .eq('category', category!)
        .order('sort_order')
      if (error) throw error
      return (data ?? []).map(r => r.profession_label)
    },
    staleTime: 5 * 60_000,
  })
}

export default function PractitionerTypeScreen() {
  const router = useRouter()
  const [selectedType, setSelectedType] = useState<PractitionerType>(null)
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null)

  const { data: specialties = [], isLoading } = useSpecialities(selectedType)

  const canContinue = selectedType !== null && selectedSpecialty !== null

  const handleContinue = () => {
    router.push({
      pathname: '/(auth)/signup-practitioner',
      params: { practitionerType: selectedType!, speciality: selectedSpecialty! },
    } as never)
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ marginTop: 40, marginBottom: 32 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20, alignSelf: 'flex-start' }}
          >
            <MaterialIcons name="arrow-back" size={20} color="#82d8ff" />
            <Text style={{ fontSize: 14, color: '#82d8ff', fontFamily: 'Manrope', fontWeight: '600' }}>Retour</Text>
          </TouchableOpacity>

          <Text style={{ fontSize: 26, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope', letterSpacing: -0.5, marginBottom: 6 }}>
            Votre profil professionnel
          </Text>
          <Text style={{ fontSize: 14, color: '#6f787e', fontFamily: 'Manrope', lineHeight: 22 }}>
            Aidez-nous à configurer votre espace en choisissant votre catégorie et votre spécialité.
          </Text>
        </View>

        {/* Step 1 — Type */}
        <Text style={{ fontSize: 13, fontWeight: '700', color: '#3f484d', fontFamily: 'Manrope', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          1. Catégorie
        </Text>

        <View style={{ gap: 12, marginBottom: 28 }}>
          {/* Healthcare */}
          <TouchableOpacity
            onPress={() => { setSelectedType('healthcare'); setSelectedSpecialty(null) }}
            activeOpacity={0.85}
            style={{
              borderRadius: 16, borderWidth: 2,
              borderColor: selectedType === 'healthcare' ? '#82d8ff' : '#e5eeff',
              backgroundColor: selectedType === 'healthcare' ? '#e5eeff' : '#fff',
              padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14,
            }}
          >
            <View style={{
              width: 48, height: 48, borderRadius: 14,
              backgroundColor: selectedType === 'healthcare' ? '#82d8ff' : '#f0f7ff',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <MaterialIcons name="local-hospital" size={24} color={selectedType === 'healthcare' ? '#fff' : '#82d8ff'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope', marginBottom: 2 }}>
                Professionnels de santé
              </Text>
              <Text style={{ fontSize: 12, color: '#6f787e', fontFamily: 'Manrope', lineHeight: 17 }}>
                Psychiatre, psychologue, médecin…
              </Text>
            </View>
            {selectedType === 'healthcare' && (
              <MaterialIcons name="check-circle" size={22} color="#82d8ff" />
            )}
          </TouchableOpacity>

          {/* Wellness */}
          <TouchableOpacity
            onPress={() => { setSelectedType('wellness'); setSelectedSpecialty(null) }}
            activeOpacity={0.85}
            style={{
              borderRadius: 16, borderWidth: 2,
              borderColor: selectedType === 'wellness' ? '#705d00' : '#e5eeff',
              backgroundColor: selectedType === 'wellness' ? '#fff8e1' : '#fff',
              padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14,
            }}
          >
            <View style={{
              width: 48, height: 48, borderRadius: 14,
              backgroundColor: selectedType === 'wellness' ? '#705d00' : '#fffbf0',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <MaterialIcons name="self-improvement" size={24} color={selectedType === 'wellness' ? '#fff' : '#705d00'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope', marginBottom: 2 }}>
                Praticiens bien-être
              </Text>
              <Text style={{ fontSize: 12, color: '#6f787e', fontFamily: 'Manrope', lineHeight: 17 }}>
                Coach, coach de vie, développement personnel…
              </Text>
            </View>
            {selectedType === 'wellness' && (
              <MaterialIcons name="check-circle" size={22} color="#705d00" />
            )}
          </TouchableOpacity>
        </View>

        {/* Step 2 — Specialty */}
        {selectedType && (
          <>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#3f484d', fontFamily: 'Manrope', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              2. Spécialité
            </Text>
            {isLoading ? (
              <ActivityIndicator color="#82d8ff" style={{ marginBottom: 32 }} />
            ) : (
              <View style={{ gap: 8, marginBottom: 32 }}>
                {specialties.map(spec => {
                  const isSelected = selectedSpecialty === spec
                  const accent = selectedType === 'healthcare' ? '#82d8ff' : '#705d00'
                  const bgSelected = selectedType === 'healthcare' ? '#e5eeff' : '#fff8e1'
                  return (
                    <TouchableOpacity
                      key={spec}
                      onPress={() => setSelectedSpecialty(spec)}
                      activeOpacity={0.75}
                      style={{
                        borderRadius: 12, borderWidth: 1.5,
                        borderColor: isSelected ? accent : '#e5eeff',
                        backgroundColor: isSelected ? bgSelected : '#fff',
                        paddingHorizontal: 16, paddingVertical: 13,
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                      }}
                    >
                      <Text style={{ fontSize: 14, fontFamily: 'Manrope', fontWeight: isSelected ? '700' : '500', color: isSelected ? accent : '#0b1c30' }}>
                        {spec}
                      </Text>
                      {isSelected && <MaterialIcons name="check" size={18} color={accent} />}
                    </TouchableOpacity>
                  )
                })}
              </View>
            )}
          </>
        )}

        <PrimaryButton
          label="Continuer"
          onPress={handleContinue}
          disabled={!canContinue}
        />
      </ScrollView>
    </SafeAreaView>
  )
}
