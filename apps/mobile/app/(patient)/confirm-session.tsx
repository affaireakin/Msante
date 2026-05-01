import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { useBookingStore } from '@/features/booking/store/bookingStore'
import { useCreateAppointment } from '@/features/booking/hooks/useCreateAppointment'
import { PaymentSheet } from '@/features/booking/components/PaymentSheet'
import { PrimaryButton, GlassCard } from '@/components/ui'
import type { PaymentProvider } from '@/types/booking'

const SESSION_LABELS: Record<string, string> = { video: 'Vidéo', audio: 'Audio', chat: 'Chat' }

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
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="mt-8 mb-6">
          <TouchableOpacity onPress={() => router.back()} className="mb-4">
            <Text className="text-primary font-manrope font-medium">← Retour</Text>
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-on-surface font-manrope">
            Confirmer la session
          </Text>
        </View>

        <GlassCard className="gap-4 mb-6">
          <Text className="text-base font-semibold text-on-surface font-manrope">
            Récapitulatif
          </Text>

          {[
            { label: 'Praticien', value: practitionerName },
            { label: 'Date', value: selectedSlot?.date },
            { label: 'Heure', value: selectedSlot ? `${selectedSlot.startTime} → ${selectedSlot.endTime}` : '' },
            { label: 'Type', value: SESSION_LABELS[sessionType] },
          ].map(({ label, value }) => (
            <View key={label} className="flex-row justify-between">
              <Text className="text-sm text-on-surface-variant font-manrope">{label}</Text>
              <Text className="text-sm font-semibold text-on-surface font-manrope">{value}</Text>
            </View>
          ))}

          <View className="border-t border-outline-variant pt-3 flex-row justify-between">
            <Text className="text-base font-bold text-on-surface font-manrope">Total</Text>
            <Text className="text-base font-black text-primary font-manrope">
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
