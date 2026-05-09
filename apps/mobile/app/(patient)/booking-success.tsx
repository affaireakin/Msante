import { View, Text, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff', paddingHorizontal: 24, justifyContent: 'center', gap: 32 }}>
      <View style={{ alignItems: 'center', gap: 16 }}>
        <View style={{ width: 96, height: 96, backgroundColor: '#ecfdf5', borderRadius: 48, alignItems: 'center', justifyContent: 'center' }}>
          <MaterialIcons name="check-circle" size={52} color="#1d7a3a" />
        </View>
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 22, fontWeight: '900', color: '#0b1c30', fontFamily: 'Manrope' }}>
            Vous êtes prêt !
          </Text>
          <Text style={{ fontSize: 14, color: '#3f484d', fontFamily: 'Manrope', textAlign: 'center' }}>
            Votre rendez-vous a été confirmé avec succès.
          </Text>
        </View>
      </View>

      <GlassCard style={{ gap: 12 }}>
        {[
          { label: 'Praticien', value: practitionerName, icon: 'person' as const },
          { label: 'Date', value: selectedSlot?.date, icon: 'event' as const },
          { label: 'Heure', value: selectedSlot?.startTime, icon: 'schedule' as const },
          { label: 'Type', value: SESSION_LABELS[sessionType], icon: 'videocam' as const },
        ].map(({ label, value, icon }) => value ? (
          <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 14, color: '#3f484d', fontFamily: 'Manrope' }}>{label}</Text>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#0b1c30', fontFamily: 'Manrope' }}>{value}</Text>
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
          style={{
            width: '100%',
            borderWidth: 1,
            borderColor: '#006685',
            borderRadius: 9999,
            paddingVertical: 14,
            alignItems: 'center',
            marginBottom: 8,
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Text style={{ color: '#006685', fontWeight: '600', fontFamily: 'Manrope' }}>Accéder à la salle d'attente</Text>
          <MaterialIcons name="videocam" size={18} color="#006685" />
        </TouchableOpacity>
      )}

      <PrimaryButton label="Retour à l'accueil" onPress={handleHome} />
    </SafeAreaView>
  )
}
