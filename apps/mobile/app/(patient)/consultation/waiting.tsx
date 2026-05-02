import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
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
    <SafeAreaView className="flex-1 bg-background">
      {/* Header — fidèle à video_consultation_1 */}
      <View
        className="px-6 py-4 flex-row items-center justify-between border-b border-white/20"
        style={{ backgroundColor: 'rgba(255,255,255,0.70)' }}
      >
        <Text className="text-xl font-bold text-primary font-manrope tracking-tight">M-Santé</Text>
        <View className="flex-row items-center gap-2 bg-surface-container/50 px-3 py-1.5 rounded-full border border-surface-variant">
          <View className="w-2 h-2 rounded-full bg-primary" style={{ shadowColor: '#006685', shadowOpacity: 0.5, shadowRadius: 8, elevation: 2 }} />
          <Text className="text-on-surface-variant text-[10px] font-manrope uppercase tracking-widest font-bold">Connexion sécurisée</Text>
        </View>
      </View>

      <View className="flex-1 items-center justify-center px-6 gap-8">
        {/* Orb animé */}
        <View className="items-center justify-center">
          <Animated.View
            style={[orbStyle, {
              position: 'absolute',
              width: 200, height: 200, borderRadius: 100,
              backgroundColor: 'rgba(130,216,255,0.25)',
            }]}
          />
          <View
            className="w-32 h-32 rounded-full bg-primary items-center justify-center"
            style={{ shadowColor: '#82d8ff', shadowOpacity: 1, shadowRadius: 40, elevation: 8 }}
          >
            <Text style={{ fontSize: 48 }}>👨‍⚕️</Text>
          </View>
        </View>

        {/* Infos praticien */}
        <View className="items-center gap-2">
          <Text className="text-2xl font-bold text-on-surface font-manrope text-center">{practitionerName}</Text>
          {isPractitionerReady ? (
            <View className="flex-row items-center gap-2 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-200">
              <View className="w-2 h-2 rounded-full bg-emerald-500" />
              <Text className="text-emerald-700 text-sm font-semibold font-manrope">Le praticien est prêt !</Text>
            </View>
          ) : (
            <View className="flex-row items-center gap-2 bg-surface-container px-4 py-2 rounded-full">
              <ActivityIndicator size="small" color="#006685" />
              <Text className="text-outline text-sm font-manrope">En attente du praticien…</Text>
            </View>
          )}
        </View>

        {/* Countdown */}
        <View
          className="rounded-2xl px-6 py-4 items-center gap-1 border border-white/50"
          style={{ backgroundColor: 'rgba(255,255,255,0.60)' }}
        >
          <Text className="text-xs text-outline font-manrope uppercase tracking-widest">Rendez-vous dans</Text>
          <Text className="text-3xl font-bold text-on-surface font-manrope">{countdown}</Text>
        </View>

        {/* Actions */}
        <View className="w-full gap-3">
          <TouchableOpacity
            onPress={handleJoin}
            disabled={isCreating}
            className="w-full bg-primary rounded-full py-4 items-center"
            style={{ opacity: isCreating ? 0.7 : 1 }}
          >
            {isCreating ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-white font-bold font-manrope text-base">Rejoindre la session</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleCancel} className="w-full py-3 items-center">
            <Text className="text-outline font-manrope text-sm">Annuler</Text>
          </TouchableOpacity>
        </View>

        <Text className="text-xs text-outline font-manrope text-center">
          Cet espace est chiffré de bout en bout 🔒
        </Text>
      </View>
    </SafeAreaView>
  )
}
