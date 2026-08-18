import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { GlassCard, AppTextInput, PrimaryButton } from '@/components/ui'
import { authService } from '@/features/auth/services/authService'
import { signupSchema, type SignupFormData } from '@/features/auth/schemas/authSchemas'

// Le compte du créateur d'organisation reste role='patient' en base jusqu'à
// validation par un Super Admin (voir validate-organization côté web) — la
// vraie organisation vit dans sa propre table, retrouvée via `created_by`.
// 'organization' n'est donc jamais envoyé comme rôle DB, seulement comme
// intent de navigation transmis à verify-otp (même logique que le web,
// où le query param `role` ne sert qu'à la redirection post-OTP, jamais
// à l'insert lui-même).
export default function SignupOrganizationScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [acceptedCgu, setAcceptedCgu] = useState(false)

  const { control, handleSubmit, formState: { errors } } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  })

  const onSubmit = async (data: SignupFormData) => {
    if (!acceptedCgu) {
      Alert.alert('Conditions requises', 'Veuillez accepter les CGU pour continuer.')
      return
    }
    setLoading(true)
    try {
      const result = await authService.signUpWithEmail(data.email, data.password, 'patient', data.full_name)
      if (result.error) {
        Alert.alert('Erreur', result.error)
        return
      }
      router.push(`/(auth)/verify-otp?email=${encodeURIComponent(data.email)}&intent=organization` as never)
    } catch {
      Alert.alert('Erreur', 'Une erreur réseau est survenue. Réessayez.')
    } finally {
      setLoading(false)
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
            <Text style={{ fontSize: 14, color: '#82d8ff', fontFamily: 'Manrope', fontWeight: '600' }}>Retour</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcons name="business" size={22} color="#82d8ff" />
            </View>
            <View>
              <Text style={{ fontSize: 24, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope', letterSpacing: -0.5 }}>
                Créer un compte
              </Text>
              <Text style={{ fontSize: 13, color: '#6f787e', fontFamily: 'Manrope' }}>Responsable d&apos;organisation</Text>
            </View>
          </View>
          <Text style={{ fontSize: 13, color: '#6f787e', fontFamily: 'Manrope', lineHeight: 19 }}>
            Vous serez l&apos;administrateur de cette organisation. Les informations de votre structure vous seront demandées à l&apos;étape suivante.
          </Text>
        </View>

        {/* Form */}
        <GlassCard style={{ gap: 16 }}>
          <Controller control={control} name="full_name"
            render={({ field: { onChange, value } }) => (
              <AppTextInput label="Votre nom complet" value={value} onChangeText={onChange}
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
                secureTextEntry={!showPassword} error={errors.password?.message} placeholder="••••••••"
                rightElement={
                  <TouchableOpacity onPress={() => setShowPassword(p => !p)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <MaterialIcons name={showPassword ? 'visibility-off' : 'visibility'} size={20} color="#6f787e" />
                  </TouchableOpacity>
                }
              />
            )} />
          <Controller control={control} name="confirmPassword"
            render={({ field: { onChange, value } }) => (
              <AppTextInput label="Confirmer le mot de passe" value={value} onChangeText={onChange}
                secureTextEntry={!showConfirmPassword} error={errors.confirmPassword?.message} placeholder="••••••••"
                rightElement={
                  <TouchableOpacity onPress={() => setShowConfirmPassword(p => !p)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <MaterialIcons name={showConfirmPassword ? 'visibility-off' : 'visibility'} size={20} color="#6f787e" />
                  </TouchableOpacity>
                }
              />
            )} />

          {/* CGU */}
          <TouchableOpacity
            onPress={() => setAcceptedCgu(v => !v)}
            style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}
            activeOpacity={0.7}
          >
            <View style={{
              width: 20, height: 20, borderRadius: 5, borderWidth: 2,
              borderColor: acceptedCgu ? '#82d8ff' : '#bec8ce',
              backgroundColor: acceptedCgu ? '#82d8ff' : 'transparent',
              alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0,
            }}>
              {acceptedCgu && <MaterialIcons name="check" size={13} color="#fff" />}
            </View>
            <Text style={{ fontSize: 12, color: '#3f484d', fontFamily: 'Manrope', flex: 1, lineHeight: 18 }}>
              J&apos;accepte les{' '}
              <Text
                style={{ color: '#82d8ff', fontWeight: '700' }}
                onPress={() => router.push('/(auth)/cgu' as never)}
              >
                Conditions Générales
              </Text>
              {' '}et le{' '}
              <Text
                style={{ color: '#82d8ff', fontWeight: '700' }}
                onPress={() => router.push('/(auth)/confidentialite' as never)}
              >
                traitement de mes données
              </Text>
              {' '}conformément à la politique de confidentialité.
            </Text>
          </TouchableOpacity>

          <PrimaryButton label="Continuer" onPress={handleSubmit(onSubmit)} loading={loading} />
        </GlassCard>

        <TouchableOpacity onPress={() => router.push('/(auth)/login')} style={{ paddingVertical: 16 }}>
          <Text style={{ textAlign: 'center', fontSize: 14, color: '#6f787e', fontFamily: 'Manrope' }}>
            Déjà un compte ?{' '}
            <Text style={{ color: '#82d8ff', fontWeight: '700' }}>Se connecter</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}
