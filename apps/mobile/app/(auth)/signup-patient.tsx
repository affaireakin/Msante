import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { GlassCard, AppTextInput, PrimaryButton } from '@/components/ui'
import { authService } from '@/features/auth/services/authService'
import { signupSchema, type SignupFormData } from '@/features/auth/schemas/authSchemas'
import { supabase } from '@/services/supabase'

interface AllowedCountry {
  id: string
  iso_code: string
  dial_code: string
  flag_emoji: string
  label: string
}

export default function SignupPatientScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [acceptedCgu, setAcceptedCgu] = useState(false)

  const [countries, setCountries] = useState<AllowedCountry[]>([])
  const [countryId, setCountryId] = useState('')
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState('')

  useEffect(() => {
    supabase.from('allowed_countries').select('id, iso_code, dial_code, flag_emoji, label').eq('is_active', true).order('sort_order')
      .then(({ data }) => {
        setCountries(data ?? [])
        if (data?.length) setCountryId(prev => prev || data[0].id)
      })
  }, [])

  const { control, handleSubmit, formState: { errors } } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  })

  const onSubmit = async (data: SignupFormData) => {
    if (!acceptedCgu) {
      Alert.alert('Conditions requises', 'Veuillez accepter les CGU pour continuer.')
      return
    }
    const selectedCountry = countries.find(c => c.id === countryId)
    if (!selectedCountry || !phone.trim()) {
      setPhoneError('Le numéro de téléphone est obligatoire.')
      return
    }
    setPhoneError('')
    setLoading(true)
    try {
      const result = await authService.signUpWithEmail(data.email, data.password, 'patient', data.full_name, {
        phone: `${selectedCountry.dial_code}${phone.trim()}`,
        country: selectedCountry.iso_code,
      })
      if (result.error) {
        Alert.alert('Erreur', result.error)
        return
      }
      router.push(`/(auth)/verify-otp?email=${encodeURIComponent(data.email)}` as never)
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
              <MaterialIcons name="person-add" size={22} color="#82d8ff" />
            </View>
            <View>
              <Text style={{ fontSize: 24, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope', letterSpacing: -0.5 }}>
                Créer un compte
              </Text>
              <Text style={{ fontSize: 13, color: '#6f787e', fontFamily: 'Manrope' }}>Espace patient</Text>
            </View>
          </View>
        </View>

        {/* Form */}
        <GlassCard style={{ gap: 16 }}>
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

          {/* Téléphone (obligatoire) */}
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 13, fontFamily: 'Manrope', fontWeight: '500', color: '#3f484d' }}>Indicatif pays</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 2 }}>
              {countries.map(c => (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => { setCountryId(c.id); setPhoneError('') }}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
                    borderWidth: 1.5,
                    borderColor: countryId === c.id ? '#82d8ff' : '#bec8ce',
                    backgroundColor: countryId === c.id ? '#e5eeff' : '#eff4ff',
                  }}
                >
                  <Text style={{ fontSize: 16 }}>{c.flag_emoji}</Text>
                  <Text style={{ fontSize: 13, fontFamily: 'Manrope', fontWeight: '700', color: countryId === c.id ? '#82d8ff' : '#0b1c30' }}>
                    {c.dial_code}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
          <AppTextInput
            label="Téléphone"
            value={phone}
            onChangeText={t => { setPhone(t.replace(/[^\d\s]/g, '')); setPhoneError('') }}
            keyboardType="phone-pad"
            placeholder="77 000 00 00"
            error={phoneError}
          />

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
              J'accepte les{' '}
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

          <PrimaryButton label="Créer mon compte" onPress={handleSubmit(onSubmit)} loading={loading} />
        </GlassCard>

        {/* Note */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, paddingHorizontal: 4 }}>
          <MaterialIcons name="lock" size={13} color="#6f787e" />
          <Text style={{ fontSize: 12, color: '#6f787e', fontFamily: 'Manrope', flex: 1, lineHeight: 18 }}>
            Vos données sont protégées et chiffrées
          </Text>
        </View>

        {/* Lien connexion */}
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
