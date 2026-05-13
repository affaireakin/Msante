import { useState, useEffect } from 'react'
import { View, Text, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as Linking from 'expo-linking'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { GlassCard, AppTextInput, PrimaryButton } from '@/components/ui'
import { supabase } from '@/services/supabase'
import { resetPasswordSchema, type ResetPasswordFormData } from '@/features/auth/schemas/authSchemas'

export default function ResetPasswordScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const handleUrl = async (url: string) => {
      const parsed = Linking.parse(url)
      const accessToken = parsed.queryParams?.access_token as string | undefined
      const refreshToken = parsed.queryParams?.refresh_token as string | undefined
      if (accessToken && refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      }
    }
    Linking.getInitialURL().then((url) => { if (url) handleUrl(url) })
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url))
    return () => sub.remove()
  }, [])

  const { control, handleSubmit, formState: { errors } } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  })

  const onSubmit = async (data: ResetPasswordFormData) => {
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: data.password })
      if (error) throw error
      setDone(true)
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible de réinitialiser')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff', paddingHorizontal: 24 }}>
      <View style={{ marginTop: 40, marginBottom: 28 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}>
            <MaterialIcons name="lock" size={22} color="#006685" />
          </View>
          <View>
            <Text style={{ fontSize: 24, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope', letterSpacing: -0.5 }}>
              Nouveau mot de passe
            </Text>
            <Text style={{ fontSize: 13, color: '#6f787e', fontFamily: 'Manrope' }}>
              Choisissez un mot de passe sécurisé
            </Text>
          </View>
        </View>
      </View>

      {done ? (
        <GlassCard style={{ alignItems: 'center', gap: 20 }}>
          <MaterialIcons name="check-circle" size={64} color="#006685" />
          <Text style={{ fontSize: 20, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope' }}>
            Mot de passe mis à jour !
          </Text>
          <PrimaryButton label="Se connecter" onPress={() => router.replace('/(auth)/login')} />
        </GlassCard>
      ) : (
        <GlassCard style={{ gap: 16 }}>
          <Controller control={control} name="password"
            render={({ field: { onChange, value } }) => (
              <AppTextInput label="Nouveau mot de passe" value={value} onChangeText={onChange}
                secureTextEntry error={errors.password?.message} />
            )} />
          <Controller control={control} name="confirmPassword"
            render={({ field: { onChange, value } }) => (
              <AppTextInput label="Confirmer le mot de passe" value={value} onChangeText={onChange}
                secureTextEntry error={errors.confirmPassword?.message} />
            )} />
          <Text style={{ fontSize: 12, color: '#6f787e', fontFamily: 'Manrope' }}>
            Min. 8 caractères · 1 majuscule · 1 chiffre · 1 caractère spécial
          </Text>
          <PrimaryButton label="Enregistrer" onPress={handleSubmit(onSubmit)} loading={loading} />
        </GlassCard>
      )}
    </SafeAreaView>
  )
}
