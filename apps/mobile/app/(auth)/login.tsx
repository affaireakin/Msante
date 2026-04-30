import { useState } from 'react'
import { View, Text, TouchableOpacity, SafeAreaView, ScrollView, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { GlassCard, AppTextInput, PrimaryButton } from '@/components/ui'
import { authService } from '@/features/auth/services/authService'
import { loginSchema, type LoginFormData } from '@/features/auth/schemas/authSchemas'

export default function LoginScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const { control, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    setLoading(true)
    const result = await authService.signInWithEmail(data.email, data.password)
    setLoading(false)
    if (result.error) Alert.alert('Erreur de connexion', result.error)
  }

  const handleGoogle = async () => {
    setGoogleLoading(true)
    await authService.signInWithGoogle()
    setGoogleLoading(false)
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="mt-12 mb-8">
          <TouchableOpacity onPress={() => router.back()} className="mb-6">
            <Text className="text-primary font-manrope font-medium">← Retour</Text>
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-on-surface font-manrope">Connexion</Text>
          <Text className="text-sm text-on-surface-variant font-manrope mt-1">
            Bon retour sur M-Santé
          </Text>
        </View>

        <GlassCard className="gap-4">
          <Controller
            control={control} name="email"
            render={({ field: { onChange, value } }) => (
              <AppTextInput
                label="Email" value={value} onChangeText={onChange}
                keyboardType="email-address" autoCapitalize="none"
                error={errors.email?.message} placeholder="votre@email.com"
              />
            )}
          />
          <Controller
            control={control} name="password"
            render={({ field: { onChange, value } }) => (
              <AppTextInput
                label="Mot de passe" value={value} onChangeText={onChange}
                secureTextEntry error={errors.password?.message} placeholder="••••••••"
              />
            )}
          />
          <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')}>
            <Text className="text-right text-sm text-primary font-manrope">
              Mot de passe oublié ?
            </Text>
          </TouchableOpacity>
          <PrimaryButton label="Se connecter" onPress={handleSubmit(onSubmit)} loading={loading} />
        </GlassCard>

        <View className="flex-row items-center gap-4 my-6">
          <View className="flex-1 h-px bg-outline-variant" />
          <Text className="text-xs text-outline font-manrope">ou continuer avec</Text>
          <View className="flex-1 h-px bg-outline-variant" />
        </View>

        <PrimaryButton
          label="Continuer avec Google"
          onPress={handleGoogle}
          loading={googleLoading}
          variant="outline"
        />

        <TouchableOpacity onPress={() => router.push('/(auth)/signup-patient')} className="mt-6">
          <Text className="text-center text-sm text-on-surface-variant font-manrope">
            Pas encore de compte ?{' '}
            <Text className="text-primary font-semibold">S'inscrire</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}
