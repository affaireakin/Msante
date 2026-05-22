import { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StatusBar, Alert,
  Animated, Easing,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { supabase } from '@/services/supabase'
import type { PaymentProvider } from '@/types/booking'

// ── Provider config ───────────────────────────────────────────────────────────

const PROVIDER_CONFIG: Record<PaymentProvider, {
  label: string
  color: string
  bg: string
  emoji: string
  digits: string
}> = {
  wave: {
    label: 'Wave',
    color: '#0066ff',
    bg: '#e6f0ff',
    emoji: '💙',
    digits: '70 000 00 00',
  },
  orange_money: {
    label: 'Orange Money',
    color: '#ff6600',
    bg: '#fff0e6',
    emoji: '🟠',
    digits: '77 000 00 00',
  },
  card: {
    label: 'Carte bancaire',
    color: '#006685',
    bg: '#e5eeff',
    emoji: '💳',
    digits: '•••• •••• •••• 4242',
  },
}

// ── Stages ────────────────────────────────────────────────────────────────────

type Stage = 'confirm' | 'processing' | 'success'

// ── Spinner ───────────────────────────────────────────────────────────────────

function Spinner({ color }: { color: string }) {
  const spin = useState(new Animated.Value(0))[0]

  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, {
        toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true,
      })
    ).start()
  }, [spin])

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })

  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <MaterialIcons name="sync" size={32} color={color} />
    </Animated.View>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function MockCheckoutScreen() {
  const router = useRouter()
  const {
    paymentId, provider, phone, amount, currency, appointmentId,
  } = useLocalSearchParams<{
    paymentId:     string
    provider:      string
    phone:         string
    amount:        string
    currency:      string
    appointmentId: string
  }>()

  const [stage, setStage] = useState<Stage>('confirm')

  const safeProvider = (PROVIDER_CONFIG[provider as PaymentProvider] ? provider : 'wave') as PaymentProvider
  const config = PROVIDER_CONFIG[safeProvider]
  const numericAmount = parseInt(amount ?? '0', 10)

  const handlePay = async () => {
    setStage('processing')

    // Simulate network delay (1.8s)
    await new Promise(r => setTimeout(r, 1800))

    try {
      // Complete payment
      await supabase
        .from('payments')
        .update({
          status:       'completed',
          provider_ref: `MOCK-${Date.now()}`,
          updated_at:   new Date().toISOString(),
        })
        .eq('id', paymentId)

      // Confirm appointment
      await supabase
        .from('appointments')
        .update({ status: 'confirmed', payment_id: paymentId })
        .eq('id', appointmentId)

      // Notify patient (fire-and-forget)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user?.id) {
          const { data: userData } = await supabase
            .from('users')
            .select('push_token')
            .eq('id', session.user.id)
            .single()
          if (userData?.push_token) {
            await fetch('https://exp.host/--/api/v2/push/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to:    userData.push_token,
                title: 'Paiement confirmé ✓',
                body:  `Votre paiement de ${numericAmount.toLocaleString('fr-FR')} ${currency} a été reçu.`,
                data:  { route: '/(patient)/appointments' },
              }),
            })
          }
        }
      } catch { /* non-fatal */ }

      setStage('success')
      await new Promise(r => setTimeout(r, 1400))
      router.replace('/(patient)/booking-success')

    } catch {
      setStage('confirm')
      Alert.alert('Erreur', 'Impossible de confirmer le paiement. Réessayez.')
    }
  }

  // ── Shared header ──────────────────────────────────────────────────────────

  const Header = () => (
    <View style={{
      paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16,
      backgroundColor: '#fff',
      borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
      flexDirection: 'row', alignItems: 'center', gap: 12,
    }}>
      {/* PayDunya-style logo zone */}
      <View style={{
        width: 36, height: 36, borderRadius: 8,
        backgroundColor: '#006685', alignItems: 'center', justifyContent: 'center',
      }}>
        <MaterialIcons name="medical-services" size={18} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: 'Manrope', fontSize: 14, fontWeight: '700', color: '#0b1c30' }}>
          M-Santé
        </Text>
        <Text style={{ fontFamily: 'Manrope', fontSize: 11, color: '#6f787e' }}>
          Paiement sécurisé · Sandbox
        </Text>
      </View>
      <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: '#fef3c7' }}>
        <Text style={{ fontFamily: 'Manrope', fontSize: 10, fontWeight: '700', color: '#92400e' }}>
          TEST
        </Text>
      </View>
    </View>
  )

  // ── Confirm stage ──────────────────────────────────────────────────────────

  if (stage === 'confirm') return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <Header />

      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 32, gap: 24 }}>

        {/* Amount block */}
        <View style={{
          backgroundColor: '#fff', borderRadius: 16,
          padding: 24, alignItems: 'center', gap: 8,
          shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 12, elevation: 2,
        }}>
          <Text style={{ fontFamily: 'Manrope', fontSize: 12, color: '#6f787e', textTransform: 'uppercase', letterSpacing: 1 }}>
            Montant à payer
          </Text>
          <Text style={{ fontFamily: 'Manrope', fontSize: 36, fontWeight: '900', color: '#0b1c30', letterSpacing: -1 }}>
            {numericAmount.toLocaleString('fr-FR')}
          </Text>
          <Text style={{ fontFamily: 'Manrope', fontSize: 14, fontWeight: '600', color: '#6f787e' }}>
            {currency ?? 'XOF'}
          </Text>
        </View>

        {/* Provider block */}
        <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, gap: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 12, elevation: 2 }}>
          <Text style={{ fontFamily: 'Manrope', fontSize: 12, fontWeight: '700', color: '#6f787e', textTransform: 'uppercase', letterSpacing: 1 }}>
            Méthode de paiement
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{
              width: 48, height: 48, borderRadius: 12,
              backgroundColor: config.bg,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontSize: 22 }}>{config.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: '700', color: '#0b1c30' }}>
                {config.label}
              </Text>
              <Text style={{ fontFamily: 'Manrope', fontSize: 13, color: '#6f787e', marginTop: 2 }}>
                {phone && safeProvider !== 'card' ? phone : config.digits}
              </Text>
            </View>
            <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: config.color, alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcons name="check" size={13} color="#fff" />
            </View>
          </View>
        </View>

        {/* Security notes */}
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
          <MaterialIcons name="lock" size={14} color="#6f787e" style={{ marginTop: 1 }} />
          <Text style={{ fontFamily: 'Manrope', fontSize: 12, color: '#6f787e', flex: 1, lineHeight: 18 }}>
            Environnement de test — aucun débit réel ne sera effectué. Les paiements sandbox simulent le comportement de production.
          </Text>
        </View>

      </View>

      {/* CTA */}
      <View style={{ paddingHorizontal: 24, paddingBottom: 32, gap: 12 }}>
        <TouchableOpacity
          onPress={() => void handlePay()}
          style={{
            backgroundColor: config.color,
            paddingVertical: 18, borderRadius: 16,
            alignItems: 'center', justifyContent: 'center',
            flexDirection: 'row', gap: 10,
            shadowColor: config.color, shadowOpacity: 0.35, shadowRadius: 16, elevation: 6,
          }}
        >
          <Text style={{ fontFamily: 'Manrope', fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: -0.3 }}>
            Payer {numericAmount.toLocaleString('fr-FR')} {currency ?? 'XOF'}
          </Text>
          <MaterialIcons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={{ alignItems: 'center', paddingVertical: 10 }}>
          <Text style={{ fontFamily: 'Manrope', fontSize: 13, color: '#6f787e' }}>
            Annuler et revenir
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )

  // ── Processing stage ───────────────────────────────────────────────────────

  if (stage === 'processing') return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', gap: 24 }} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <View style={{
        width: 80, height: 80, borderRadius: 40,
        backgroundColor: config.bg,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Spinner color={config.color} />
      </View>

      <View style={{ alignItems: 'center', gap: 6 }}>
        <Text style={{ fontFamily: 'Manrope', fontSize: 20, fontWeight: '700', color: '#0b1c30' }}>
          Traitement en cours…
        </Text>
        <Text style={{ fontFamily: 'Manrope', fontSize: 14, color: '#6f787e' }}>
          Confirmation {config.label}
        </Text>
      </View>

      <View style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 6, backgroundColor: '#fef3c7' }}>
        <Text style={{ fontFamily: 'Manrope', fontSize: 11, fontWeight: '700', color: '#92400e' }}>
          MODE TEST
        </Text>
      </View>
    </SafeAreaView>
  )

  // ── Success stage ──────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center', gap: 24 }} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <View style={{
        width: 80, height: 80, borderRadius: 40,
        backgroundColor: '#d1fae5',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <MaterialIcons name="check-circle" size={44} color="#1d7a3a" />
      </View>

      <View style={{ alignItems: 'center', gap: 6 }}>
        <Text style={{ fontFamily: 'Manrope', fontSize: 22, fontWeight: '800', color: '#0b1c30' }}>
          Paiement confirmé !
        </Text>
        <Text style={{ fontFamily: 'Manrope', fontSize: 14, color: '#3f484d' }}>
          {numericAmount.toLocaleString('fr-FR')} {currency ?? 'XOF'} · {config.label}
        </Text>
      </View>
    </SafeAreaView>
  )
}
