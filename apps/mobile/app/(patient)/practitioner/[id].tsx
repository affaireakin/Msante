import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
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
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#006685" size="large" />
      </SafeAreaView>
    )
  }

  if (!practitioner) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <Text className="text-error font-manrope">Praticien introuvable</Text>
      </SafeAreaView>
    )
  }

  const name = practitioner.users?.full_name ?? 'Praticien'

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View className="px-6 pt-4 pb-6">
          <TouchableOpacity onPress={() => router.back()} className="mb-4">
            <Text className="text-primary font-manrope font-medium">← Retour</Text>
          </TouchableOpacity>

          <View className="items-center gap-4">
            <View className="w-24 h-24 rounded-2xl bg-primary-container items-center justify-center">
              <Text className="text-primary font-manrope font-bold text-3xl">{getInitials(name)}</Text>
            </View>
            <View className="items-center gap-1">
              <Text className="text-2xl font-bold text-on-surface font-manrope">{name}</Text>
              <Text className="text-base text-on-surface-variant font-manrope">{practitioner.speciality}</Text>
              {practitioner.rating != null && (
                <RatingStars rating={practitioner.rating} total={practitioner.total_reviews} />
              )}
            </View>
          </View>
        </View>

        <View className="px-6 gap-4">
          {practitioner.bio && (
            <View className="bg-white/60 rounded-xl p-4 border border-white/80">
              <Text className="text-sm font-bold text-on-surface font-manrope mb-2 uppercase tracking-wide">
                À propos
              </Text>
              <Text className="text-sm text-on-surface-variant font-manrope leading-relaxed">
                {practitioner.bio}
              </Text>
            </View>
          )}

          <View className="bg-white/60 rounded-xl p-4 border border-white/80 gap-3">
            <Text className="text-sm font-bold text-on-surface font-manrope uppercase tracking-wide">
              Informations
            </Text>
            <View className="flex-row justify-between">
              <Text className="text-sm text-on-surface-variant font-manrope">Tarif</Text>
              <Text className="text-sm font-semibold text-primary font-manrope">
                {practitioner.session_price?.toLocaleString()} {practitioner.session_currency}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-sm text-on-surface-variant font-manrope">Durée</Text>
              <Text className="text-sm font-semibold text-on-surface font-manrope">
                {practitioner.session_duration_min} min
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-sm text-on-surface-variant font-manrope">Langues</Text>
              <Text className="text-sm font-semibold text-on-surface font-manrope">
                {practitioner.languages.join(', ')}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 px-6 pb-8 pt-4 bg-background/90">
        <PrimaryButton
          label="Réserver une séance"
          onPress={() => router.push(`/(patient)/booking/${id}`)}
        />
      </View>
    </SafeAreaView>
  )
}
