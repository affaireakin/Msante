import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/features/auth/store/authStore'
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

const TYPE_ICON: Record<SessionType, React.ComponentProps<typeof MaterialIcons>['name']> = {
  video: 'videocam',
  audio: 'mic',
  chat:  'chat-bubble',
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase()
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function isUpcoming(iso: string) {
  return new Date(iso) > new Date()
}

function AppointmentCard({ appt, onJoin }: { appt: AppointmentRow; onJoin: () => void }) {
  const status = STATUS_CONFIG[appt.status]
  const practitioner = appt.practitioners
  const name = practitioner?.users?.full_name ?? 'Praticien inconnu'
  const speciality = practitioner?.speciality ?? ''
  const price = practitioner?.session_price
  const currency = practitioner?.session_currency ?? 'XOF'
  const upcoming = isUpcoming(appt.scheduled_at)
  const canJoin = appt.status === 'confirmed' && upcoming && appt.type === 'video'

  return (
    <View style={{
      backgroundColor: '#fff',
      borderRadius: 20,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: '#e5eeff',
      overflow: 'hidden',
      shadowColor: '#006685',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.05,
      shadowRadius: 12,
      elevation: 2,
    }}>
      {/* Top band: date + type */}
      <View style={{ backgroundColor: '#f8f9ff', paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#e5eeff' }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope' }}>
          {formatDate(appt.scheduled_at)} · {formatTime(appt.scheduled_at)}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <MaterialIcons name={TYPE_ICON[appt.type]} size={18} color="#6f787e" />
          <Text style={{ fontSize: 11, color: '#6f787e', fontFamily: 'Manrope' }}>{appt.duration_min} min</Text>
        </View>
      </View>

      {/* Body */}
      <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        {/* Avatar */}
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#006685', fontFamily: 'Manrope' }}>
            {initials(name)}
          </Text>
        </View>

        {/* Info */}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope' }}>
            {name}
          </Text>
          <Text style={{ fontSize: 12, color: '#6f787e', fontFamily: 'Manrope', marginTop: 2 }}>
            {speciality}
          </Text>
          {price != null && (
            <Text style={{ fontSize: 12, color: '#705d00', fontFamily: 'Manrope', fontWeight: '600', marginTop: 3 }}>
              {price.toLocaleString('fr-FR')} {currency}
            </Text>
          )}
        </View>

        {/* Status badge */}
        <View style={{ backgroundColor: status.bg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, alignItems: 'center', gap: 2 }}>
          <MaterialIcons name={status.icon} size={18} color={status.text} />
          <Text style={{ fontSize: 10, fontWeight: '700', color: status.text, fontFamily: 'Manrope' }}>
            {status.label}
          </Text>
        </View>
      </View>

      {/* Join button */}
      {canJoin && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <TouchableOpacity
            onPress={onJoin}
            style={{ backgroundColor: '#006685', borderRadius: 14, paddingVertical: 13, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
          >
            <MaterialIcons name="videocam" size={20} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14, fontFamily: 'Manrope' }}>
              Rejoindre la session
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Notes */}
      {appt.notes && (
        <View style={{ marginHorizontal: 16, marginBottom: 14, padding: 10, backgroundColor: '#f8f9ff', borderRadius: 10, borderWidth: 1, borderColor: '#e5eeff', flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <MaterialIcons name="notes" size={16} color="#6f787e" style={{ marginTop: 1 }} />
          <Text style={{ flex: 1, fontSize: 12, color: '#3f484d', fontFamily: 'Manrope', lineHeight: 18 }}>
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

  const upcoming = (data ?? []).filter(a => isUpcoming(a.scheduled_at) && a.status !== 'cancelled')
  const past = (data ?? []).filter(a => !isUpcoming(a.scheduled_at) || a.status === 'cancelled')

  function handleJoin(appt: AppointmentRow) {
    router.push(`/(patient)/consultation/waiting?appointmentId=${appt.id}` as never)
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope', letterSpacing: -0.5 }}>
            Mes rendez-vous
          </Text>
          <Text style={{ fontSize: 13, color: '#6f787e', fontFamily: 'Manrope', marginTop: 2 }}>
            {upcoming.length} à venir · {past.length} passés
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/(patient)/find-practitioners')}
          style={{ backgroundColor: '#006685', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          <MaterialIcons name="add" size={18} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13, fontFamily: 'Manrope' }}>Nouveau</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#006685" />
          <Text style={{ marginTop: 12, color: '#6f787e', fontFamily: 'Manrope', fontSize: 14 }}>
            Chargement…
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }}
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
            <View style={{ marginBottom: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#006685', letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'Manrope', marginBottom: 14 }}>
                À venir
              </Text>
              {upcoming.map(a => (
                <AppointmentCard key={a.id} appt={a} onJoin={() => handleJoin(a)} />
              ))}
            </View>
          )}

          {/* Past */}
          {past.length > 0 && (
            <View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#6f787e', letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'Manrope', marginBottom: 14, marginTop: upcoming.length > 0 ? 8 : 0 }}>
                Historique
              </Text>
              {past.map(a => (
                <AppointmentCard key={a.id} appt={a} onJoin={() => handleJoin(a)} />
              ))}
            </View>
          )}

          {/* Empty state */}
          {(data ?? []).length === 0 && (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <MaterialIcons name="calendar-today" size={40} color="#006685" />
              </View>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope', marginBottom: 8 }}>
                Aucun rendez-vous
              </Text>
              <Text style={{ fontSize: 14, color: '#6f787e', fontFamily: 'Manrope', textAlign: 'center', lineHeight: 22, marginBottom: 28, paddingHorizontal: 20 }}>
                Réservez votre première consultation avec un professionnel de santé.
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/(patient)/find-practitioners')}
                style={{ backgroundColor: '#006685', borderRadius: 16, paddingHorizontal: 24, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15, fontFamily: 'Manrope' }}>
                  Trouver un praticien
                </Text>
                <MaterialIcons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
