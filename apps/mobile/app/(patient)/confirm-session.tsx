import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useBookingStore } from '@/features/booking/store/bookingStore'
import { useCreateAppointment } from '@/features/booking/hooks/useCreateAppointment'
import { PaymentSheet } from '@/features/booking/components/PaymentSheet'
import { PrimaryButton, GlassCard } from '@/components/ui'
import type { PaymentProvider } from '@/types/booking'

const SESSION_LABELS: Record<string, string> = { video: 'Vidéo', audio: 'Audio', presentiel: 'Présentiel' }

export default function ConfirmSessionScreen() {
  const router = useRouter()
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
      <ScrollView style={{ flex: 1, paddingHorizontal: 24 }} contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={{ marginTop: 32, marginBottom: 24 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <MaterialIcons name="arrow-back" size={20} color="#006685" />
            <Text style={{ color: '#006685', fontFamily: 'Manrope', fontWeight: '500' }}>Retour</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#0b1c30', fontFamily: 'Manrope' }}>
            Confirmer la session
          </Text>
        </View>

        <GlassCard style={{ gap: 16, marginBottom: 24 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#0b1c30', fontFamily: 'Manrope' }}>
            Récapitulatif
          </Text>

          {[
            { label: 'Praticien', value: practitionerName },
            { label: 'Date', value: selectedSlot?.date },
            { label: 'Heure', value: selectedSlot ? `${selectedSlot.startTime} → ${selectedSlot.endTime}` : '' },
            { label: 'Type', value: SESSION_LABELS[sessionType] },
          ].map(({ label, value }) => (
            <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 14, color: '#3f484d', fontFamily: 'Manrope' }}>{label}</Text>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#0b1c30', fontFamily: 'Manrope' }}>{value}</Text>
            </View>
          ))}

          <View style={{ borderTopWidth: 1, borderTopColor: '#bec8ce', paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#0b1c30', fontFamily: 'Manrope' }}>Total</Text>
            <Text style={{ fontSize: 16, fontWeight: '900', color: '#006685', fontFamily: 'Manrope' }}>
              {amount?.toLocaleString()} {currency}
            </Text>
          </View>
        </GlassCard>

        <PrimaryButton
          label="Procéder au paiement"
          onPress={() => setSheetVisible(true)}
          loading={createAppointment.isPending}
        />
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
