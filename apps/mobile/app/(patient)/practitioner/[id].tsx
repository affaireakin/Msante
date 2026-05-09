import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { usePractitioner } from '@/features/practitioners/hooks/usePractitioner'
import { RatingStars } from '@/features/practitioners/components/RatingStars'
import { PrimaryButton } from '@/components/ui'

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

export default function PractitionerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { data: practitioner, isLoading } = usePractitioner(id)

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#006685" size="large" />
      </SafeAreaView>
    )
  }

  if (!practitioner) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#ba1a1a', fontFamily: 'Manrope' }}>Praticien introuvable</Text>
      </SafeAreaView>
    )
  }

  const name = practitioner.users?.full_name ?? 'Praticien'

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <MaterialIcons name="arrow-back" size={20} color="#006685" />
            <Text style={{ color: '#006685', fontFamily: 'Manrope', fontWeight: '500' }}>Retour</Text>
          </TouchableOpacity>

          <View style={{ alignItems: 'center', gap: 16 }}>
            <View style={{ width: 96, height: 96, borderRadius: 16, backgroundColor: '#82d8ff', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#006685', fontFamily: 'Manrope', fontWeight: 'bold', fontSize: 28 }}>{getInitials(name)}</Text>
            </View>
            <View style={{ alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#0b1c30', fontFamily: 'Manrope' }}>{name}</Text>
              <Text style={{ fontSize: 16, color: '#3f484d', fontFamily: 'Manrope' }}>{practitioner.speciality}</Text>
              {practitioner.rating != null && (
                <RatingStars rating={practitioner.rating} total={practitioner.total_reviews} />
              )}
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: 24, gap: 16 }}>
          {practitioner.bio && (
            <View style={{ backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)' }}>
              <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#0b1c30', fontFamily: 'Manrope', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                À propos
              </Text>
              <Text style={{ fontSize: 14, color: '#3f484d', fontFamily: 'Manrope', lineHeight: 22 }}>
                {practitioner.bio}
              </Text>
            </View>
          )}

          <View style={{ backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)', gap: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#0b1c30', fontFamily: 'Manrope', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Informations
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 14, color: '#3f484d', fontFamily: 'Manrope' }}>Tarif</Text>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#006685', fontFamily: 'Manrope' }}>
                {practitioner.session_price?.toLocaleString()} {practitioner.session_currency}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 14, color: '#3f484d', fontFamily: 'Manrope' }}>Durée</Text>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#0b1c30', fontFamily: 'Manrope' }}>
                {practitioner.session_duration_min} min
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 14, color: '#3f484d', fontFamily: 'Manrope' }}>Langues</Text>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#0b1c30', fontFamily: 'Manrope' }}>
                {practitioner.languages.join(', ')}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24, paddingBottom: 32, paddingTop: 16, backgroundColor: 'rgba(248,249,255,0.9)' }}>
        <PrimaryButton
          label="Réserver une séance"
          onPress={() => router.push(`/(patient)/booking/${id}`)}
        />
      </View>
    </SafeAreaView>
  )
}
