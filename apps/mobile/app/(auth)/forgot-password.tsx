import { useState } from 'react'
import { View, Text, TouchableOpacity, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { GlassCard, AppTextInput, PrimaryButton } from '@/components/ui'
import { authService } from '@/features/auth/services/authService'
import { forgotPasswordSchema, type ForgotPasswordFormData } from '@/features/auth/schemas/authSchemas'

export default function ForgotPasswordScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const { control, handleSubmit, formState: { errors } } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setLoading(true)
    try {
      await authService.resetPassword(data.email)
      router.push({ pathname: '/(auth)/verify-reset-otp', params: { email: data.email } })
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : "Impossible d'envoyer le code")
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff', paddingHorizontal: 24 }}>
      {/* Header */}
      <View style={{ marginTop: 40, marginBottom: 28 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20, alignSelf: 'flex-start' }}
        >
          <MaterialIcons name="arrow-back" size={20} color="#82d8ff" />
          <Text style={{ fontSize: 14, color: '#82d8ff', fontFamily: 'Manrope', fontWeight: '600' }}>Retour</Text>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}>
            <MaterialIcons name="lock-reset" size={22} color="#82d8ff" />
          </View>
          <View>
            <Text style={{ fontSize: 24, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope', letterSpacing: -0.5 }}>
              Mot de passe oublié
            </Text>
            <Text style={{ fontSize: 13, color: '#6f787e', fontFamily: 'Manrope' }}>
              Code de vérification par email
            </Text>
          </View>
        </View>
      </View>

      <GlassCard style={{ gap: 16 }}>
        <Text style={{ fontSize: 14, color: '#6f787e', fontFamily: 'Manrope', lineHeight: 20 }}>
          Entrez votre adresse email et nous vous enverrons un code de vérification.
        </Text>

        <Controller control={control} name="email"
          render={({ field: { onChange, value } }) => (
            <AppTextInput
              label="Email" value={value} onChangeText={onChange}
              keyboardType="email-address" autoCapitalize="none"
              error={errors.email?.message} placeholder="votre@email.com"
            />
          )} />

        <PrimaryButton label="Envoyer le code" onPress={handleSubmit(onSubmit)} loading={loading} />
      </GlassCard>
    </SafeAreaView>
  )
}
