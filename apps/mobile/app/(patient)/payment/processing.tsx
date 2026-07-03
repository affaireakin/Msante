import { useEffect, useRef, useState } from 'react'
import { View, Text, ActivityIndicator, Alert, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { supabase } from '@/services/supabase'
import { usePayment } from '@/features/booking/hooks/usePayment'
import type { PaymentProvider } from '@/types/booking'

type Stage = 'initiating' | 'redirect' | 'verifying' | 'failed'

const VALID_PROVIDERS: PaymentProvider[] = ['wave', 'orange_money', 'card']

const PROVIDER_LABELS: Record<PaymentProvider, string> = {
  wave: 'Wave',
  orange_money: 'Orange Money',
  card: 'Carte bancaire',
}

export default function PaymentProcessingScreen() {
  const { appointmentId, provider, phone } = useLocalSearchParams<{
    appointmentId: string
    provider: string
    phone: string
  }>()
  const router = useRouter()
  const processPayment = usePayment()

  const [stage, setStage] = useState<Stage>('initiating')
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null)
  const paymentIdRef = useRef<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    const initiate = async () => {
      if (!VALID_PROVIDERS.includes(provider as PaymentProvider)) {
        setStage('failed')
        return
      }
      const safeProvider = provider as PaymentProvider
      try {
        const result = await processPayment.mutateAsync({
          appointment_id: appointmentId,
          provider: safeProvider,
          phone: phone ?? '',
        })
        paymentIdRef.current = result.paymentId

        if (result.checkoutUrl) {
          // PayDunya live mode — show redirect button
          setCheckoutUrl(result.checkoutUrl)
          setStage('redirect')
        } else if (result.mockCheckout) {
          // Sandbox mode — show fake checkout UI in-app
          router.replace({
            pathname: '/(patient)/payment/mock-checkout' as never,
            params: {
              paymentId:    result.paymentId,
              provider:     provider ?? 'wave',
              phone:        phone ?? '',
              amount:       String((result as { amount?: number }).amount ?? 0),
              currency:     (result as { currency?: string }).currency ?? 'XOF',
              appointmentId,
            },
          })
        } else {
          router.replace('/(patient)/booking-success')
        }
      } catch (e) {
        setStage('failed')
        Alert.alert(
          'Erreur de paiement',
          e instanceof Error ? e.message : 'Impossible d\'initier le paiement',
          [{ text: 'Retour', onPress: () => router.back() }],
        )
      }
    }
    void initiate()
    return () => {
      mountedRef.current = false
      if (pollRef.current) clearInterval(pollRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleOpenPayDunya = async () => {
    if (!checkoutUrl) return
    if (provider === 'card') {
      await WebBrowser.openAuthSessionAsync(checkoutUrl, 'msante://payment-return')
    } else {
      await WebBrowser.openBrowserAsync(checkoutUrl, {
        showTitle: true,
        toolbarColor: '#82d8ff',
      })
    }
    setStage('verifying')
    startPolling()
  }

  const startPolling = () => {
    let attempts = 0
    const interval = setInterval(async () => {
      if (!mountedRef.current) { clearInterval(interval); return }
      attempts++
      if (!paymentIdRef.current) return
      const { data } = await supabase
        .from('payments')
        .select('status')
        .eq('id', paymentIdRef.current)
        .single()

      if (data?.status === 'completed') {
        clearInterval(interval)
        router.replace('/(patient)/booking-success')
      } else if (data?.status === 'failed' || attempts >= 24) {
        clearInterval(interval)
        setStage('failed')
        Alert.alert(
          'Paiement non confirmé',
          'Vérifiez votre solde et réessayez.',
          [{ text: 'Retour', onPress: () => router.back() }],
        )
      }
    }, 5000)
    pollRef.current = interval
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff', alignItems: 'center', justifyContent: 'center', gap: 28, paddingHorizontal: 32 }}>

      <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}>
        {stage === 'failed'
          ? <Text style={{ fontSize: 40 }}>❌</Text>
          : stage === 'redirect'
            ? <Text style={{ fontSize: 40 }}>{provider === 'wave' ? '💙' : provider === 'card' ? '💳' : '🟠'}</Text>
            : <ActivityIndicator color="#82d8ff" size="large" />
        }
      </View>

      <View style={{ alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope', textAlign: 'center' }}>
          {stage === 'initiating' && 'Traitement en cours…'}
          {stage === 'redirect'   && `Payer avec ${PROVIDER_LABELS[(provider ?? 'wave') as PaymentProvider]}`}
          {stage === 'verifying'  && 'Vérification en cours…'}
          {stage === 'failed'     && 'Paiement non confirmé'}
        </Text>
        <Text style={{ fontSize: 14, color: '#3f484d', fontFamily: 'Manrope', textAlign: 'center', lineHeight: 20 }}>
          {stage === 'initiating' && `${PROVIDER_LABELS[(provider ?? 'wave') as PaymentProvider]} — veuillez patienter…`}
          {stage === 'redirect'   && 'Appuyez ci-dessous pour finaliser le paiement.\nVous recevrez une confirmation par SMS.'}
          {stage === 'verifying'  && 'En attente de confirmation PayDunya…\nCela peut prendre quelques secondes.'}
          {stage === 'failed'     && 'Vérifiez votre solde et réessayez.'}
        </Text>
      </View>

      {stage === 'redirect' && checkoutUrl && (
        <TouchableOpacity
          onPress={() => void handleOpenPayDunya()}
          style={{ backgroundColor: '#82d8ff', paddingHorizontal: 36, paddingVertical: 16, borderRadius: 999, shadowColor: '#82d8ff', shadowOpacity: 0.3, shadowRadius: 16, elevation: 6 }}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', fontFamily: 'Manrope' }}>
            Ouvrir PayDunya →
          </Text>
        </TouchableOpacity>
      )}

      <Text style={{ fontSize: 11, color: '#6f787e', fontFamily: 'Manrope', textAlign: 'center' }}>
        🔒 Paiement sécurisé · Données chiffrées
      </Text>
    </SafeAreaView>
  )
}
