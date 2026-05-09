import { useEffect } from 'react'
import { View, Text, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff', alignItems: 'center', justifyContent: 'center', gap: 24, paddingHorizontal: 24 }}>
      <View style={{ width: 80, height: 80, backgroundColor: '#82d8ff', borderRadius: 40, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#006685" size="large" />
      </View>
      <View style={{ alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#0b1c30', fontFamily: 'Manrope' }}>
          Traitement en cours
        </Text>
        <Text style={{ fontSize: 14, color: '#3f484d', fontFamily: 'Manrope', textAlign: 'center' }}>
          {PROVIDER_LABELS[provider ?? 'simulated']} — veuillez patienter...
        </Text>
      </View>
    </SafeAreaView>
  )
}
