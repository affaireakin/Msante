import { useState, useRef, useEffect } from 'react'
import { View, Text, TouchableOpacity, TextInput, Alert, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { GlassCard, PrimaryButton } from '@/components/ui'
import { authService } from '@/features/auth/services/authService'

const OTP_LENGTH = 8
const RESEND_COOLDOWN = 60

export default function VerifyOtpScreen() {
  const router = useRouter()
  const { email } = useLocalSearchParams<{ email: string }>()

  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const inputRef = useRef<TextInput>(null)
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 400)
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current)
    }
  }, [])

  function startCooldown() {
    setCooldown(RESEND_COOLDOWN)
    cooldownRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  function handleOtpChange(text: string) {
    const digits = text.replace(/\D/g, '').slice(0, OTP_LENGTH)
    setOtp(digits)
    if (digits.length === OTP_LENGTH) {
      void submitOtp(digits)
    }
  }

  async function submitOtp(code = otp) {
    if (code.length < OTP_LENGTH) return
    setLoading(true)
    try {
      const result = await authService.verifyEmailOtp(email ?? '', code)
      if (result.error) {
        Alert.alert('Code incorrect', 'Le code saisi est invalide ou expiré. Réessayez.')
        setOtp('')
        inputRef.current?.focus()
      }
      // On success _layout.tsx onAuthStateChange handles navigation automatically
    } catch {
      Alert.alert('Erreur', 'Une erreur réseau est survenue. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    if (cooldown > 0) return
    try {
      const { error } = await authService.resendEmailOtp(email ?? '')
      if (error) {
        Alert.alert('Erreur', error)
        return
      }
      Alert.alert('Code renvoyé', 'Un nouveau code a été envoyé à votre email.')
      startCooldown()
    } catch {
      Alert.alert('Erreur', 'Une erreur réseau est survenue. Réessayez.')
    }
  }

  const maskedEmail = email
    ? email.replace(/^(.{2})(.+)(@.+)$/, (_, a, b, c) => a + '*'.repeat(Math.max(b.length - 2, 1)) + c)
    : ''

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      <View style={{ flex: 1, paddingHorizontal: 24 }}>
        {/* Header */}
        <View style={{ marginTop: 40, marginBottom: 36 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 24, alignSelf: 'flex-start' }}
          >
            <MaterialIcons name="arrow-back" size={20} color="#82d8ff" />
            <Text style={{ fontSize: 14, color: '#82d8ff', fontFamily: 'Manrope', fontWeight: '600' }}>Retour</Text>
          </TouchableOpacity>

          <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <MaterialIcons name="mark-email-read" size={26} color="#82d8ff" />
          </View>

          <Text style={{ fontSize: 26, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope', letterSpacing: -0.5, marginBottom: 8 }}>
            Vérifiez votre email
          </Text>
          <Text style={{ fontSize: 14, color: '#6f787e', fontFamily: 'Manrope', lineHeight: 22 }}>
            Nous avons envoyé un code à 8 chiffres à{'\n'}
            <Text style={{ fontWeight: '700', color: '#3f484d' }}>{maskedEmail}</Text>
          </Text>
        </View>

        {/* OTP boxes */}
        <GlassCard style={{ alignItems: 'center', paddingVertical: 28 }}>
          <Pressable onPress={() => inputRef.current?.focus()}>
            <View style={{ flexDirection: 'row', gap: 5 }}>
              {Array.from({ length: OTP_LENGTH }).map((_, i) => {
                const char = otp[i]
                const isFocused = otp.length === i
                return (
                  <View
                    key={i}
                    style={{
                      width: 30, height: 44, borderRadius: 10,
                      borderWidth: isFocused ? 2 : 1.5,
                      borderColor: isFocused ? '#82d8ff' : char ? '#82d8ff' : '#bec8ce',
                      backgroundColor: char ? '#eff4ff' : '#ffffff',
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {char ? (
                      <Text style={{ fontSize: 18, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope' }}>
                        {char}
                      </Text>
                    ) : (
                      isFocused && (
                        <View style={{ width: 2, height: 18, backgroundColor: '#82d8ff', borderRadius: 1 }} />
                      )
                    )}
                  </View>
                )
              })}
            </View>
          </Pressable>

          {/* Hidden input capturing all keystrokes */}
          <TextInput
            ref={inputRef}
            value={otp}
            onChangeText={handleOtpChange}
            keyboardType="number-pad"
            maxLength={OTP_LENGTH}
            style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
            caretHidden
          />

          <Text style={{ fontSize: 12, color: '#6f787e', fontFamily: 'Manrope', marginTop: 16, textAlign: 'center' }}>
            Vérifiez également votre dossier spam
          </Text>
        </GlassCard>

        {/* Submit */}
        <View style={{ marginTop: 20 }}>
          <PrimaryButton
            label={`Vérifier (${otp.length}/${OTP_LENGTH})`}
            onPress={() => submitOtp()}
            loading={loading}
            disabled={otp.length < OTP_LENGTH}
          />
        </View>

        {/* Resend */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20, gap: 4 }}>
          <Text style={{ fontSize: 14, color: '#6f787e', fontFamily: 'Manrope' }}>
            Vous n'avez pas reçu le code ?
          </Text>
          <TouchableOpacity onPress={handleResend} disabled={cooldown > 0}>
            <Text style={{
              fontSize: 14, fontWeight: '700', fontFamily: 'Manrope',
              color: cooldown > 0 ? '#bec8ce' : '#82d8ff',
            }}>
              {cooldown > 0 ? `Renvoyer (${cooldown}s)` : 'Renvoyer'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  )
}
