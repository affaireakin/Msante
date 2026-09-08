import { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Modal, TextInput,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/features/auth/store/authStore'
import { useResponsive } from '@/hooks/useResponsive'
import { APPOINTMENT_STATUS_STYLES, type AppointmentStatus, type SessionType } from '@/types/booking'

interface AppointmentRow {
  id: string
  scheduled_at: string
  duration_min: number
  status: AppointmentStatus
  type: SessionType
  notes: string | null
  created_by: string | null
  cancellation_reason: string | null
  practitioners: {
    id: string
    speciality: string
    session_price: number
    session_currency: string
    users: { full_name: string; avatar_url: string | null }
    // Embed PostgREST — tableau même pour une relation 1:1 (pas de schéma
    // généré côté client ici), cf. web/patient/appointments/page.tsx qui
    // gère déjà cette même incertitude défensivement.
    practitioner_booking_settings: { cancellation_deadline_hours: number | null }[] | { cancellation_deadline_hours: number | null } | null
  } | null
}

// Même règle que le web (patient/appointments/page.tsx) : au-delà du délai
// configuré par le praticien, le patient ne peut plus annuler lui-même —
// jusqu'ici mobile l'ignorait complètement et affichait "Annuler" sans
// condition.
function getDeadlineHours(appt: AppointmentRow): number | null {
  const settings = appt.practitioners?.practitioner_booking_settings
  const row = Array.isArray(settings) ? settings[0] : settings
  return row?.cancellation_deadline_hours ?? null
}
function isPastCancelDeadline(appt: AppointmentRow): boolean {
  const hours = getDeadlineHours(appt)
  if (hours === null) return false
  const deadline = new Date(appt.scheduled_at).getTime() - hours * 60 * 60 * 1000
  return Date.now() >= deadline
}

const STATUS_ICON: Record<AppointmentStatus, React.ComponentProps<typeof MaterialIcons>['name']> = {
  pending: 'schedule', confirmed: 'check-circle', cancelled: 'cancel', completed: 'task-alt', no_show: 'person-off',
}

const STATUS_CONFIG: Record<AppointmentStatus, {
  label: string; bg: string; text: string
  icon: React.ComponentProps<typeof MaterialIcons>['name']
}> = {
  pending:   { ...APPOINTMENT_STATUS_STYLES.pending,   icon: STATUS_ICON.pending },
  confirmed: { ...APPOINTMENT_STATUS_STYLES.confirmed, icon: STATUS_ICON.confirmed },
  cancelled: { ...APPOINTMENT_STATUS_STYLES.cancelled, icon: STATUS_ICON.cancelled },
  completed: { ...APPOINTMENT_STATUS_STYLES.completed, icon: STATUS_ICON.completed },
  no_show:   { ...APPOINTMENT_STATUS_STYLES.no_show,   icon: STATUS_ICON.no_show },
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

/**
 * Effective status for display. A confirmed/pending appointment whose time
 * has passed is shown as "Terminé" (done) — derived from the date, the DB row
 * is left untouched. Explicit terminal states (cancelled/no_show/completed)
 * are always respected.
 */
function effectiveStatus(appt: Pick<AppointmentRow, 'status' | 'scheduled_at'>): AppointmentStatus {
  if (appt.status === 'cancelled' || appt.status === 'no_show' || appt.status === 'completed') return appt.status
  return isUpcoming(appt.scheduled_at) ? appt.status : 'completed'
}

function AppointmentCard({ appt, onJoin, onCancel, onAccept, onDecline }: {
  appt: AppointmentRow; onJoin: () => void; onCancel: () => void; onAccept: () => void; onDecline: () => void
}) {
  const { px, fs, scale } = useResponsive()
  const status = STATUS_CONFIG[effectiveStatus(appt)]
  const practitioner = appt.practitioners
  const name = practitioner?.users?.full_name ?? 'Praticien inconnu'
  const speciality = practitioner?.speciality ?? ''
  const price = practitioner?.session_price
  const currency = practitioner?.session_currency ?? 'XOF'
  const upcoming = isUpcoming(appt.scheduled_at)
  // Video AND audio consultations both go through the same LiveKit waiting
  // room/session — only 'video' was wired here, so audio-only bookings had no
  // way to actually join their call.
  const canJoin = appt.status === 'confirmed' && upcoming && (appt.type === 'video' || appt.type === 'audio')
  // Créneau PROPOSÉ PAR LE PRATICIEN, encore en attente : le patient doit
  // l'accepter ou le refuser — ce n'est pas "sa" demande à annuler. Absent du
  // mobile jusqu'ici (même règle que web/patient/appointments/page.tsx).
  const isPractitionerProposal = appt.status === 'pending' && appt.created_by === 'practitioner' && upcoming
  const pastDeadline = isPastCancelDeadline(appt)
  const canCancel = upcoming && !isPractitionerProposal && (appt.status === 'pending' || appt.status === 'confirmed') && !pastDeadline

  return (
    <View style={{
      backgroundColor: 'rgba(255,255,255,0.90)',
      borderRadius: scale(20),
      marginBottom: scale(14),
      borderWidth: 1,
      borderColor: '#e5eeff',
      overflow: 'hidden',
      shadowColor: '#82d8ff',
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
          <Text style={{ fontSize: scale(18), fontWeight: '800', color: '#82d8ff', fontFamily: 'Manrope' }}>
            {initials(name)}
          </Text>
        </View>

        {/* Info */}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: fs.md, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope' }}>
            {name}
          </Text>
          <Text style={{ fontSize: fs.sm, color: '#82d8ff', fontFamily: 'Manrope', fontWeight: '600', marginTop: 1 }}>
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

      {/* Créneau proposé par le praticien — accepter/refuser, pas "annuler" */}
      {isPractitionerProposal && (
        <View style={{ marginHorizontal: scale(16), marginBottom: scale(14), padding: scale(12), backgroundColor: '#fff8e1', borderRadius: scale(12), gap: scale(10) }}>
          <Text style={{ fontSize: fs.sm, fontWeight: '700', color: '#705d00', fontFamily: 'Manrope' }}>
            Ce praticien vous propose ce créneau — confirmez-vous ?
          </Text>
          <View style={{ flexDirection: 'row', gap: scale(8) }}>
            <TouchableOpacity onPress={onAccept} style={{ flex: 1, backgroundColor: '#82d8ff', borderRadius: scale(12), paddingVertical: scale(11), alignItems: 'center' }}>
              <Text style={{ color: '#0b1c30', fontWeight: '800', fontSize: fs.sm, fontFamily: 'Manrope' }}>Accepter</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onDecline} style={{ flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ba1a1a', borderRadius: scale(12), paddingVertical: scale(11), alignItems: 'center' }}>
              <Text style={{ color: '#ba1a1a', fontWeight: '700', fontSize: fs.sm, fontFamily: 'Manrope' }}>Refuser</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Action buttons */}
      {(canJoin || canCancel) && (
        <View style={{ paddingHorizontal: scale(16), paddingBottom: scale(16), flexDirection: 'row', gap: scale(8) }}>
          {canJoin && (
            <TouchableOpacity
              onPress={onJoin}
              style={{ flex: 1, backgroundColor: '#82d8ff', borderRadius: scale(14), paddingVertical: scale(13), alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: scale(8) }}
            >
              <MaterialIcons name={appt.type === 'audio' ? 'mic' : 'videocam'} size={scale(18)} color="#0b1c30" />
              <Text style={{ color: '#0b1c30', fontWeight: '800', fontSize: fs.md, fontFamily: 'Manrope' }}>Rejoindre</Text>
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

      {/* Délai d'annulation dépassé — même règle que web, juste informative */}
      {upcoming && !isPractitionerProposal && pastDeadline && (appt.status === 'pending' || appt.status === 'confirmed') && (
        <Text style={{ marginHorizontal: scale(16), marginBottom: scale(14), fontSize: fs.xs, color: '#6f787e', fontStyle: 'italic', fontFamily: 'Manrope' }}>
          Délai d&apos;annulation dépassé — contactez directement le praticien.
        </Text>
      )}

      {/* Motif d'annulation */}
      {appt.status === 'cancelled' && appt.cancellation_reason && (
        <Text style={{ marginHorizontal: scale(16), marginBottom: scale(14), fontSize: fs.xs, color: '#6f787e', fontStyle: 'italic', fontFamily: 'Manrope' }}>
          Motif : {appt.cancellation_reason}
        </Text>
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

  const { data, isLoading, refetch, isRefetching, error: queryError } = useQuery({
    queryKey: ['patient-appointments', profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id, scheduled_at, duration_min, status, type, notes, created_by, cancellation_reason,
          practitioners (
            id, speciality, session_price, session_currency,
            users ( full_name, avatar_url ),
            practitioner_booking_settings ( cancellation_deadline_hours )
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

  // Motif désormais obligatoire (Alert web équivalent : textarea requise
  // avant de pouvoir confirmer) — mobile envoyait jusqu'ici toujours le même
  // texte figé "Annulé par le patient", perdant l'information réelle.
  const [reasonTarget, setReasonTarget] = useState<{ appt: AppointmentRow; decision: 'confirmed' | 'cancelled' } | null>(null)
  const [reasonText, setReasonText] = useState('')

  const respondToRequest = useMutation({
    mutationFn: async ({ appointmentId, decision, reason }: { appointmentId: string; decision: 'confirmed' | 'cancelled'; reason?: string }) => {
      const { error } = await supabase.from('appointments')
        .update(decision === 'cancelled' ? { status: decision, cancellation_reason: reason } : { status: decision })
        .eq('id', appointmentId)
      if (error) throw error
      void supabase.functions.invoke('on-appointment-status-change', {
        body: { appointment_id: appointmentId, new_status: decision },
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patient-appointments'] })
      setReasonTarget(null)
      setReasonText('')
    },
    onError: () => Alert.alert('Erreur', 'Une erreur est survenue. Réessayez.'),
  })

  function handleAccept(appt: AppointmentRow) {
    respondToRequest.mutate({ appointmentId: appt.id, decision: 'confirmed' })
  }
  function handleDecline(appt: AppointmentRow) {
    setReasonTarget({ appt, decision: 'cancelled' })
    setReasonText('')
  }
  function handleCancel(appt: AppointmentRow) {
    setReasonTarget({ appt, decision: 'cancelled' })
    setReasonText('')
  }
  function submitReason() {
    if (!reasonTarget || !reasonText.trim()) return
    respondToRequest.mutate({ appointmentId: reasonTarget.appt.id, decision: reasonTarget.decision, reason: reasonText.trim() })
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
          style={{ backgroundColor: '#82d8ff', borderRadius: scale(14), paddingHorizontal: scale(14), paddingVertical: scale(10), flexDirection: 'row', alignItems: 'center', gap: scale(6) }}
        >
          <MaterialIcons name="add" size={scale(18)} color="#0b1c30" />
          <Text style={{ color: '#0b1c30', fontWeight: '800', fontSize: fs.sm, fontFamily: 'Manrope' }}>Nouveau</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: scale(12) }}>
          <ActivityIndicator size="large" color="#82d8ff" />
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
              tintColor="#82d8ff"
            />
          }
        >
          {/* Upcoming */}
          {upcoming.length > 0 && (
            <View style={{ marginBottom: scale(8) }}>
              <Text style={{ fontSize: fs.xs, fontWeight: '700', color: '#82d8ff', letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'Manrope', marginBottom: scale(14) }}>
                À venir
              </Text>
              {upcoming.map(a => (
                <AppointmentCard key={a.id} appt={a} onJoin={() => handleJoin(a)} onCancel={() => handleCancel(a)} onAccept={() => handleAccept(a)} onDecline={() => handleDecline(a)} />
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
                <AppointmentCard key={a.id} appt={a} onJoin={() => handleJoin(a)} onCancel={() => handleCancel(a)} onAccept={() => handleAccept(a)} onDecline={() => handleDecline(a)} />
              ))}
            </View>
          )}

          {/* Bug remonté : un RDV confirmé n'apparaissait pas ici. Si la
              requête échoue (RLS, réseau, embed invalide…), `data` reste
              undefined et l'écran affichait "Aucun rendez-vous" — indiscernable
              d'une liste réellement vide, et donc impossible à diagnostiquer.
              L'erreur réelle est maintenant affichée. */}
          {queryError && (
            <View style={{ marginBottom: scale(16), padding: scale(14), borderRadius: scale(14), backgroundColor: '#ffdad6', borderWidth: 1, borderColor: 'rgba(186,26,26,0.25)', gap: scale(6) }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(8) }}>
                <MaterialIcons name="error-outline" size={scale(18)} color="#ba1a1a" />
                <Text style={{ flex: 1, fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '700', color: '#ba1a1a' }}>
                  Impossible de charger vos rendez-vous
                </Text>
              </View>
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#ba1a1a' }}>
                {(queryError as Error).message}
              </Text>
              <TouchableOpacity onPress={() => refetch()} style={{ alignSelf: 'flex-start', marginTop: scale(4), paddingHorizontal: scale(14), paddingVertical: scale(8), borderRadius: 999, backgroundColor: '#ba1a1a' }}>
                <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '800', color: '#fff' }}>Réessayer</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Empty state */}
          {!queryError && (data ?? []).length === 0 && (
            <View style={{ alignItems: 'center', paddingTop: scale(60) }}>
              <View style={{ width: scale(80), height: scale(80), borderRadius: scale(40), backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center', marginBottom: scale(16) }}>
                <MaterialIcons name="calendar-today" size={scale(38)} color="#82d8ff" />
              </View>
              <Text style={{ fontSize: fs.xl, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope', marginBottom: scale(8) }}>
                Aucun rendez-vous
              </Text>
              <Text style={{ fontSize: fs.md, color: '#6f787e', fontFamily: 'Manrope', textAlign: 'center', lineHeight: scale(22), marginBottom: scale(28), paddingHorizontal: scale(20) }}>
                Réservez votre première consultation avec un professionnel de santé.
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/(patient)/find-practitioners')}
                style={{ backgroundColor: '#82d8ff', borderRadius: scale(16), paddingHorizontal: scale(24), paddingVertical: scale(14), flexDirection: 'row', alignItems: 'center', gap: scale(8) }}
              >
                <Text style={{ color: '#0b1c30', fontWeight: '800', fontSize: fs.md, fontFamily: 'Manrope' }}>
                  Trouver un praticien
                </Text>
                <MaterialIcons name="arrow-forward" size={scale(18)} color="#0b1c30" />
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {/* Motif obligatoire — annulation (patient) ou refus (proposition du
          praticien), même exigence que web/patient/appointments/page.tsx. */}
      <Modal visible={!!reasonTarget} transparent animationType="fade" onRequestClose={() => setReasonTarget(null)}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(11,28,48,0.45)', padding: 24 }}>
          <View style={{ width: '100%', maxWidth: 400, backgroundColor: '#fff', borderRadius: 20, padding: 20, gap: 14 }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: 16, fontWeight: '800', color: '#0b1c30' }}>
              {reasonTarget?.appt.created_by === 'practitioner' && reasonTarget.appt.status === 'pending' ? 'Refuser ce rendez-vous' : 'Annuler ce rendez-vous'}
            </Text>
            <View style={{ gap: 6 }}>
              <Text style={{ fontFamily: 'Manrope', fontSize: 11, fontWeight: '700', color: '#6f787e', textTransform: 'uppercase' }}>
                Motif (obligatoire)
              </Text>
              <TextInput
                value={reasonText}
                onChangeText={setReasonText}
                placeholder="Expliquez brièvement la raison..."
                placeholderTextColor="#bec8ce"
                multiline
                numberOfLines={3}
                style={{ height: 90, borderRadius: 12, borderWidth: 1, borderColor: '#bec8ce', paddingHorizontal: 14, paddingTop: 10, fontFamily: 'Manrope', fontSize: 14, color: '#0b1c30', backgroundColor: '#f8f9ff', textAlignVertical: 'top' }}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={() => setReasonTarget(null)} style={{ flex: 1, paddingVertical: 13, borderRadius: 999, alignItems: 'center', borderWidth: 1, borderColor: '#bec8ce' }}>
                <Text style={{ fontFamily: 'Manrope', fontSize: 14, fontWeight: '600', color: '#3f484d' }}>Retour</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={submitReason}
                disabled={!reasonText.trim() || respondToRequest.isPending}
                style={{ flex: 1, paddingVertical: 13, borderRadius: 999, alignItems: 'center', backgroundColor: '#ba1a1a', opacity: (!reasonText.trim() || respondToRequest.isPending) ? 0.5 : 1 }}
              >
                {respondToRequest.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={{ fontFamily: 'Manrope', fontSize: 14, fontWeight: '800', color: '#fff' }}>Confirmer</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}
