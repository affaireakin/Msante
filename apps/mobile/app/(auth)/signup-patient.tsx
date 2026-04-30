import { useState } from 'react'
import { View, Text, TouchableOpacity, SafeAreaView, ScrollView, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { GlassCard, AppTextInput, PrimaryButton } from '@/components/ui'
import { authService } from '@/features/auth/services/authService'
import { signupSchema, type SignupFormData } from '@/features/auth/schemas/authSchemas'

export default function SignupPatientScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const { control, handleSubmit, formState: { errors } } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  })

  const onSubmit = async (data: SignupFormData) => {
    setLoading(true)
    const result = await authService.signUpWithEmail(
      data.email, data.password, 'patient', data.full_name
    )
    setLoading(false)
    if (result.error) Alert.alert('Erreur', result.error)
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="mt-12 mb-8">
          <TouchableOpacity onPress={() => router.back()} className="mb-6">
            <Text className="text-primary font-manrope font-medium">← Retour</Text>
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-on-surface font-manrope">
            Créer un compte patient
          </Text>
          <Text className="text-sm text-on-surface-variant font-manrope mt-1">
            Rejoignez M-Santé et prenez soin de vous
          </Text>
        </View>

        <GlassCard className="gap-4">
          <Controller control={control} name="full_name"
            render={({ field: { onChange, value } }) => (
              <AppTextInput label="Nom complet" value={value} onChangeText={onChange}
                error={errors.full_name?.message} placeholder="Prénom Nom"
                autoCapitalize="words" />
            )} />
          <Controller control={control} name="email"
            render={({ field: { onChange, value } }) => (
              <AppTextInput label="Email" value={value} onChangeText={onChange}
                keyboardType="email-address" autoCapitalize="none"
                error={errors.email?.message} placeholder="votre@email.com" />
            )} />
          <Controller control={control} name="password"
            render={({ field: { onChange, value } }) => (
              <AppTextInput label="Mot de passe" value={value} onChangeText={onChange}
                secureTextEntry error={errors.password?.message} placeholder="••••••••" />
            )} />
          <Controller control={control} name="confirmPassword"
            render={({ field: { onChange, value } }) => (
              <AppTextInput label="Confirmer le mot de passe" value={value} onChangeText={onChange}
                secureTextEntry error={errors.confirmPassword?.message} placeholder="••••••••" />
            )} />
          <PrimaryButton label="Créer mon compte" onPress={handleSubmit(onSubmit)} loading={loading} />
        </GlassCard>

        <TouchableOpacity onPress={() => router.push('/(auth)/login')} className="mt-6">
          <Text className="text-center text-sm text-on-surface-variant font-manrope">
            Déjà un compte ?{' '}
            <Text className="text-primary font-semibold">Se connecter</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}
