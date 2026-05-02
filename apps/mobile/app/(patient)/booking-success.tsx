import { View, Text, SafeAreaView, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { useBookingStore } from '@/features/booking/store/bookingStore'
import { PrimaryButton, GlassCard } from '@/components/ui'

const SESSION_LABELS: Record<string, string> = { video: 'Vidéo', audio: 'Audio', chat: 'Chat' }

export default function BookingSuccessScreen() {
  const router = useRouter()
  const { practitionerName, selectedSlot, sessionType, appointmentId, reset } = useBookingStore()

  const handleHome = () => {
    reset()
    router.replace('/(patient)/home')
  }

  return (
    <SafeAreaView className="flex-1 bg-background px-6 justify-center gap-8">
      <View className="items-center gap-4">
        <View className="w-24 h-24 bg-emerald-50 rounded-full items-center justify-center">
          <Text className="text-5xl">✅</Text>
        </View>
        <View className="items-center gap-2">
          <Text className="text-2xl font-black text-on-surface font-manrope">
            Vous êtes prêt !
          </Text>
          <Text className="text-sm text-on-surface-variant font-manrope text-center">
            Votre rendez-vous a été confirmé avec succès.
          </Text>
        </View>
      </View>

      <GlassCard className="gap-3">
        {[
          { label: '👨‍⚕️ Praticien', value: practitionerName },
          { label: '📅 Date', value: selectedSlot?.date },
          { label: '🕐 Heure', value: selectedSlot?.startTime },
          { label: '📹 Type', value: SESSION_LABELS[sessionType] },
        ].map(({ label, value }) => value ? (
          <View key={label} className="flex-row justify-between">
            <Text className="text-sm text-on-surface-variant font-manrope">{label}</Text>
            <Text className="text-sm font-semibold text-on-surface font-manrope">{value}</Text>
          </View>
        ) : null)}
      </GlassCard>

      {sessionType === 'video' && appointmentId && (
        <TouchableOpacity
          onPress={() => router.push({
            pathname: '/(patient)/consultation/waiting',
            params: {
              appointmentId,
              practitionerName: practitionerName ?? '',
              scheduledAt: selectedSlot?.date
                ? `${selectedSlot.date}T${selectedSlot.startTime ?? '00:00'}:00`
                : new Date().toISOString(),
            },
          })}
          className="w-full border border-primary rounded-full py-3.5 items-center mb-2"
        >
          <Text className="text-primary font-semibold font-manrope">Accéder à la salle d'attente 📹</Text>
        </TouchableOpacity>
      )}

      <PrimaryButton label="Retour à l'accueil" onPress={handleHome} />
    </SafeAreaView>
  )
}
