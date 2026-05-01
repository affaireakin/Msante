import { useEffect } from 'react'
import { View, Text, ActivityIndicator, SafeAreaView, Alert } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { usePayment } from '@/features/booking/hooks/usePayment'
import type { PaymentProvider } from '@/types/booking'

const PROVIDER_LABELS: Record<string, string> = {
  wave: 'Wave',
  orange_money: 'Orange Money',
  card: 'Carte bancaire',
  simulated: 'Paiement',
}

export default function PaymentProcessingScreen() {
  const { appointmentId, provider, phone } = useLocalSearchParams<{
    appointmentId: string
    provider: string
    phone?: string
  }>()
  const router = useRouter()
  const processPayment = usePayment()

  useEffect(() => {
    const run = async () => {
      try {
        await processPayment.mutateAsync({
          appointment_id: appointmentId,
          provider: provider as PaymentProvider,
          phone: phone || undefined,
        })
        router.replace('/(patient)/booking-success')
      } catch (e) {
        Alert.alert(
          'Paiement échoué',
          e instanceof Error ? e.message : 'Une erreur est survenue',
          [{ text: 'Retour', onPress: () => router.back() }]
        )
      }
    }
    run()
  }, [])

  return (
    <SafeAreaView className="flex-1 bg-background items-center justify-center gap-6 px-6">
      <View className="w-20 h-20 bg-primary-container rounded-full items-center justify-center">
        <ActivityIndicator color="#006685" size="large" />
      </View>
      <View className="items-center gap-2">
        <Text className="text-xl font-bold text-on-surface font-manrope">
          Traitement en cours
        </Text>
        <Text className="text-sm text-on-surface-variant font-manrope text-center">
          {PROVIDER_LABELS[provider ?? 'simulated']} — veuillez patienter...
        </Text>
      </View>
    </SafeAreaView>
  )
}
