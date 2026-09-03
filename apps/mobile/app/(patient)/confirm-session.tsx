import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useBookingStore } from '@/features/booking/store/bookingStore'
import { useCreateAppointment } from '@/features/booking/hooks/useCreateAppointment'
import { PaymentSheet } from '@/features/booking/components/PaymentSheet'
import { useResponsive } from '@/hooks/useResponsive'
import type { PaymentProvider, SessionType } from '@/types/booking'

// Le type est désormais choisi une seule fois, en amont, à l'étape de
// réservation (booking/[practitionerId].tsx) — dérivé des vraies prestations
// configurées par le praticien (video/presentiel/both), plus de sélecteur
// libre ici. Uniquement Présentiel/Vidéo sur mobile (section 11 du cahier
// des charges) ; 'suivi'/'urgence' restent des valeurs valides côté DB
// (créées depuis le web) mais ne sont jamais choisies depuis ce parcours.
const SESSION_LABELS: Partial<Record<SessionType, string>> = {
  video: 'Vidéo',
  presentiel: 'Présentiel',
  audio: 'Audio',
  suivi: 'Suivi',
  urgence: 'Urgence',
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  const { fs, scale } = useResponsive()
  if (!value) return null
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: scale(8) }}>
      <Text style={{ fontSize: fs.sm, color: '#6f787e', fontFamily: 'Manrope' }}>{label}</Text>
      <Text style={{ fontSize: fs.sm, fontWeight: '600', color: '#0b1c30', fontFamily: 'Manrope' }}>{value}</Text>
    </View>
  )
}

export default function ConfirmSessionScreen() {
  const router = useRouter()
  const { px, fs, scale } = useResponsive()
  const [sheetVisible, setSheetVisible] = useState(false)

  const {
    practitionerName, selectedSlot, sessionType, amount, currency,
    setPaymentProvider, setAppointmentId, practitionerId,
  } = useBookingStore()

  const createAppointment = useCreateAppointment()

  const handlePaymentConfirm = async (provider: PaymentProvider, phone?: string) => {
    setSheetVisible(false)
    setPaymentProvider(provider)

    if (!practitionerId || !selectedSlot) return

    const scheduledAt = `${selectedSlot.date}T${selectedSlot.startTime}:00`

    try {
      const result = await createAppointment.mutateAsync({
        practitioner_id: practitionerId,
        scheduled_at: scheduledAt,
        duration_min: 60,
        type: sessionType,
      })

      setAppointmentId(result.appointmentId)

      router.push({
        pathname: '/(patient)/payment/processing',
        params: { appointmentId: result.appointmentId, provider, phone: phone ?? '' },
      })
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible de créer le RDV')
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: px, paddingBottom: scale(40) }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ marginTop: scale(24), marginBottom: scale(20) }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: scale(16), flexDirection: 'row', alignItems: 'center', gap: scale(4) }}>
            <MaterialIcons name="arrow-back" size={scale(20)} color="#82d8ff" />
            <Text style={{ color: '#82d8ff', fontFamily: 'Manrope', fontWeight: '600', fontSize: fs.sm }}>Retour</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: fs.xxl, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope', letterSpacing: -0.5 }}>
            Confirmer la session
          </Text>
          <Text style={{ fontSize: fs.sm, color: '#6f787e', fontFamily: 'Manrope', marginTop: scale(4) }}>
            Vérifiez les détails avant de payer
          </Text>
        </View>

        {/* Type de session — choisi en amont à l'étape de réservation, affiché ici en lecture seule */}
        <View style={{
          marginBottom: scale(20),
          flexDirection: 'row', alignItems: 'center', gap: scale(12),
          padding: scale(14), borderRadius: scale(14),
          borderWidth: 1, borderColor: '#e5eeff', backgroundColor: 'rgba(255,255,255,0.85)',
        }}>
          <View style={{ width: scale(40), height: scale(40), borderRadius: scale(12), backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}>
            <MaterialIcons name={sessionType === 'video' ? 'videocam' : 'location-on'} size={scale(20)} color="#82d8ff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: fs.xs, fontWeight: '700', color: '#82d8ff', letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'Manrope' }}>
              Type de session
            </Text>
            <Text style={{ fontSize: fs.md, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope', marginTop: 2 }}>
              {SESSION_LABELS[sessionType] ?? sessionType}
            </Text>
          </View>
        </View>

        {/* Récapitulatif */}
        <View style={{
          backgroundColor: 'rgba(255,255,255,0.85)',
          borderRadius: scale(18),
          padding: scale(18),
          borderWidth: 1,
          borderColor: '#e5eeff',
          shadowColor: '#82d8ff',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.05,
          shadowRadius: 12,
          elevation: 2,
          marginBottom: scale(20),
        }}>
          <Text style={{ fontSize: fs.xs, fontWeight: '700', color: '#82d8ff', letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'Manrope', marginBottom: scale(4) }}>
            Récapitulatif
          </Text>

          <View style={{ borderTopWidth: 1, borderTopColor: '#f1f5f9', marginTop: scale(8) }}>
            <DetailRow label="Praticien" value={practitionerName} />
            <DetailRow label="Date" value={selectedSlot?.date} />
            <DetailRow label="Créneau" value={selectedSlot ? `${selectedSlot.startTime} → ${selectedSlot.endTime}` : null} />
          </View>

          {/* Total */}
          <View style={{ borderTopWidth: 1.5, borderTopColor: '#e5eeff', marginTop: scale(8), paddingTop: scale(12), flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: fs.lg, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope' }}>Total</Text>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: fs.xl, fontWeight: '900', color: '#82d8ff', fontFamily: 'Manrope' }}>
                {amount?.toLocaleString('fr-FR')} {currency}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <MaterialIcons name="lock" size={scale(10)} color="#1d7a3a" />
                <Text style={{ fontSize: scale(9), color: '#1d7a3a', fontFamily: 'Manrope', fontWeight: '600' }}>Paiement sécurisé</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Payment providers info */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: scale(16), marginBottom: scale(20) }}>
          {[['💙', 'Wave'], ['🟠', 'Orange Money'], ['💳', 'Carte']].map(([icon, name]) => (
            <View key={name} style={{ alignItems: 'center', gap: 3 }}>
              <Text style={{ fontSize: scale(20) }}>{icon}</Text>
              <Text style={{ fontSize: scale(9), color: '#6f787e', fontFamily: 'Manrope', fontWeight: '600' }}>{name}</Text>
            </View>
          ))}
        </View>

        {/* CTA */}
        <TouchableOpacity
          onPress={() => setSheetVisible(true)}
          disabled={createAppointment.isPending}
          style={{
            backgroundColor: '#82d8ff',
            borderRadius: scale(14),
            paddingVertical: scale(16),
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: scale(8),
            opacity: createAppointment.isPending ? 0.7 : 1,
          }}
        >
          <MaterialIcons name="lock" size={scale(18)} color="#0b1c30" />
          <Text style={{ color: '#0b1c30', fontWeight: '800', fontSize: fs.md, fontFamily: 'Manrope' }}>
            {createAppointment.isPending ? 'Traitement…' : 'Procéder au paiement'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <PaymentSheet
        visible={sheetVisible}
        amount={amount ?? 0}
        currency={currency}
        onConfirm={handlePaymentConfirm}
        onClose={() => setSheetVisible(false)}
      />
    </SafeAreaView>
  )
}
