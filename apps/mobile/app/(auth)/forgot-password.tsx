import { useState } from 'react'
import { View, Text, TouchableOpacity, SafeAreaView } from 'react-native'
import { useRouter } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { GlassCard, AppTextInput, PrimaryButton } from '@/components/ui'
import { authService } from '@/features/auth/services/authService'
import { forgotPasswordSchema, type ForgotPasswordFormData } from '@/features/auth/schemas/authSchemas'

export default function ForgotPasswordScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const { control, handleSubmit, formState: { errors } } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setLoading(true)
    await authService.resetPassword(data.email)
    setLoading(false)
    setSent(true)
  }

  return (
    <SafeAreaView className="flex-1 bg-background px-6">
      <View className="mt-12 mb-8">
        <TouchableOpacity onPress={() => router.back()} className="mb-6">
          <Text className="text-primary font-manrope font-medium">← Retour</Text>
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-on-surface font-manrope">
          Mot de passe oublié
        </Text>
        <Text className="text-sm text-on-surface-variant font-manrope mt-1">
          Nous vous enverrons un lien de réinitialisation
        </Text>
      </View>

      {sent ? (
        <GlassCard className="items-center gap-6">
          <View className="w-16 h-16 bg-primary-container rounded-full items-center justify-center">
            <Text className="text-3xl">📩</Text>
          </View>
          <View className="gap-2 items-center">
            <Text className="text-lg font-semibold text-on-surface font-manrope">Email envoyé !</Text>
            <Text className="text-sm text-on-surface-variant font-manrope text-center">
              Vérifiez votre boîte mail et cliquez sur le lien pour réinitialiser votre mot de passe.
            </Text>
          </View>
          <PrimaryButton
            label="Retour à la connexion"
            onPress={() => router.replace('/(auth)/login')}
            className="w-full"
          />
        </GlassCard>
      ) : (
        <GlassCard className="gap-4">
          <Controller control={control} name="email"
            render={({ field: { onChange, value } }) => (
              <AppTextInput
                label="Email" value={value} onChangeText={onChange}
                keyboardType="email-address" autoCapitalize="none"
                error={errors.email?.message} placeholder="votre@email.com"
              />
            )} />
          <PrimaryButton label="Envoyer le lien" onPress={handleSubmit(onSubmit)} loading={loading} />
        </GlassCard>
      )}
    </SafeAreaView>
  )
}
