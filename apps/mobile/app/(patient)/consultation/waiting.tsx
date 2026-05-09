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

export default function WaitingRoom() {
  const router = useRouter()
  const { appointmentId, practitionerName, scheduledAt } = useLocalSearchParams<{
    appointmentId: string
    practitionerName: string
    scheduledAt: string
  }>()

  const { consultationId, status, setConsultation } = useConsultationStore()
  const [isCreating, setIsCreating] = useState(false)
  const [countdown, setCountdown] = useState('')

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

  // Countdown jusqu'au RDV
  useEffect(() => {
    const update = () => {
      const diff = new Date(scheduledAt).getTime() - Date.now()
      if (diff <= 0) { setCountdown('Maintenant'); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setCountdown(h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`)
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [scheduledAt])

  // Écoute statut Realtime si consultation déjà créée
  useConsultationRoom(consultationId)

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
      if (!res.ok) throw new Error('Impossible de créer la salle')
      const data = await res.json()
      setConsultation({
        consultationId: data.consultationId,
        roomUrl: data.roomUrl,
        patientToken: data.patientToken,
      })
      router.push({
        pathname: '/(patient)/consultation/session',
        params: { consultationId: data.consultationId, practitionerName },
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
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#006685', fontFamily: 'Manrope', letterSpacing: -0.3 }}>M-Santé</Text>
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
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#006685', shadowColor: '#006685', shadowOpacity: 0.5, shadowRadius: 8, elevation: 2 }} />
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
            width: 128, height: 128, borderRadius: 64, backgroundColor: '#006685',
            alignItems: 'center', justifyContent: 'center',
            shadowColor: '#82d8ff', shadowOpacity: 1, shadowRadius: 40, elevation: 8,
          }}>
            <MaterialIcons name="local-hospital" size={52} color="#ffffff" />
          </View>
        </View>

        {/* Infos praticien */}
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#0b1c30', fontFamily: 'Manrope', textAlign: 'center' }}>{practitionerName}</Text>
          {isPractitionerReady ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ecfdf5', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 9999, borderWidth: 1, borderColor: '#a7f3d0' }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' }} />
              <Text style={{ color: '#065f46', fontSize: 14, fontWeight: '600', fontFamily: 'Manrope' }}>Le praticien est prêt !</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#e5eeff', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 9999 }}>
              <ActivityIndicator size="small" color="#006685" />
              <Text style={{ color: '#6f787e', fontSize: 14, fontFamily: 'Manrope' }}>En attente du praticien…</Text>
            </View>
          )}
        </View>

        {/* Countdown */}
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
        </View>

        {/* Actions */}
        <View style={{ width: '100%', gap: 12 }}>
          <TouchableOpacity
            onPress={handleJoin}
            disabled={isCreating}
            style={{ width: '100%', backgroundColor: '#006685', borderRadius: 9999, paddingVertical: 16, alignItems: 'center', opacity: isCreating ? 0.7 : 1 }}
          >
            {isCreating ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={{ color: '#ffffff', fontWeight: 'bold', fontFamily: 'Manrope', fontSize: 16 }}>Rejoindre la session</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleCancel} style={{ width: '100%', paddingVertical: 12, alignItems: 'center' }}>
            <Text style={{ color: '#6f787e', fontFamily: 'Manrope', fontSize: 14 }}>Annuler</Text>
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
