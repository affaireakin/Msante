import { View, Text, TouchableOpacity, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useBookingStore } from '@/features/booking/store/bookingStore'
import { useResponsive } from '@/hooks/useResponsive'

const SESSION_LABELS: Record<string, string> = { video: 'Vidéo', audio: 'Audio', chat: 'Chat', presentiel: 'Présentiel' }

function DetailRow({ label, value, icon }: { label: string; value?: string; icon: React.ComponentProps<typeof MaterialIcons>['name'] }) {
  const { fs, scale } = useResponsive()
  if (!value) return null
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: scale(8) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(8) }}>
        <View style={{ width: scale(28), height: scale(28), borderRadius: scale(8), backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}>
          <MaterialIcons name={icon} size={scale(14)} color="#006685" />
        </View>
        <Text style={{ fontSize: fs.sm, color: '#6f787e', fontFamily: 'Manrope' }}>{label}</Text>
      </View>
      <Text style={{ fontSize: fs.sm, fontWeight: '600', color: '#0b1c30', fontFamily: 'Manrope' }}>{value}</Text>
    </View>
  )
}

export default function BookingSuccessScreen() {
  const router = useRouter()
  const { px, fs, scale } = useResponsive()
  const { practitionerName, selectedSlot, sessionType, appointmentId, reset } = useBookingStore()

  const handleHome = () => {
    reset()
    router.replace('/(patient)/home')
  }

  const handleAddToCalendar = () => {
    // Placeholder — intégrer expo-calendar si disponible
    // Pour l'instant on navigue vers les RDV
    router.push('/(patient)/appointments' as never)
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      <View style={{ flex: 1, paddingHorizontal: px, justifyContent: 'center', gap: scale(28) }}>

        {/* Success icon */}
        <View style={{ alignItems: 'center', gap: scale(16) }}>
          <View style={{
            width: scale(100),
            height: scale(100),
            backgroundColor: '#e8f5e9',
            borderRadius: scale(50),
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#1d7a3a',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 16,
            elevation: 4,
          }}>
            <MaterialIcons name="check-circle" size={scale(54)} color="#1d7a3a" />
          </View>

          <View style={{ alignItems: 'center', gap: scale(8) }}>
            <Text style={{ fontSize: fs.hero, fontWeight: '900', color: '#0b1c30', fontFamily: 'Manrope', textAlign: 'center', letterSpacing: -0.5 }}>
              C'est fait ! 🎉
            </Text>
            <Text style={{ fontSize: fs.md, color: '#3f484d', fontFamily: 'Manrope', textAlign: 'center', lineHeight: scale(22) }}>
              Votre rendez-vous a été confirmé avec succès.
            </Text>
          </View>
        </View>

        {/* RDV details card */}
        <View style={{
          backgroundColor: 'rgba(255,255,255,0.85)',
          borderRadius: scale(20),
          padding: scale(18),
          borderWidth: 1,
          borderColor: '#e5eeff',
          shadowColor: '#006685',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.06,
          shadowRadius: 16,
          elevation: 3,
          gap: 0,
        }}>
          <Text style={{ fontSize: fs.xs, fontWeight: '700', color: '#006685', letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'Manrope', marginBottom: scale(8) }}>
            Détails du rendez-vous
          </Text>

          <View style={{ borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
            <DetailRow label="Praticien" value={practitionerName ?? undefined} icon="person" />
            <DetailRow label="Date" value={selectedSlot?.date} icon="event" />
            <DetailRow label="Heure" value={selectedSlot?.startTime} icon="schedule" />
            <DetailRow label="Type" value={SESSION_LABELS[sessionType]} icon="videocam" />
          </View>
        </View>

        {/* Actions */}
        <View style={{ gap: scale(12) }}>
          {/* Add to Calendar */}
          <TouchableOpacity
            onPress={handleAddToCalendar}
            style={{
              borderWidth: 1.5,
              borderColor: '#006685',
              borderRadius: scale(14),
              paddingVertical: scale(14),
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: scale(8),
              backgroundColor: 'rgba(0,102,133,0.04)',
            }}
          >
            <MaterialIcons name="event-available" size={scale(18)} color="#006685" />
            <Text style={{ color: '#006685', fontWeight: '700', fontSize: fs.md, fontFamily: 'Manrope' }}>
              Ajouter au calendrier
            </Text>
          </TouchableOpacity>

          {/* Join waiting room (if video) */}
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
                borderWidth: 1,
                borderColor: '#1d7a3a',
                borderRadius: scale(14),
                paddingVertical: scale(14),
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: scale(8),
                backgroundColor: '#f0fdf4',
              }}
            >
              <MaterialIcons name="videocam" size={scale(18)} color="#1d7a3a" />
              <Text style={{ color: '#1d7a3a', fontWeight: '600', fontFamily: 'Manrope', fontSize: fs.md }}>
                Accéder à la salle d'attente
              </Text>
            </TouchableOpacity>
          )}

          {/* Back to home */}
          <TouchableOpacity
            onPress={handleHome}
            style={{ backgroundColor: '#006685', borderRadius: scale(14), paddingVertical: scale(15), alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: fs.md, fontFamily: 'Manrope' }}>
              Retour à l'accueil
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  )
}
