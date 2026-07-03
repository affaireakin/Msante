import { ScrollView, View, Text, TouchableOpacity, Alert, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useAgenda, type AgendaAppointment } from '@/features/practitioner/hooks/useAgenda'
import {
  approveAppointment,
  declineAppointment,
} from '@/features/practitioner/services/appointmentActions'
import { useResponsive } from '@/hooks/useResponsive'

function isUrgent(iso: string) {
  const diff = new Date(iso).getTime() - Date.now()
  return diff > 0 && diff < 2 * 60 * 60 * 1000 // < 2h
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    weekday: 'short', day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Africa/Dakar',
  })
}

function InitialsAvatar({ initials, size }: { initials: string; size: number }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: '#82d8ff', alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: '#fff', fontFamily: 'Manrope', fontWeight: '700', fontSize: size * 0.35 }}>
        {initials}
      </Text>
    </View>
  )
}

function AppointmentCard({
  appt, onApprove, onDecline, isWorking,
}: {
  appt: AgendaAppointment
  onApprove: () => void
  onDecline: () => void
  isWorking: boolean
}) {
  const { fs, scale } = useResponsive()
  const urgent = isUrgent(appt.scheduledAt)
  const isVideo = appt.consultationType === 'Telehealth'

  return (
    <View style={{
      backgroundColor: 'rgba(255,255,255,0.88)',
      borderRadius: scale(18),
      borderWidth: urgent ? 1.5 : 1,
      borderColor: urgent ? '#ba1a1a' : '#e5eeff',
      overflow: 'hidden',
      shadowColor: urgent ? '#ba1a1a' : '#82d8ff',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.07,
      shadowRadius: 12,
      elevation: 3,
    }}>
      {/* Urgent banner */}
      {urgent && (
        <View style={{ backgroundColor: '#fce4ec', paddingHorizontal: scale(14), paddingVertical: scale(6), flexDirection: 'row', alignItems: 'center', gap: scale(6) }}>
          <MaterialIcons name="access-alarm" size={scale(13)} color="#ba1a1a" />
          <Text style={{ fontSize: fs.xs, fontWeight: '700', color: '#ba1a1a', fontFamily: 'Manrope', letterSpacing: 0.5 }}>URGENT — Dans moins de 2h</Text>
        </View>
      )}

      <View style={{ padding: scale(16), gap: scale(14) }}>
        {/* Patient info */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: scale(12) }}>
          <InitialsAvatar initials={appt.patientInitials} size={scale(46)} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.md, fontWeight: '700', color: '#0b1c30' }}>
              {appt.patientName}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(6), marginTop: scale(2) }}>
              <MaterialIcons name={isVideo ? 'videocam' : 'location-on'} size={scale(13)} color="#6f787e" />
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, color: '#6f787e' }}>
                {isVideo ? 'Téléconsultation' : 'Présentiel'}
              </Text>
            </View>
          </View>
          {/* Type badge */}
          <View style={{ backgroundColor: isVideo ? '#e5eeff' : '#f0fdf4', borderRadius: scale(8), paddingHorizontal: scale(8), paddingVertical: scale(3) }}>
            <Text style={{ fontSize: scale(9), fontWeight: '700', color: isVideo ? '#82d8ff' : '#1d7a3a', fontFamily: 'Manrope' }}>
              {isVideo ? 'Vidéo' : 'Présentiel'}
            </Text>
          </View>
        </View>

        {/* Date chip */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: scale(8),
          paddingHorizontal: scale(12), paddingVertical: scale(8),
          borderRadius: scale(10), backgroundColor: '#f8f9ff',
          borderWidth: 1, borderColor: '#e5eeff',
        }}>
          <MaterialIcons name="event" size={scale(15)} color="#82d8ff" />
          <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, color: '#82d8ff', fontWeight: '600' }}>
            {formatDateTime(appt.scheduledAt)}
          </Text>
        </View>

        {/* Patient note */}
        {appt.notes ? (
          <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, color: '#3f484d', lineHeight: scale(18), fontStyle: 'italic' }} numberOfLines={2}>
            "{appt.notes}"
          </Text>
        ) : null}

        {/* Action buttons: Approuver · Reprogrammer · Refuser */}
        <View style={{ flexDirection: 'row', gap: scale(8) }}>
          <TouchableOpacity
            onPress={onApprove}
            disabled={isWorking}
            style={{ flex: 2, paddingVertical: scale(11), borderRadius: 9999, alignItems: 'center', backgroundColor: '#82d8ff', opacity: isWorking ? 0.5 : 1 }}
          >
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '700', color: '#fff' }}>Approuver</Text>
          </TouchableOpacity>
          <TouchableOpacity
            disabled={isWorking}
            style={{ flex: 2, paddingVertical: scale(11), borderRadius: 9999, alignItems: 'center', borderWidth: 1, borderColor: '#bec8ce', backgroundColor: 'rgba(255,255,255,0.6)' }}
          >
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '600', color: '#82d8ff' }}>Reporter</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onDecline}
            disabled={isWorking}
            style={{ flex: 1, paddingVertical: scale(11), borderRadius: 9999, alignItems: 'center', opacity: isWorking ? 0.5 : 1 }}
          >
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '600', color: '#ba1a1a' }}>Refuser</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

export default function AgendaScreen() {
  const { practitioner } = useAuth()
  const { px, fs, scale } = useResponsive()
  const queryClient = useQueryClient()
  const { data, isLoading, refetch, isRefetching } = useAgenda(practitioner?.id ?? '')

  const approveMutation = useMutation({
    mutationFn: ({ appointmentId, patientId }: { appointmentId: string; patientId: string }) =>
      approveAppointment(appointmentId, patientId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['practitioner-agenda'] }),
    onError: () => Alert.alert('Erreur', "Impossible d'approuver ce rendez-vous."),
  })

  const declineMutation = useMutation({
    mutationFn: ({ appointmentId, patientId }: { appointmentId: string; patientId: string }) =>
      declineAppointment(appointmentId, patientId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['practitioner-agenda'] }),
    onError: () => Alert.alert('Erreur', 'Impossible de refuser ce rendez-vous.'),
  })

  const isWorking = approveMutation.isPending || declineMutation.isPending
  const pending = data?.pending ?? []
  const confirmed = data?.confirmed ?? []
  const urgentCount = pending.filter(a => isUrgent(a.scheduledAt)).length

  const handleDecline = (appt: AgendaAppointment) => {
    Alert.alert('Refuser ce RDV ?', 'Le patient sera notifié.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Refuser', style: 'destructive', onPress: () => declineMutation.mutate({ appointmentId: appt.id, patientId: appt.patientId }) },
    ])
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }} edges={['top']}>

      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: px, paddingVertical: scale(16),
        backgroundColor: 'rgba(255,255,255,0.80)',
        borderBottomWidth: 1, borderBottomColor: 'rgba(229,238,255,0.6)',
      }}>
        <View>
          <Text style={{ fontFamily: 'Manrope', fontSize: fs.xxl, fontWeight: '800', color: '#0b1c30', letterSpacing: -0.5 }}>
            Agenda
          </Text>
          <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, color: '#6f787e', marginTop: 2 }}>
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>
        </View>

        {/* Badges */}
        <View style={{ flexDirection: 'row', gap: scale(8) }}>
          {pending.length > 0 && (
            <View style={{ paddingHorizontal: scale(10), paddingVertical: scale(5), borderRadius: 9999, backgroundColor: '#e5eeff' }}>
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: '#82d8ff' }}>
                {pending.length} Demande{pending.length > 1 ? 's' : ''}
              </Text>
            </View>
          )}
          {urgentCount > 0 && (
            <View style={{ paddingHorizontal: scale(10), paddingVertical: scale(5), borderRadius: 9999, backgroundColor: '#fce4ec' }}>
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: '#ba1a1a' }}>
                {urgentCount} Urgent{urgentCount > 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: px, paddingTop: scale(20), paddingBottom: 100, gap: scale(24) }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#82d8ff" />}
      >
        {/* Pending Approvals section */}
        <View style={{ gap: scale(12) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.md, fontWeight: '700', color: '#0b1c30' }}>
              Demandes en attente
            </Text>
            {pending.length > 0 && (
              <View style={{ paddingHorizontal: scale(10), paddingVertical: scale(4), borderRadius: 9999, backgroundColor: '#e5eeff' }}>
                <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: '#82d8ff' }}>
                  {pending.length} requête{pending.length > 1 ? 's' : ''}
                </Text>
              </View>
            )}
          </View>

          {isLoading ? (
            [1, 2].map(i => (
              <View key={i} style={{ height: scale(176), borderRadius: scale(18), backgroundColor: 'rgba(255,255,255,0.4)' }} />
            ))
          ) : pending.length === 0 ? (
            <View style={{
              backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: scale(16),
              padding: scale(24), alignItems: 'center', gap: scale(8),
              borderWidth: 1, borderColor: '#e5eeff',
            }}>
              <MaterialIcons name="check-circle-outline" size={scale(32)} color="#1d7a3a" />
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.md, fontWeight: '600', color: '#1d7a3a' }}>
                Tout est à jour !
              </Text>
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, color: '#6f787e', textAlign: 'center' }}>
                Aucune demande en attente d'approbation
              </Text>
            </View>
          ) : (
            pending.map(appt => (
              <AppointmentCard
                key={appt.id}
                appt={appt}
                onApprove={() => approveMutation.mutate({ appointmentId: appt.id, patientId: appt.patientId })}
                onDecline={() => handleDecline(appt)}
                isWorking={isWorking}
              />
            ))
          )}
        </View>

        {/* Confirmed today section */}
        {confirmed.length > 0 && (
          <View style={{ gap: scale(12) }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.md, fontWeight: '700', color: '#0b1c30' }}>
              Confirmés aujourd'hui
            </Text>
            {confirmed.map(appt => (
              <View key={appt.id} style={{
                backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: scale(16),
                padding: scale(14), borderWidth: 1, borderColor: '#e5eeff',
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                gap: scale(12),
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(12), flex: 1 }}>
                  <InitialsAvatar initials={appt.patientInitials} size={scale(42)} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Manrope', fontSize: fs.md, fontWeight: '700', color: '#0b1c30' }}>
                      {appt.patientName}
                    </Text>
                    <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, color: '#6f787e' }}>
                      {appt.consultationType === 'Telehealth' ? 'Téléconsultation' : 'Présentiel'}
                    </Text>
                  </View>
                </View>
                <View style={{ backgroundColor: '#e5eeff', borderRadius: scale(10), paddingHorizontal: scale(10), paddingVertical: scale(5) }}>
                  <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: '#82d8ff' }}>
                    {new Date(appt.scheduledAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Dakar' })}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
