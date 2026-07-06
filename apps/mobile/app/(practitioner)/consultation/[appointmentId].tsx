import { useState, useEffect, useRef } from 'react'
import {
  View, Text, TouchableOpacity, Alert, ActivityIndicator, StatusBar,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/services/supabase'
import { useConsultationStore } from '@/features/consultation/store/consultationStore'

interface AppointmentInfo {
  patientName: string
  scheduledAt: string
  durationMin: number
  type: string
}

interface ConsultationInfo {
  id: string
  roomUrl: string
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
}

function InitialsAvatar({ name, size = 56 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: '#82d8ff', alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: '#005e7a', fontSize: size * 0.36, fontFamily: 'Manrope', fontWeight: '800' }}>
        {initials}
      </Text>
    </View>
  )
}

export default function PractitionerConsultationScreen() {
  const { appointmentId } = useLocalSearchParams<{ appointmentId: string }>()
  const router = useRouter()

  const [appointment, setAppointment] = useState<AppointmentInfo | null>(null)
  const [consultation, setConsultation] = useState<ConsultationInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isJoining, setIsJoining] = useState(false)
  const [now, setNow] = useState(Date.now())
  const channelRef = useRef<RealtimeChannel | null>(null)
  const { setPractitionerConsultation } = useConsultationStore()

  // Ticks so the join window (5 min before -> duration after) opens/closes live.
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    let channel: RealtimeChannel | null = null

    async function init() {
      setIsLoading(true)

      // Fetch appointment info
      const { data, error } = await supabase
        .from('appointments')
        .select('scheduled_at, duration_min, type, users!appointments_patient_id_fkey(full_name)')
        .eq('id', appointmentId)
        .single()

      if (error || !data) {
        Alert.alert('Erreur', 'Rendez-vous introuvable.')
        router.back()
        return
      }

      const usersRaw = data.users as unknown
      const usersData = usersRaw && !Array.isArray(usersRaw)
        ? (usersRaw as { full_name: string })
        : Array.isArray(usersRaw) && (usersRaw as { full_name: string }[]).length > 0
          ? (usersRaw as { full_name: string }[])[0]
          : null

      setAppointment({
        patientName: usersData?.full_name ?? 'Patient',
        scheduledAt: data.scheduled_at as string,
        durationMin: (data.duration_min as number) ?? 60,
        type: (data.type as string) ?? 'video',
      })

      // Check if consultation row already exists
      const { data: existingConsult } = await supabase
        .from('consultations')
        .select('id, room_url')
        .eq('appointment_id', appointmentId)
        .maybeSingle()

      if (existingConsult) {
        setConsultation({ id: existingConsult.id, roomUrl: existingConsult.room_url })
      }

      setIsLoading(false)

      // Listen for patient joining (consultation INSERT)
      channel = supabase
        .channel(`practitioner-waiting-${appointmentId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'consultations', filter: `appointment_id=eq.${appointmentId}` },
          (payload) => {
            const row = payload.new as { id: string; room_url: string }
            setConsultation({ id: row.id, roomUrl: row.room_url })
          }
        )
        .subscribe()

      channelRef.current = channel
    }

    void init()
    return () => { if (channel) void supabase.removeChannel(channel) }
  }, [appointmentId])

  async function handleJoin() {
    if (!consultation) return
    setIsJoining(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Non connecté')

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/join-consultation`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ consultationId: consultation.id }),
        }
      )

      if (!res.ok) {
        const body = await res.json() as { message?: string }
        throw new Error(body.message ?? 'Erreur de connexion')
      }

      const body = await res.json() as { practitionerToken: string; roomUrl: string; consultationId: string }

      setPractitionerConsultation({
        consultationId: body.consultationId ?? consultation.id,
        roomUrl: body.roomUrl,
        practitionerToken: body.practitionerToken,
      })

      setIsJoining(false)

      router.push({
        pathname: '/(practitioner)/consultation/session',
        params: { patientName: appointment?.patientName ?? 'Patient' },
      })
    } catch (err) {
      Alert.alert('Erreur', err instanceof Error ? err.message : 'Une erreur est survenue')
      setIsJoining(false)
    }
  }

  const typeLabel: Record<string, string> = { video: 'Vidéo', audio: 'Audio', chat: 'Chat' }

  // Same 5-min-before / duration-after window enforced server-side in
  // join-consultation — mirrored here for a clear disabled state instead of
  // letting the practitioner tap and get an opaque error.
  const scheduledAtMs = appointment ? new Date(appointment.scheduledAt).getTime() : 0
  const windowOpen = scheduledAtMs - 5 * 60 * 1000
  const windowClose = scheduledAtMs + (appointment?.durationMin ?? 60) * 60 * 1000
  const tooEarly = !!appointment && now < windowOpen
  const tooLate = !!appointment && now > windowClose
  const canStart = !!consultation && !tooEarly && !tooLate

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingVertical: 14,
        backgroundColor: 'rgba(255,255,255,0.70)',
        borderBottomWidth: 1, borderBottomColor: 'rgba(226,232,240,0.50)',
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <MaterialIcons name="arrow-back" size={24} color="#0b1c30" />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#1d7a3a' }} />
          <Text style={{ fontSize: 13, fontFamily: 'Manrope', fontWeight: '700', color: '#82d8ff', letterSpacing: 0.5, textTransform: 'uppercase' }}>
            Consultation
          </Text>
        </View>
        <View style={{ width: 32 }} />
      </View>

      <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 32, gap: 24 }}>

        {isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color="#82d8ff" size="large" />
          </View>
        ) : (
          <>
            {/* Patient avatar + name */}
            <View style={{ alignItems: 'center', gap: 12 }}>
              <InitialsAvatar name={appointment?.patientName ?? 'Patient'} size={72} />
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 22, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope', letterSpacing: -0.5 }}>
                  {appointment?.patientName ?? 'Patient'}
                </Text>
                <Text style={{ fontSize: 13, color: '#6f787e', fontFamily: 'Manrope', marginTop: 2 }}>
                  {typeLabel[appointment?.type ?? 'video']} · {appointment?.durationMin ?? 60} min
                </Text>
              </View>
            </View>

            {/* Appointment info card */}
            <View style={{
              backgroundColor: 'rgba(255,255,255,0.70)',
              borderRadius: 20,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.80)',
              padding: 20,
              gap: 14,
            }}>
              {[
                { icon: 'schedule' as const, label: 'Date & heure', value: appointment ? formatTime(appointment.scheduledAt) : '—' },
                { icon: 'timer' as const, label: 'Durée', value: `${appointment?.durationMin ?? 60} minutes` },
                { icon: 'videocam' as const, label: 'Type', value: typeLabel[appointment?.type ?? 'video'] },
              ].map(row => (
                <View key={row.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialIcons name={row.icon} size={18} color="#82d8ff" />
                  </View>
                  <View>
                    <Text style={{ fontSize: 11, fontFamily: 'Manrope', fontWeight: '700', color: '#6f787e', textTransform: 'uppercase', letterSpacing: 0.5 }}>{row.label}</Text>
                    <Text style={{ fontSize: 14, fontFamily: 'Manrope', fontWeight: '600', color: '#0b1c30' }}>{row.value}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Status */}
            <View style={{ alignItems: 'center' }}>
              {consultation ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#e8f5e9', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: '#bbf7d0' }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#16a34a' }} />
                  <Text style={{ fontSize: 13, fontFamily: 'Manrope', fontWeight: '700', color: '#166534' }}>
                    Patient connecté — prêt à démarrer
                  </Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff8e1', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: '#fde68a' }}>
                  <ActivityIndicator size="small" color="#92400e" />
                  <Text style={{ fontSize: 13, fontFamily: 'Manrope', fontWeight: '600', color: '#92400e' }}>
                    En attente du patient…
                  </Text>
                </View>
              )}
            </View>

            {/* Actions */}
            <TouchableOpacity
              onPress={handleJoin}
              disabled={!canStart || isJoining}
              style={{
                backgroundColor: canStart ? '#82d8ff' : '#bec8ce',
                paddingVertical: 18,
                borderRadius: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                opacity: isJoining ? 0.7 : 1,
                shadowColor: '#82d8ff',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: canStart ? 0.20 : 0,
                shadowRadius: 16,
                elevation: canStart ? 4 : 0,
              }}
            >
              {isJoining ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <MaterialIcons name={tooLate ? 'event-busy' : 'videocam'} size={22} color="#fff" />
              )}
              <Text style={{ color: '#fff', fontFamily: 'Manrope', fontWeight: '700', fontSize: 16 }}>
                {isJoining ? 'Connexion…'
                  : tooLate ? 'Session expirée'
                  : tooEarly ? 'Disponible 5 min avant l\'heure'
                  : consultation ? 'Démarrer la consultation' : 'En attente du patient'}
              </Text>
            </TouchableOpacity>

            {/* Disclaimer */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 4 }}>
              <MaterialIcons name="lock" size={13} color="#6f787e" style={{ marginTop: 1 }} />
              <Text style={{ fontSize: 11, color: '#6f787e', fontFamily: 'Manrope', flex: 1, lineHeight: 16 }}>
                Session chiffrée · LiveKit · Données conformes RGPD
              </Text>
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  )
}
