import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { GlassCard, AppTextInput, PrimaryButton } from '@/components/ui'
import { authService } from '@/features/auth/services/authService'
import { loginSchema, type LoginFormData } from '@/features/auth/schemas/authSchemas'

export default function LoginScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const { control, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    setLoading(true)
    try {
      // Last-resort safety net: signInWithPassword can hang indefinitely if
      // the Supabase client's internal auth-state machinery stalls (see
      // app/_layout.tsx for the primary fix) — without this ceiling, the
      // button would spin forever with no way for the user to retry.
      const result = await Promise.race([
        authService.signInWithEmail(data.email, data.password),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('TIMEOUT')), 15000)
        ),
      ])
      if (result.error) Alert.alert('Erreur de connexion', result.error)
    } catch (e) {
      const timedOut = e instanceof Error && e.message === 'TIMEOUT'
      Alert.alert(
        'Erreur de connexion',
        timedOut ? 'La connexion prend trop de temps. Fermez complètement l\'application et réessayez.' : 'Une erreur réseau est survenue. Réessayez.'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setGoogleLoading(true)
    try {
      await authService.signInWithGoogle()
    } catch {
      Alert.alert('Erreur de connexion', 'Une erreur réseau est survenue. Réessayez.')
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ marginTop: 40, marginBottom: 28 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20, alignSelf: 'flex-start' }}
          >
            <MaterialIcons name="arrow-back" size={20} color="#82d8ff" />
            <Text style={{ fontSize: 14, color: '#82d8ff', fontFamily: 'Manrope', fontWeight: '600' }}>
              Retour
            </Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 28, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope', letterSpacing: -0.5, marginBottom: 6 }}>
            Connexion
          </Text>
          <Text style={{ fontSize: 14, color: '#6f787e', fontFamily: 'Manrope' }}>
            Bon retour sur M-Santé
          </Text>
        </View>

        {/* Form */}
        <GlassCard style={{ gap: 16 }}>
          <Controller control={control} name="email"
            render={({ field: { onChange, value } }) => (
              <AppTextInput
                label="Email" value={value} onChangeText={onChange}
                keyboardType="email-address" autoCapitalize="none"
                error={errors.email?.message} placeholder="votre@email.com"
              />
            )} />
          <Controller control={control} name="password"
            render={({ field: { onChange, value } }) => (
              <AppTextInput
                label="Mot de passe" value={value} onChangeText={onChange}
                secureTextEntry={!showPassword} error={errors.password?.message} placeholder="••••••••"
                rightElement={
                  <TouchableOpacity onPress={() => setShowPassword(p => !p)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <MaterialIcons name={showPassword ? 'visibility-off' : 'visibility'} size={20} color="#6f787e" />
                  </TouchableOpacity>
                }
              />
            )} />

          <TouchableOpacity
            onPress={() => router.push('/(auth)/forgot-password')}
            style={{ alignSelf: 'flex-end' }}
          >
            <Text style={{ fontSize: 13, color: '#82d8ff', fontFamily: 'Manrope', fontWeight: '600' }}>
              Mot de passe oublié ?
            </Text>
          </TouchableOpacity>

          <PrimaryButton label="Se connecter" onPress={handleSubmit(onSubmit)} loading={loading} />
        </GlassCard>

        {/* Séparateur */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 20 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: '#bec8ce' }} />
          <Text style={{ fontSize: 12, color: '#6f787e', fontFamily: 'Manrope' }}>ou continuer avec</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: '#bec8ce' }} />
        </View>

        {/* Google */}
        <PrimaryButton
          label="Continuer avec Google"
          onPress={handleGoogle}
          loading={googleLoading}
          variant="outline"
        />

        {/* Lien inscription */}
        <TouchableOpacity
          onPress={() => router.push('/(auth)/signup-profile')}
          style={{ paddingVertical: 16 }}
        >
          <Text style={{ textAlign: 'center', fontSize: 14, color: '#6f787e', fontFamily: 'Manrope' }}>
            Pas encore de compte ?{' '}
            <Text style={{ color: '#82d8ff', fontWeight: '700' }}>S'inscrire</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}
