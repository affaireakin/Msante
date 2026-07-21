import { useState } from 'react'
import { ScrollView, View, Text, TouchableOpacity, Alert, RefreshControl, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSecretaryAppointments, type SecretaryAppointment } from '@/features/secretary/hooks/useSecretaryAppointments'
import { approveAppointment, declineAppointment } from '@/features/practitioner/services/appointmentActions'
import { supabase } from '@/services/supabase'
import { useResponsive } from '@/hooks/useResponsive'
import { APPOINTMENT_STATUS_STYLES } from '@/types/booking'

type Filter = 'today' | 'upcoming' | 'past'

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    timeZone: 'Africa/Dakar',
  })
}

function AppointmentCard({ appt }: { appt: SecretaryAppointment }) {
  const { fs, scale } = useResponsive()
  const queryClient = useQueryClient()
  const statusStyle = APPOINTMENT_STATUS_STYLES[appt.status as keyof typeof APPOINTMENT_STATUS_STYLES] ?? APPOINTMENT_STATUS_STYLES.pending

  const approve = useMutation({
    mutationFn: () => approveAppointment(appt.id, appt.patientId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['secretary-appointments'] }),
    onError: () => Alert.alert('Erreur', "Impossible d'approuver ce rendez-vous."),
  })

  const decline = useMutation({
    mutationFn: () => declineAppointment(appt.id, appt.patientId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['secretary-appointments'] }),
    onError: () => Alert.alert('Erreur', "Impossible d'annuler ce rendez-vous."),
  })

  const handleDecline = () => {
    Alert.alert('Annuler ce RDV ?', 'Le patient sera notifié.', [
      { text: 'Retour', style: 'cancel' },
      { text: 'Annuler le RDV', style: 'destructive', onPress: () => decline.mutate() },
    ])
  }

  const isWorking = approve.isPending || decline.isPending

  return (
    <View style={{
      backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: scale(16),
      borderWidth: 1, borderColor: '#e5eeff', padding: scale(14), gap: scale(10),
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'Manrope', fontSize: fs.md, fontWeight: '700', color: '#0b1c30' }}>
            {appt.patientName}
          </Text>
          {!!appt.practitionerName && (
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, color: '#6f787e', marginTop: 1 }}>
              Dr. {appt.practitionerName}
            </Text>
          )}
        </View>
        <View style={{ backgroundColor: statusStyle.bg, borderRadius: scale(20), paddingHorizontal: scale(10), paddingVertical: scale(4) }}>
          <Text style={{ fontSize: scale(10), fontWeight: '700', color: statusStyle.text, fontFamily: 'Manrope' }}>
            {statusStyle.label}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(8) }}>
        <MaterialIcons name="event" size={scale(14)} color="#82d8ff" />
        <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, color: '#3f484d' }}>{formatDateTime(appt.scheduledAt)}</Text>
        <MaterialIcons name={appt.consultationType === 'Telehealth' ? 'videocam' : appt.consultationType === 'Audio' ? 'mic' : 'location-on'} size={scale(14)} color="#6f787e" style={{ marginLeft: scale(4) }} />
        <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, color: '#6f787e' }}>{appt.consultationType}</Text>
      </View>

      {(appt.status === 'pending' || appt.status === 'confirmed') && (
        <View style={{ flexDirection: 'row', gap: scale(8), paddingTop: scale(4) }}>
          {appt.status === 'pending' && (
            <TouchableOpacity
              onPress={() => approve.mutate()}
              disabled={isWorking}
              style={{ flex: 1, paddingVertical: scale(10), borderRadius: 9999, alignItems: 'center', backgroundColor: '#82d8ff', opacity: isWorking ? 0.5 : 1 }}
            >
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '800', color: '#0b1c30' }}>Confirmer</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={handleDecline}
            disabled={isWorking}
            style={{ flex: 1, paddingVertical: scale(10), borderRadius: 9999, alignItems: 'center', borderWidth: 1, borderColor: '#ba1a1a', opacity: isWorking ? 0.5 : 1 }}
          >
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '700', color: '#ba1a1a' }}>Annuler</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

export default function SecretaryAppointmentsScreen() {
  const { px, fs, scale } = useResponsive()
  const [filter, setFilter] = useState<Filter>('today')
  const { data, isLoading, refetch, isRefetching } = useSecretaryAppointments(filter)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }} edges={['top']}>
      <View style={{ paddingHorizontal: px, paddingTop: scale(16), paddingBottom: scale(12) }}>
        <Text style={{ fontFamily: 'Manrope', fontSize: fs.xxl, fontWeight: '800', color: '#0b1c30', letterSpacing: -0.5 }}>
          Rendez-vous
        </Text>
        <View style={{ flexDirection: 'row', gap: scale(8), marginTop: scale(12) }}>
          {([['today', "Aujourd'hui"], ['upcoming', 'À venir'], ['past', 'Passés']] as const).map(([key, label]) => (
            <TouchableOpacity
              key={key}
              onPress={() => setFilter(key)}
              style={{
                paddingHorizontal: scale(14), paddingVertical: scale(8), borderRadius: scale(20),
                backgroundColor: filter === key ? '#82d8ff' : 'rgba(255,255,255,0.7)',
                borderWidth: filter === key ? 0 : 1, borderColor: '#e5eeff',
              }}
            >
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '700', color: filter === key ? '#0b1c30' : '#6f787e' }}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#82d8ff" size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: px, paddingBottom: 100, gap: scale(12) }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#82d8ff" />}
        >
          {(data ?? []).length === 0 ? (
            <View style={{ alignItems: 'center', gap: scale(10), paddingTop: scale(48) }}>
              <MaterialIcons name="event-available" size={scale(40)} color="#bec8ce" />
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.md, fontWeight: '700', color: '#0b1c30' }}>Aucun rendez-vous</Text>
            </View>
          ) : (
            (data ?? []).map(appt => <AppointmentCard key={appt.id} appt={appt} />)
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
