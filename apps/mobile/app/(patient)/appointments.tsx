import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/features/auth/store/authStore'
import { useResponsive } from '@/hooks/useResponsive'
import type { AppointmentStatus, SessionType } from '@/types/booking'

interface AppointmentRow {
  id: string
  scheduled_at: string
  duration_min: number
  status: AppointmentStatus
  type: SessionType
  notes: string | null
  practitioners: {
    id: string
    speciality: string
    session_price: number
    session_currency: string
    users: { full_name: string; avatar_url: string | null }
  } | null
}

const STATUS_CONFIG: Record<AppointmentStatus, {
  label: string; bg: string; text: string
  icon: React.ComponentProps<typeof MaterialIcons>['name']
}> = {
  pending:   { label: 'En attente', bg: '#fff8e1', text: '#705d00', icon: 'schedule' },
  confirmed: { label: 'Confirmé',   bg: '#e8f5e9', text: '#1d7a3a', icon: 'check-circle' },
  cancelled: { label: 'Annulé',     bg: '#fce4ec', text: '#ba1a1a', icon: 'cancel' },
  completed: { label: 'Terminé',    bg: '#e5eeff', text: '#006685', icon: 'task-alt' },
  no_show:   { label: 'Absent',     bg: '#f5f5f5', text: '#6f787e', icon: 'person-off' },
}

const TYPE_ICON: Record<string, React.ComponentProps<typeof MaterialIcons>['name']> = {
  video:      'videocam',
  audio:      'mic',
  presentiel: 'location-on',
  chat:       'chat',
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
}

const TZ = { timeZone: 'Africa/Dakar' }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'long', ...TZ,
  })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', ...TZ })
}

function isUpcoming(iso: string) {
  return new Date(iso) > new Date()
}

function AppointmentCard({ appt, onJoin, onCancel }: { appt: AppointmentRow; onJoin: () => void; onCancel: () => void }) {
  const { px, fs, scale } = useResponsive()
  const status = STATUS_CONFIG[appt.status]
  const practitioner = appt.practitioners
  const name = practitioner?.users?.full_name ?? 'Praticien inconnu'
  const speciality = practitioner?.speciality ?? ''
  const price = practitioner?.session_price
  const currency = practitioner?.session_currency ?? 'XOF'
  const upcoming = isUpcoming(appt.scheduled_at)
  const canJoin = appt.status === 'confirmed' && upcoming && appt.type === 'video'
  const canCancel = upcoming && (appt.status === 'pending' || appt.status === 'confirmed')

  return (
    <View style={{
      backgroundColor: 'rgba(255,255,255,0.90)',
      borderRadius: scale(20),
      marginBottom: scale(14),
      borderWidth: 1,
      borderColor: '#e5eeff',
      overflow: 'hidden',
      shadowColor: '#006685',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 2,
    }}>
      {/* Top band: date + type */}
      <View style={{ backgroundColor: '#f8f9ff', paddingHorizontal: scale(16), paddingVertical: scale(10), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#e5eeff' }}>
        <Text style={{ fontSize: fs.sm, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope' }}>
          {formatDate(appt.scheduled_at)} · {formatTime(appt.scheduled_at)}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(6) }}>
          <MaterialIcons name={TYPE_ICON[appt.type] ?? 'videocam'} size={scale(16)} color="#6f787e" />
          <Text style={{ fontSize: fs.xs, color: '#6f787e', fontFamily: 'Manrope' }}>{appt.duration_min} min</Text>
        </View>
      </View>

      {/* Body */}
      <View style={{ padding: scale(16), flexDirection: 'row', alignItems: 'center', gap: scale(14) }}>
        {/* Avatar initiales */}
        <View style={{ width: scale(52), height: scale(52), borderRadius: scale(26), backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: scale(18), fontWeight: '800', color: '#006685', fontFamily: 'Manrope' }}>
            {initials(name)}
          </Text>
        </View>

        {/* Info */}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: fs.md, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope' }}>
            {name}
          </Text>
          <Text style={{ fontSize: fs.sm, color: '#006685', fontFamily: 'Manrope', fontWeight: '600', marginTop: 1 }}>
            {speciality}
          </Text>
          {price != null && (
            <Text style={{ fontSize: fs.sm, color: '#705d00', fontFamily: 'Manrope', fontWeight: '600', marginTop: 2 }}>
              {price.toLocaleString('fr-FR')} {currency}
            </Text>
          )}
        </View>

        {/* Status badge */}
        <View style={{ backgroundColor: status.bg, borderRadius: scale(10), paddingHorizontal: scale(10), paddingVertical: scale(5), alignItems: 'center', gap: 2 }}>
          <MaterialIcons name={status.icon} size={scale(16)} color={status.text} />
          <Text style={{ fontSize: scale(9), fontWeight: '700', color: status.text, fontFamily: 'Manrope' }}>
            {status.label}
          </Text>
        </View>
      </View>

      {/* Action buttons */}
      {(canJoin || canCancel) && (
        <View style={{ paddingHorizontal: scale(16), paddingBottom: scale(16), flexDirection: 'row', gap: scale(8) }}>
          {canJoin && (
            <TouchableOpacity
              onPress={onJoin}
              style={{ flex: 1, backgroundColor: '#006685', borderRadius: scale(14), paddingVertical: scale(13), alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: scale(8) }}
            >
              <MaterialIcons name="videocam" size={scale(18)} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: fs.md, fontFamily: 'Manrope' }}>Rejoindre</Text>
            </TouchableOpacity>
          )}
          {canCancel && (
            <TouchableOpacity
              onPress={onCancel}
              style={{ flex: canJoin ? 0 : 1, paddingHorizontal: scale(16), backgroundColor: '#fce4ec', borderRadius: scale(14), paddingVertical: scale(13), alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: scale(6) }}
            >
              <MaterialIcons name="cancel" size={scale(17)} color="#ba1a1a" />
              {!canJoin && <Text style={{ color: '#ba1a1a', fontWeight: '700', fontSize: fs.md, fontFamily: 'Manrope' }}>Annuler</Text>}
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Notes */}
      {appt.notes && (
        <View style={{ marginHorizontal: scale(16), marginBottom: scale(14), padding: scale(10), backgroundColor: '#f8f9ff', borderRadius: scale(10), borderWidth: 1, borderColor: '#e5eeff', flexDirection: 'row', alignItems: 'flex-start', gap: scale(8) }}>
          <MaterialIcons name="notes" size={scale(14)} color="#6f787e" style={{ marginTop: 1 }} />
          <Text style={{ flex: 1, fontSize: fs.sm, color: '#3f484d', fontFamily: 'Manrope', lineHeight: scale(18) }}>
            {appt.notes}
          </Text>
        </View>
      )}
    </View>
  )
}

export default function AppointmentsScreen() {
  const router = useRouter()
  const { profile } = useAuthStore()
  const { px, fs, scale } = useResponsive()

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['patient-appointments', profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id, scheduled_at, duration_min, status, type, notes,
          practitioners (
            id, speciality, session_price, session_currency,
            users ( full_name, avatar_url )
          )
        `)
        .eq('patient_id', profile!.id)
        .order('scheduled_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as unknown as AppointmentRow[]
    },
  })

  const qc = useQueryClient()
  const upcoming = (data ?? []).filter(a => isUpcoming(a.scheduled_at) && a.status !== 'cancelled')
  const past = (data ?? []).filter(a => !isUpcoming(a.scheduled_at) || a.status === 'cancelled')

  function handleJoin(appt: AppointmentRow) {
    router.push(`/(patient)/consultation/waiting?appointmentId=${appt.id}` as never)
  }

  function handleCancel(appt: AppointmentRow) {
    Alert.alert(
      'Annuler le rendez-vous',
      `Souhaitez-vous annuler le rendez-vous du ${formatDate(appt.scheduled_at)} à ${formatTime(appt.scheduled_at)} ?`,
      [
        { text: 'Retour', style: 'cancel' },
        {
          text: 'Confirmer l\'annulation',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('appointments')
              .update({ status: 'cancelled', cancellation_reason: 'Annulé par le patient' })
              .eq('id', appt.id)
            if (!error) qc.invalidateQueries({ queryKey: ['patient-appointments'] })
          },
        },
      ]
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      {/* Header */}
      <View style={{ paddingHorizontal: px, paddingTop: scale(20), paddingBottom: scale(16), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text style={{ fontSize: fs.xxl, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope', letterSpacing: -0.5 }}>
            Mes rendez-vous
          </Text>
          <Text style={{ fontSize: fs.sm, color: '#6f787e', fontFamily: 'Manrope', marginTop: 2 }}>
            {upcoming.length} à venir · {past.length} passés
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/(patient)/find-practitioners')}
          style={{ backgroundColor: '#006685', borderRadius: scale(14), paddingHorizontal: scale(14), paddingVertical: scale(10), flexDirection: 'row', alignItems: 'center', gap: scale(6) }}
        >
          <MaterialIcons name="add" size={scale(18)} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: fs.sm, fontFamily: 'Manrope' }}>Nouveau</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: scale(12) }}>
          <ActivityIndicator size="large" color="#006685" />
          <Text style={{ color: '#6f787e', fontFamily: 'Manrope', fontSize: fs.sm }}>
            Chargement…
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: px, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#006685"
            />
          }
        >
          {/* Upcoming */}
          {upcoming.length > 0 && (
            <View style={{ marginBottom: scale(8) }}>
              <Text style={{ fontSize: fs.xs, fontWeight: '700', color: '#006685', letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'Manrope', marginBottom: scale(14) }}>
                À venir
              </Text>
              {upcoming.map(a => (
                <AppointmentCard key={a.id} appt={a} onJoin={() => handleJoin(a)} onCancel={() => handleCancel(a)} />
              ))}
            </View>
          )}

          {/* Past */}
          {past.length > 0 && (
            <View>
              <Text style={{ fontSize: fs.xs, fontWeight: '700', color: '#6f787e', letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'Manrope', marginBottom: scale(14), marginTop: upcoming.length > 0 ? scale(8) : 0 }}>
                Historique
              </Text>
              {past.map(a => (
                <AppointmentCard key={a.id} appt={a} onJoin={() => handleJoin(a)} onCancel={() => handleCancel(a)} />
              ))}
            </View>
          )}

          {/* Empty state */}
          {(data ?? []).length === 0 && (
            <View style={{ alignItems: 'center', paddingTop: scale(60) }}>
              <View style={{ width: scale(80), height: scale(80), borderRadius: scale(40), backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center', marginBottom: scale(16) }}>
                <MaterialIcons name="calendar-today" size={scale(38)} color="#006685" />
              </View>
              <Text style={{ fontSize: fs.xl, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope', marginBottom: scale(8) }}>
                Aucun rendez-vous
              </Text>
              <Text style={{ fontSize: fs.md, color: '#6f787e', fontFamily: 'Manrope', textAlign: 'center', lineHeight: scale(22), marginBottom: scale(28), paddingHorizontal: scale(20) }}>
                Réservez votre première consultation avec un professionnel de santé.
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/(patient)/find-practitioners')}
                style={{ backgroundColor: '#006685', borderRadius: scale(16), paddingHorizontal: scale(24), paddingVertical: scale(14), flexDirection: 'row', alignItems: 'center', gap: scale(8) }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: fs.md, fontFamily: 'Manrope' }}>
                  Trouver un praticien
                </Text>
                <MaterialIcons name="arrow-forward" size={scale(18)} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
