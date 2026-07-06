import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing,
} from 'react-native-reanimated'
import { supabase } from '@/services/supabase'
import { useConsultationStore } from '@/features/consultation/store/consultationStore'
import { useConsultationRoom } from '@/features/consultation/hooks/useConsultation'

interface AppointmentInfo {
  scheduledAt: string
  durationMin: number
  type: string
  practitionerName: string
}

export default function WaitingRoom() {
  const router = useRouter()
  // appointmentId is the only param this screen strictly needs — practitionerName
  // is kept as an optional fast-render fallback, but the canonical data (incl.
  // duration_min, needed for the join window) is always fetched from the DB.
  const { appointmentId, practitionerName: practitionerNameParam } = useLocalSearchParams<{
    appointmentId: string
    practitionerName?: string
  }>()

  const { consultationId, status, setConsultation } = useConsultationStore()
  const [isCreating, setIsCreating] = useState(false)
  const [countdown, setCountdown] = useState('')
  const [loading, setLoading] = useState(true)
  const [appointment, setAppointment] = useState<AppointmentInfo | null>(null)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    supabase
      .from('appointments')
      .select('scheduled_at, duration_min, type, practitioners(users!user_id(full_name))')
      .eq('id', appointmentId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          Alert.alert('Erreur', 'Rendez-vous introuvable.')
          router.back()
          return
        }
        const pract = data.practitioners as unknown as { users: { full_name: string } | null } | null
        setAppointment({
          scheduledAt: data.scheduled_at as string,
          durationMin: (data.duration_min as number) ?? 60,
          type: (data.type as string) ?? 'video',
          practitionerName: pract?.users?.full_name ?? practitionerNameParam ?? 'Praticien',
        })
        setLoading(false)
      })
  }, [appointmentId])

  // Pulse animation — orb animé
  const scale = useSharedValue(0.9)
  const opacity = useSharedValue(0.5)
  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 2500, easing: Easing.bezier(0.4, 0, 0.2, 1) }),
        withTiming(0.9, { duration: 2500, easing: Easing.bezier(0.4, 0, 0.2, 1) })
      ), -1, false
    )
    opacity.value = withRepeat(
      withSequence(withTiming(0.8, { duration: 2500 }), withTiming(0.5, { duration: 2500 })),
      -1, false
    )
  }, [])
  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))

  // Countdown + 1s clock tick, used both for display and the join-window gate
  useEffect(() => {
    if (!appointment) return
    const update = () => {
      setNow(Date.now())
      const diff = new Date(appointment.scheduledAt).getTime() - Date.now()
      if (diff <= 0) { setCountdown('Maintenant'); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setCountdown(h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`)
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [appointment])

  // Écoute statut Realtime si consultation déjà créée
  useConsultationRoom(consultationId)

  const scheduledAtMs = appointment ? new Date(appointment.scheduledAt).getTime() : 0
  const windowOpen = scheduledAtMs - 5 * 60 * 1000
  const windowClose = scheduledAtMs + (appointment?.durationMin ?? 60) * 60 * 1000
  const tooEarly = !!appointment && now < windowOpen
  const tooLate = !!appointment && now > windowClose
  const canJoin = !!appointment && !tooEarly && !tooLate

  const handleJoin = async () => {
    setIsCreating(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Non connecté')

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-consultation-room`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ appointmentId }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Impossible de créer la salle')
      setConsultation({
        consultationId: data.consultationId,
        roomUrl: data.roomUrl,
        patientToken: data.patientToken,
      })
      router.push({
        pathname: '/(patient)/consultation/session',
        params: { consultationId: data.consultationId, practitionerName: appointment?.practitionerName ?? '' },
      })
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Une erreur est survenue')
    } finally {
      setIsCreating(false)
    }
  }

  const handleCancel = () => {
    Alert.alert(
      'Annuler la consultation ?',
      'Vous pourrez rejoindre à nouveau depuis votre espace rendez-vous.',
      [
        { text: 'Rester', style: 'cancel' },
        { text: 'Quitter', style: 'destructive', onPress: () => router.back() },
      ]
    )
  }

  const isPractitionerReady = status === 'active'

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#82d8ff" size="large" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      {/* Header */}
      <View style={{
        paddingHorizontal: 24,
        paddingVertical: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.20)',
        backgroundColor: 'rgba(255,255,255,0.70)',
      }}>
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#82d8ff', fontFamily: 'Manrope', letterSpacing: -0.3 }}>M-Santé</Text>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: 'rgba(229,238,255,0.5)',
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 9999,
          borderWidth: 1,
          borderColor: '#d3e4fe',
        }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#82d8ff', shadowColor: '#82d8ff', shadowOpacity: 0.5, shadowRadius: 8, elevation: 2 }} />
          <Text style={{ color: '#3f484d', fontSize: 10, fontFamily: 'Manrope', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 'bold' }}>Connexion sécurisée</Text>
        </View>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 32 }}>
        {/* Orb animé */}
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View
            style={[orbStyle, {
              position: 'absolute',
              width: 200, height: 200, borderRadius: 100,
              backgroundColor: 'rgba(130,216,255,0.25)',
            }]}
          />
          <View style={{
            width: 128, height: 128, borderRadius: 64, backgroundColor: '#82d8ff',
            alignItems: 'center', justifyContent: 'center',
            shadowColor: '#82d8ff', shadowOpacity: 1, shadowRadius: 40, elevation: 8,
          }}>
            <MaterialIcons name={appointment?.type === 'audio' ? 'mic' : 'local-hospital'} size={52} color="#ffffff" />
          </View>
        </View>

        {/* Infos praticien */}
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#0b1c30', fontFamily: 'Manrope', textAlign: 'center' }}>{appointment?.practitionerName}</Text>
          {tooLate ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fce4ec', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 9999, borderWidth: 1, borderColor: '#f5b8c4' }}>
              <MaterialIcons name="event-busy" size={16} color="#ba1a1a" />
              <Text style={{ color: '#ba1a1a', fontSize: 14, fontWeight: '600', fontFamily: 'Manrope' }}>Session expirée</Text>
            </View>
          ) : isPractitionerReady ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ecfdf5', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 9999, borderWidth: 1, borderColor: '#a7f3d0' }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' }} />
              <Text style={{ color: '#065f46', fontSize: 14, fontWeight: '600', fontFamily: 'Manrope' }}>Le praticien est prêt !</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#e5eeff', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 9999 }}>
              <ActivityIndicator size="small" color="#82d8ff" />
              <Text style={{ color: '#6f787e', fontSize: 14, fontFamily: 'Manrope' }}>En attente du praticien…</Text>
            </View>
          )}
        </View>

        {/* Countdown / fenêtre de session */}
        {!tooLate && (
          <View style={{
            borderRadius: 16,
            paddingHorizontal: 24,
            paddingVertical: 16,
            alignItems: 'center',
            gap: 4,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.5)',
            backgroundColor: 'rgba(255,255,255,0.60)',
          }}>
            <Text style={{ fontSize: 12, color: '#6f787e', fontFamily: 'Manrope', textTransform: 'uppercase', letterSpacing: 1.5 }}>Rendez-vous dans</Text>
            <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#0b1c30', fontFamily: 'Manrope' }}>{countdown}</Text>
            {tooEarly && (
              <Text style={{ fontSize: 11, color: '#6f787e', fontFamily: 'Manrope', marginTop: 4 }}>
                Accessible 5 minutes avant l&apos;heure du rendez-vous
              </Text>
            )}
          </View>
        )}

        {/* Actions */}
        <View style={{ width: '100%', gap: 12 }}>
          <TouchableOpacity
            onPress={handleJoin}
            disabled={isCreating || !canJoin}
            style={{ width: '100%', backgroundColor: canJoin ? '#82d8ff' : '#bec8ce', borderRadius: 9999, paddingVertical: 16, alignItems: 'center', opacity: isCreating ? 0.7 : 1 }}
          >
            {isCreating ? (
              <ActivityIndicator color="#0b1c30" />
            ) : (
              <Text style={{ color: canJoin ? '#0b1c30' : '#6f787e', fontWeight: '800', fontFamily: 'Manrope', fontSize: 16 }}>
                {tooLate ? 'Session terminée' : tooEarly ? 'Pas encore disponible' : 'Rejoindre la session'}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleCancel} style={{ width: '100%', paddingVertical: 12, alignItems: 'center' }}>
            <Text style={{ color: '#6f787e', fontFamily: 'Manrope', fontSize: 14 }}>{tooLate ? 'Retour' : 'Annuler'}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <MaterialIcons name="lock" size={12} color="#6f787e" />
          <Text style={{ fontSize: 12, color: '#6f787e', fontFamily: 'Manrope', textAlign: 'center' }}>
            Cet espace est chiffré de bout en bout
          </Text>
        </View>
      </View>
    </SafeAreaView>
  )
}
