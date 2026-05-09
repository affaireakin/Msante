import { ScrollView, View, Text, TouchableOpacity, Alert, StatusBar } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useAgenda, type AgendaAppointment } from '@/features/practitioner/hooks/useAgenda'
import {
  approveAppointment,
  declineAppointment,
} from '@/features/practitioner/services/appointmentActions'
import { GlassCard } from '@/components/ui/GlassCard'

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function InitialsAvatar({ initials }: { initials: string }) {
  return (
    <View
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#006685',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{ color: '#fff', fontFamily: 'Manrope', fontWeight: '700', fontSize: 16 }}
      >
        {initials}
      </Text>
    </View>
  )
}

function AppointmentCard({
  appt,
  onApprove,
  onDecline,
  isWorking,
}: {
  appt: AgendaAppointment
  onApprove: () => void
  onDecline: () => void
  isWorking: boolean
}) {
  return (
    <GlassCard style={{ gap: 16 }}>
      {/* Patient info */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <InitialsAvatar initials={appt.patientInitials} />
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: 'Manrope',
              fontSize: 15,
              fontWeight: '600',
              color: '#0b1c30',
            }}
          >
            {appt.patientName}
          </Text>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}
          >
            <MaterialIcons
              name={appt.consultationType === 'Telehealth' ? 'videocam' : 'local-hospital'}
              size={14}
              color="#6f787e"
            />
            <Text style={{ fontFamily: 'Manrope', fontSize: 13, color: '#6f787e' }}>
              {appt.consultationType}
            </Text>
          </View>
        </View>
      </View>

      {/* Date chip */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 12,
          backgroundColor: '#eff4ff',
        }}
      >
        <MaterialIcons name="event" size={16} color="#006685" />
        <Text
          style={{
            fontFamily: 'Manrope',
            fontSize: 13,
            color: '#006685',
            fontWeight: '500',
          }}
        >
          {formatDateTime(appt.scheduledAt)}
        </Text>
      </View>

      {/* Patient note */}
      {appt.notes ? (
        <Text
          style={{
            fontFamily: 'Manrope',
            fontSize: 13,
            color: '#3f484d',
            lineHeight: 18,
            fontStyle: 'italic',
          }}
          numberOfLines={2}
        >
          "{appt.notes}"
        </Text>
      ) : null}

      {/* Actions */}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <TouchableOpacity
          onPress={onApprove}
          disabled={isWorking}
          style={{
            flex: 1,
            paddingVertical: 12,
            borderRadius: 999,
            alignItems: 'center',
            backgroundColor: '#006685',
            opacity: isWorking ? 0.5 : 1,
          }}
        >
          <Text
            style={{ fontFamily: 'Manrope', fontSize: 14, fontWeight: '700', color: '#fff' }}
          >
            Approuver
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          disabled={isWorking}
          style={{
            flex: 1,
            paddingVertical: 12,
            borderRadius: 999,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#bec8ce',
            backgroundColor: 'rgba(255,255,255,0.60)',
          }}
        >
          <Text
            style={{
              fontFamily: 'Manrope',
              fontSize: 14,
              fontWeight: '600',
              color: '#006685',
            }}
          >
            Reprogrammer
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onDecline}
          disabled={isWorking}
          style={{
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 999,
            alignItems: 'center',
            opacity: isWorking ? 0.5 : 1,
          }}
        >
          <Text
            style={{ fontFamily: 'Manrope', fontSize: 14, fontWeight: '600', color: '#ba1a1a' }}
          >
            Refuser
          </Text>
        </TouchableOpacity>
      </View>
    </GlassCard>
  )
}

export default function AgendaScreen() {
  const { practitioner } = useAuth()
  const queryClient = useQueryClient()
  const { data, isLoading } = useAgenda(practitioner?.id ?? '')

  const approveMutation = useMutation({
    mutationFn: ({
      appointmentId,
      patientId,
    }: {
      appointmentId: string
      patientId: string
    }) => approveAppointment(appointmentId, patientId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['practitioner-agenda'] }),
    onError: () => Alert.alert('Erreur', "Impossible d'approuver ce rendez-vous."),
  })

  const declineMutation = useMutation({
    mutationFn: ({
      appointmentId,
      patientId,
    }: {
      appointmentId: string
      patientId: string
    }) => declineAppointment(appointmentId, patientId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['practitioner-agenda'] }),
    onError: () => Alert.alert('Erreur', 'Impossible de refuser ce rendez-vous.'),
  })

  const isWorking = approveMutation.isPending || declineMutation.isPending
  const pendingCount = data?.pending?.length ?? 0

  const handleDecline = (appt: AgendaAppointment) => {
    Alert.alert('Refuser ce RDV ?', 'Le patient sera notifié.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Refuser',
        style: 'destructive',
        onPress: () =>
          declineMutation.mutate({
            appointmentId: appt.id,
            patientId: appt.patientId,
          }),
      },
    ])
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 24,
          height: 64,
          backgroundColor: 'rgba(255,255,255,0.70)',
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.20)',
        }}
      >
        <Text
          style={{
            fontFamily: 'Manrope',
            fontSize: 22,
            fontWeight: '600',
            color: '#0284c7',
            letterSpacing: -0.3,
          }}
        >
          Appointments
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 24, gap: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Pending Approvals */}
        <View style={{ gap: 12 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text
              style={{
                fontFamily: 'Manrope',
                fontSize: 15,
                fontWeight: '600',
                color: '#0b1c30',
              }}
            >
              Pending Approvals
            </Text>
            {pendingCount > 0 && (
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 999,
                  backgroundColor: '#82d8ff',
                }}
              >
                <Text
                  style={{
                    fontFamily: 'Manrope',
                    fontSize: 11,
                    fontWeight: '700',
                    color: '#005e7a',
                  }}
                >
                  {pendingCount} Requests
                </Text>
              </View>
            )}
          </View>

          {isLoading ? (
            [1, 2].map((i) => (
              <View
                key={i}
                style={{ height: 176, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.40)' }}
              />
            ))
          ) : pendingCount === 0 ? (
            <GlassCard>
              <Text
                style={{
                  fontFamily: 'Manrope',
                  fontSize: 14,
                  color: '#6f787e',
                  textAlign: 'center',
                  paddingVertical: 8,
                }}
              >
                Aucune demande en attente
              </Text>
            </GlassCard>
          ) : (
            data?.pending.map((appt) => (
              <AppointmentCard
                key={appt.id}
                appt={appt}
                onApprove={() =>
                  approveMutation.mutate({
                    appointmentId: appt.id,
                    patientId: appt.patientId,
                  })
                }
                onDecline={() => handleDecline(appt)}
                isWorking={isWorking}
              />
            ))
          )}
        </View>

        {/* Confirmed today */}
        {(data?.confirmed ?? []).length > 0 && (
          <View style={{ gap: 12 }}>
            <Text
              style={{
                fontFamily: 'Manrope',
                fontSize: 15,
                fontWeight: '600',
                color: '#0b1c30',
              }}
            >
              Confirmés aujourd'hui
            </Text>
            {data?.confirmed.map((appt) => (
              <GlassCard key={appt.id}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: '#e5eeff',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: 'Manrope',
                          fontSize: 13,
                          fontWeight: '700',
                          color: '#006685',
                        }}
                      >
                        {appt.patientInitials}
                      </Text>
                    </View>
                    <View>
                      <Text
                        style={{
                          fontFamily: 'Manrope',
                          fontSize: 14,
                          fontWeight: '600',
                          color: '#0b1c30',
                        }}
                      >
                        {appt.patientName}
                      </Text>
                      <Text
                        style={{ fontFamily: 'Manrope', fontSize: 12, color: '#6f787e' }}
                      >
                        {appt.consultationType}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 4,
                      borderRadius: 999,
                      backgroundColor: '#bee9ff',
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: 'Manrope',
                        fontSize: 11,
                        fontWeight: '700',
                        color: '#004d65',
                      }}
                    >
                      {new Date(appt.scheduledAt).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                </View>
              </GlassCard>
            ))}
          </View>
        )}

        <View style={{ height: 16 }} />
      </ScrollView>
    </SafeAreaView>
  )
}
