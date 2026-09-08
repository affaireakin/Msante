import { useState } from 'react'
import { ScrollView, View, Text, TouchableOpacity, Alert, RefreshControl, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/hooks/useAuth'
import {
  useAgenda, dayKey, startOfWeek, weekDays,
  type AgendaAppointment,
} from '@/features/practitioner/hooks/useAgenda'
import {
  approveAppointment,
  declineAppointment,
} from '@/features/practitioner/services/appointmentActions'
import { useResponsive } from '@/hooks/useResponsive'

// Écran d'accueil praticien refondu sur la référence fournie (agenda type
// Doctolib) : bandeau d'identité, sélecteur de jour de la semaine, résumé de
// la journée, puis la journée en timeline avec l'heure en gouttière. On ne
// montre que des données réellement présentes en base (pas de "Box 03" ni de
// nom de cabinet inventés) : patient, type de séance, durée, motif, paiement.

const TZ = 'Africa/Dakar'
const DAY_SHORT = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM']

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
}

function isVideoType(t: string) {
  return t === 'video' || t === 'audio'
}

function typeLabel(t: string) {
  switch (t) {
    case 'video': return 'Téléconsultation vidéo'
    case 'audio': return 'Téléconsultation audio'
    case 'chat': return 'Messagerie'
    default: return 'Présentiel'
  }
}

const PROVIDER_LABEL: Record<string, string> = {
  wave: 'Wave', orange_money: 'Orange Money', stripe: 'Carte', card: 'Carte',
}

/** Une consultation est "en cours" entre son début et sa fin théorique. */
function isLive(appt: AgendaAppointment) {
  const start = new Date(appt.scheduledAt).getTime()
  const end = start + appt.durationMin * 60 * 1000
  const now = Date.now()
  return now >= start && now <= end && appt.status === 'confirmed'
}

function isPast(appt: AgendaAppointment) {
  return new Date(appt.scheduledAt).getTime() + appt.durationMin * 60 * 1000 < Date.now()
}

function InitialsAvatar({ initials, size, bg = '#e5eeff', color = '#006685' }: {
  initials: string; size: number; bg?: string; color?: string
}) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color, fontFamily: 'Manrope', fontWeight: '800', fontSize: size * 0.36 }}>{initials}</Text>
    </View>
  )
}

function Chip({ icon, label, bg, color }: {
  icon?: React.ComponentProps<typeof MaterialIcons>['name']; label: string; bg: string; color: string
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: bg }}>
      {icon && <MaterialIcons name={icon} size={12} color={color} />}
      <Text style={{ fontFamily: 'Manrope', fontSize: 11, fontWeight: '700', color }}>{label}</Text>
    </View>
  )
}

// ── Carte d'un rendez-vous dans la timeline ─────────────────────────────────

function AgendaCard({ appt, onJoin, onApprove, onDecline, isWorking, scale, fs }: {
  appt: AgendaAppointment
  onJoin: () => void
  onApprove: () => void
  onDecline: () => void
  isWorking: boolean
  scale: (n: number) => number
  fs: { xs: number; sm: number; md: number }
}) {
  const live = isLive(appt)
  const past = isPast(appt)
  const pending = appt.status === 'pending'
  const video = isVideoType(appt.type)
  const pay = appt.payment

  return (
    <View style={{ flexDirection: 'row', gap: scale(10) }}>
      {/* Gouttière horaire */}
      <View style={{ width: scale(52), alignItems: 'flex-end', paddingTop: scale(12) }}>
        <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '700', color: live ? '#ba1a1a' : past ? '#bec8ce' : '#0b1c30' }}>
          {timeLabel(appt.scheduledAt)}
        </Text>
        <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#bec8ce', marginTop: 1 }}>
          {appt.durationMin} min
        </Text>
      </View>

      {/* Carte */}
      <View style={{
        flex: 1, marginBottom: scale(12), borderRadius: scale(16), padding: scale(12),
        backgroundColor: past ? 'rgba(255,255,255,0.55)' : '#fff',
        borderWidth: live ? 2 : 1,
        borderColor: live ? '#1d7a3a' : pending ? '#ffe170' : '#e5eeff',
        opacity: past ? 0.75 : 1,
      }}>
        {live && (
          <View style={{ alignSelf: 'flex-start', marginBottom: scale(8), paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: '#1d7a3a' }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.5 }}>EN COURS</Text>
          </View>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(10) }}>
          <InitialsAvatar initials={appt.patientInitials} size={scale(34)} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.md, fontWeight: '700', color: past ? '#6f787e' : '#0b1c30' }} numberOfLines={1}>
              {appt.patientName}
            </Text>
          </View>
          {past && !pending && (
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: '#1d7a3a' }}>✓ Honoré</Text>
          )}
          {pending && (
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: '#705d00' }}>À confirmer</Text>
          )}
        </View>

        {/* Chips : type de séance + paiement */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: scale(6), marginTop: scale(8) }}>
          <Chip
            icon={video ? 'videocam' : 'location-on'}
            label={typeLabel(appt.type)}
            bg="#e5eeff"
            color="#006685"
          />
          {pay?.status === 'completed' ? (
            <Chip icon="check-circle" label={`Payé${pay.provider ? ` · ${PROVIDER_LABEL[pay.provider] ?? pay.provider}` : ''}`} bg="#e8f5e9" color="#1d7a3a" />
          ) : pay?.amount != null ? (
            <Chip icon="schedule" label={`${pay.amount.toLocaleString('fr-FR')} ${pay.currency ?? 'XOF'} à régler`} bg="#fff8e1" color="#705d00" />
          ) : null}
        </View>

        {appt.notes ? (
          <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, color: '#3f484d', marginTop: scale(8) }} numberOfLines={2}>
            Motif : {appt.notes}
          </Text>
        ) : null}

        {/* Actions */}
        {pending ? (
          <View style={{ flexDirection: 'row', gap: scale(8), marginTop: scale(10) }}>
            <TouchableOpacity
              onPress={onApprove}
              disabled={isWorking}
              style={{ flex: 1, paddingVertical: scale(10), borderRadius: 999, alignItems: 'center', backgroundColor: '#82d8ff', opacity: isWorking ? 0.5 : 1 }}
            >
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '800', color: '#0b1c30' }}>Approuver</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onDecline}
              disabled={isWorking}
              style={{ flex: 1, paddingVertical: scale(10), borderRadius: 999, alignItems: 'center', borderWidth: 1, borderColor: '#ba1a1a', opacity: isWorking ? 0.5 : 1 }}
            >
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '700', color: '#ba1a1a' }}>Refuser</Text>
            </TouchableOpacity>
          </View>
        ) : live && video ? (
          <TouchableOpacity
            onPress={onJoin}
            style={{ marginTop: scale(10), paddingVertical: scale(11), borderRadius: 999, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: scale(6), backgroundColor: '#1d7a3a' }}
          >
            <MaterialIcons name="play-arrow" size={scale(18)} color="#fff" />
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '800', color: '#fff' }}>Rejoindre</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  )
}

// ── Écran ───────────────────────────────────────────────────────────────────

export default function AgendaScreen() {
  const { profile, practitioner } = useAuth()
  const { px, fs, scale } = useResponsive()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [selectedDate, setSelectedDate] = useState(new Date())
  const { data, isLoading, refetch, isRefetching } = useAgenda(practitioner?.id ?? '', selectedDate)

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
  const dayAppointments = data?.day ?? []
  const countsByDay = data?.countsByDay ?? {}
  const pendingCount = (data?.pending ?? []).length

  const videoCount = dayAppointments.filter(a => isVideoType(a.type)).length
  const inPersonCount = dayAppointments.length - videoCount

  const initials = (profile?.full_name ?? 'P').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  const days = weekDays(startOfWeek(selectedDate))
  const todayKey = dayKey(new Date())
  const selectedKey = dayKey(selectedDate)

  const handleDecline = (appt: AgendaAppointment) => {
    Alert.alert('Refuser ce RDV ?', 'Le patient sera notifié.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Refuser', style: 'destructive', onPress: () => declineMutation.mutate({ appointmentId: appt.id, patientId: appt.patientId }) },
    ])
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }} edges={['top']}>
      {/* ── Bandeau d'identité ── */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: scale(10),
        paddingHorizontal: px, paddingVertical: scale(12),
        backgroundColor: 'rgba(255,255,255,0.85)',
        borderBottomWidth: 1, borderBottomColor: 'rgba(229,238,255,0.8)',
      }}>
        <InitialsAvatar initials={initials} size={scale(40)} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'Manrope', fontSize: fs.md, fontWeight: '800', color: '#0b1c30' }} numberOfLines={1}>
            {profile?.full_name ?? 'Praticien'}
          </Text>
          {practitioner?.speciality ? (
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#6f787e' }} numberOfLines={1}>
              {practitioner.speciality}
            </Text>
          ) : null}
        </View>

        <TouchableOpacity
          onPress={() => router.push('/(practitioner)/notifications')}
          style={{ width: scale(36), height: scale(36), borderRadius: scale(18), backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}
        >
          <MaterialIcons name="notifications-none" size={scale(19)} color="#0b1c30" />
          {pendingCount > 0 && (
            <View style={{ position: 'absolute', top: scale(7), right: scale(7), width: scale(8), height: scale(8), borderRadius: scale(4), backgroundColor: '#ba1a1a', borderWidth: 1.5, borderColor: '#fff' }} />
          )}
        </TouchableOpacity>

        {/* Paramètres déplacé ici (haut à droite), retiré de la barre d'onglets */}
        <TouchableOpacity
          onPress={() => router.push('/(practitioner)/profile')}
          style={{ width: scale(36), height: scale(36), borderRadius: scale(18), backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}
        >
          <MaterialIcons name="settings" size={scale(19)} color="#006685" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: scale(110) }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#82d8ff" />}
      >
        {/* ── Date + sélecteur de jour ── */}
        <View style={{ paddingHorizontal: px, paddingTop: scale(16) }}>
          <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '800', color: '#82d8ff', letterSpacing: 1 }}>
            {selectedKey === todayKey ? "AUJOURD'HUI" : 'JOURNÉE'}
          </Text>
          <Text style={{ fontFamily: 'Manrope', fontSize: fs.xl, fontWeight: '800', color: '#0b1c30', marginTop: 2 }}>
            {selectedDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ })}
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: px, gap: scale(8), paddingVertical: scale(14) }}
        >
          {days.map(d => {
            const k = dayKey(d)
            const active = k === selectedKey
            const count = countsByDay[k] ?? 0
            return (
              <TouchableOpacity
                key={k}
                onPress={() => setSelectedDate(d)}
                style={{
                  width: scale(52), paddingVertical: scale(10), borderRadius: scale(14), alignItems: 'center',
                  backgroundColor: active ? '#006685' : '#fff',
                  borderWidth: 1, borderColor: active ? '#006685' : '#e5eeff',
                }}
              >
                <Text style={{ fontFamily: 'Manrope', fontSize: 10, fontWeight: '700', color: active ? 'rgba(255,255,255,0.8)' : '#6f787e' }}>
                  {DAY_SHORT[d.getDay()]}
                </Text>
                <Text style={{ fontFamily: 'Manrope', fontSize: fs.md, fontWeight: '800', color: active ? '#fff' : '#0b1c30', marginTop: 2 }}>
                  {d.getDate()}
                </Text>
                <View style={{
                  width: scale(5), height: scale(5), borderRadius: scale(3), marginTop: scale(5),
                  backgroundColor: count > 0 ? (active ? '#ffde5c' : '#82d8ff') : 'transparent',
                }} />
              </TouchableOpacity>
            )
          })}
        </ScrollView>

        {/* ── Résumé de la journée ── */}
        <View style={{
          marginHorizontal: px, padding: scale(12), borderRadius: scale(14),
          backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5eeff',
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: scale(8),
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(8), flex: 1 }}>
            <View style={{ width: scale(7), height: scale(7), borderRadius: scale(4), backgroundColor: dayAppointments.length > 0 ? '#1d7a3a' : '#bec8ce' }} />
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '700', color: '#0b1c30', flex: 1 }}>
              {dayAppointments.length} rendez-vous {selectedKey === todayKey ? "prévus aujourd'hui" : 'ce jour-là'}
            </Text>
          </View>
          {dayAppointments.length > 0 && (
            <Chip label={`${videoCount} Vidéo · ${inPersonCount} Présentiel`} bg="#e5eeff" color="#006685" />
          )}
        </View>

        {/* ── Timeline ── */}
        <View style={{ paddingHorizontal: px, paddingTop: scale(16) }}>
          {isLoading ? (
            <View style={{ paddingVertical: scale(40), alignItems: 'center' }}>
              <ActivityIndicator color="#82d8ff" />
            </View>
          ) : dayAppointments.length === 0 ? (
            <View style={{ paddingVertical: scale(40), alignItems: 'center', gap: scale(10) }}>
              <View style={{ width: scale(64), height: scale(64), borderRadius: scale(32), backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcons name="event-available" size={scale(30)} color="#82d8ff" />
              </View>
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.md, fontWeight: '700', color: '#0b1c30' }}>
                Aucun rendez-vous ce jour
              </Text>
              <TouchableOpacity onPress={() => router.push('/(practitioner)/availability')}>
                <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '700', color: '#82d8ff' }}>
                  Gérer mes disponibilités
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            dayAppointments.map(appt => (
              <AgendaCard
                key={appt.id}
                appt={appt}
                scale={scale}
                fs={fs}
                isWorking={isWorking}
                onJoin={() => router.push(`/(practitioner)/consultation/${appt.id}` as never)}
                onApprove={() => approveMutation.mutate({ appointmentId: appt.id, patientId: appt.patientId })}
                onDecline={() => handleDecline(appt)}
              />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
