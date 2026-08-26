import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { GlassCard, AppTextInput, PrimaryButton, PhoneCountryField, type PhoneCountryOption } from '@/components/ui'
import { authService } from '@/features/auth/services/authService'
import { signupSchema, type SignupFormData } from '@/features/auth/schemas/authSchemas'
import { supabase } from '@/services/supabase'

export default function SignupPractitionerScreen() {
  const router = useRouter()
  const { practitionerType, speciality } = useLocalSearchParams<{ practitionerType: string; speciality: string }>()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [acceptedCgu, setAcceptedCgu] = useState(false)

  // Contrairement au patient (accepté de partout), le pays du praticien est
  // restreint à la liste débloquée par l'admin (allowed_countries).
  const [countries, setCountries] = useState<(PhoneCountryOption & { dialCode: string; isoCode: string })[]>([])
  const [countryId, setCountryId] = useState('')
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState('')

  useEffect(() => {
    supabase.from('allowed_countries').select('id, iso_code, dial_code, flag_emoji').eq('is_active', true).order('sort_order')
      .then(({ data }) => {
        const rows = (data ?? []).map(c => ({ id: c.id, flag: c.flag_emoji, dial: c.dial_code, dialCode: c.dial_code, isoCode: c.iso_code }))
        setCountries(rows)
        if (rows.length) setCountryId(prev => prev || rows[0].id)
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
      const result = await authService.signUpWithEmail(data.email, data.password, 'practitioner', data.full_name, {
        practitioner_type: practitionerType ?? 'healthcare',
        speciality: speciality ?? '',
        phone: `${selectedCountry.dialCode}${phone.trim()}`,
        country: selectedCountry.isoCode,
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
              <MaterialIcons name="medical-services" size={22} color="#82d8ff" />
            </View>
            <View>
              <Text style={{ fontSize: 24, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope', letterSpacing: -0.5 }}>
                Rejoindre M-Santé
              </Text>
              <Text style={{ fontSize: 13, color: '#6f787e', fontFamily: 'Manrope' }}>Espace praticien</Text>
            </View>
          </View>
        </View>

        {/* Selected type/specialty summary */}
        {(practitionerType || speciality) && (
          <View style={{
            backgroundColor: '#e5eeff', borderRadius: 14, padding: 14,
            marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 10,
            borderWidth: 1, borderColor: '#82d8ff',
          }}>
            <MaterialIcons
              name={practitionerType === 'wellness' ? 'self-improvement' : 'local-hospital'}
              size={20} color="#82d8ff"
            />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#82d8ff', fontFamily: 'Manrope' }}>
                {practitionerType === 'wellness' ? 'Praticien bien-être' : 'Professionnel de santé'}
              </Text>
              {speciality ? (
                <Text style={{ fontSize: 12, color: '#3f484d', fontFamily: 'Manrope' }}>{speciality}</Text>
              ) : null}
            </View>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={{ fontSize: 12, color: '#82d8ff', fontFamily: 'Manrope', fontWeight: '600' }}>Modifier</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Badge info */}
        <View style={{
          backgroundColor: '#f0fdf4', borderRadius: 14, padding: 14,
          marginBottom: 16, gap: 6,
          borderWidth: 1, borderColor: '#bbf7d0',
        }}>
          {[
            'Accès provisoire immédiat pendant la vérification',
            'Vérification des documents sous 48h',
            "Commencez à recevoir des patients dès l'approbation",
          ].map(text => (
            <View key={text} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MaterialIcons name="check-circle" size={15} color="#1d7a3a" />
              <Text style={{ fontSize: 13, fontFamily: 'Manrope', color: '#0b1c30', flex: 1, lineHeight: 18 }}>
                {text}
              </Text>
            </View>
          ))}
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
              <AppTextInput label="Email professionnel" value={value} onChangeText={onChange}
                keyboardType="email-address" autoCapitalize="none"
                error={errors.email?.message} placeholder="nom@clinique.sn" />
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

          {/* Téléphone (obligatoire, pays limités par l'admin) */}
          <PhoneCountryField
            countries={countries}
            selectedId={countryId}
            onSelectCountry={id => { setCountryId(id); setPhoneError('') }}
            phone={phone}
            onChangePhone={t => { setPhone(t.replace(/[^\d\s]/g, '')); setPhoneError('') }}
            error={phoneError}
            helperText="Pays disponibles définis par l'administrateur."
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
