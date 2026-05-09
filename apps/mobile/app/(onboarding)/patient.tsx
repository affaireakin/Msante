import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { GlassCard, AppTextInput, PrimaryButton } from '@/components/ui'
import { authService } from '@/features/auth/services/authService'
import { patientOnboardingSchema, type PatientOnboardingFormData } from '@/features/auth/schemas/authSchemas'

const COUNTRIES = [
  { label: 'Sénégal', flag: '🇸🇳', value: 'SN' as const },
  { label: "Côte d'Ivoire", flag: '🇨🇮', value: 'CI' as const },
  { label: 'Cameroun', flag: '🇨🇲', value: 'CM' as const },
  { label: 'France', flag: '🇫🇷', value: 'FR' as const },
]

const LANGUAGES = [
  { label: 'Français', value: 'fr' as const },
  { label: 'English', value: 'en' as const },
]

export default function PatientOnboardingScreen() {
  const [loading, setLoading] = useState(false)

  const { control, handleSubmit, formState: { errors } } = useForm<PatientOnboardingFormData>({
    resolver: zodResolver(patientOnboardingSchema),
    defaultValues: { country: 'SN', language: 'fr' },
  })

  const onSubmit = async (data: PatientOnboardingFormData) => {
    setLoading(true)
    try {
      await authService.completePatientOnboarding(data)
    } catch {
      Alert.alert('Erreur', 'Impossible de sauvegarder le profil. Réessayez.')
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
          {/* Progress bar */}
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 16 }}>
            <View style={{ flex: 1, height: 4, backgroundColor: '#006685', borderRadius: 2 }} />
            <View style={{ flex: 1, height: 4, backgroundColor: '#bec8ce', borderRadius: 2 }} />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcons name="person" size={22} color="#006685" />
            </View>
            <View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#006685', letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'Manrope' }}>
                Étape 1 sur 1
              </Text>
              <Text style={{ fontSize: 22, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope', letterSpacing: -0.5 }}>
                Votre profil
              </Text>
            </View>
          </View>
          <Text style={{ fontSize: 14, color: '#6f787e', fontFamily: 'Manrope', lineHeight: 20 }}>
            Ces informations personnalisent votre expérience M-Santé.
          </Text>
        </View>

        <GlassCard style={{ gap: 20 }}>
          {/* Nom */}
          <Controller control={control} name="full_name"
            render={({ field: { onChange, value } }) => (
              <AppTextInput
                label="Nom complet" value={value} onChangeText={onChange}
                error={errors.full_name?.message} placeholder="Prénom Nom"
                autoCapitalize="words"
              />
            )} />

          {/* Téléphone */}
          <Controller control={control} name="phone"
            render={({ field: { onChange, value } }) => (
              <AppTextInput
                label="Téléphone" value={value} onChangeText={onChange}
                keyboardType="phone-pad" error={errors.phone?.message}
                placeholder="+221 77 000 00 00"
              />
            )} />

          {/* Date de naissance */}
          <Controller control={control} name="date_of_birth"
            render={({ field: { onChange, value } }) => (
              <AppTextInput
                label="Date de naissance" value={value} onChangeText={onChange}
                error={errors.date_of_birth?.message} placeholder="AAAA-MM-JJ"
                keyboardType="numeric"
              />
            )} />

          {/* Pays */}
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: '500', color: '#3f484d', fontFamily: 'Manrope' }}>Pays</Text>
            <Controller control={control} name="country"
              render={({ field: { onChange, value } }) => (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {COUNTRIES.map(c => {
                    const selected = value === c.value
                    return (
                      <TouchableOpacity
                        key={c.value}
                        onPress={() => onChange(c.value)}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                          borderRadius: 20,
                          borderWidth: 1.5,
                          borderColor: selected ? '#006685' : '#bec8ce',
                          backgroundColor: selected ? '#006685' : 'transparent',
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Text style={{ fontSize: 16 }}>{c.flag}</Text>
                        <Text style={{ fontSize: 13, fontFamily: 'Manrope', fontWeight: '600', color: selected ? '#fff' : '#0b1c30' }}>
                          {c.label}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              )} />
            {errors.country && (
              <Text style={{ fontSize: 12, color: '#ba1a1a', fontFamily: 'Manrope' }}>{errors.country.message}</Text>
            )}
          </View>

          {/* Langue */}
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 13, fontWeight: '500', color: '#3f484d', fontFamily: 'Manrope' }}>Langue préférée</Text>
            <Controller control={control} name="language"
              render={({ field: { onChange, value } }) => (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {LANGUAGES.map(l => {
                    const selected = value === l.value
                    return (
                      <TouchableOpacity
                        key={l.value}
                        onPress={() => onChange(l.value)}
                        style={{
                          paddingHorizontal: 20,
                          paddingVertical: 10,
                          borderRadius: 20,
                          borderWidth: 1.5,
                          borderColor: selected ? '#006685' : '#bec8ce',
                          backgroundColor: selected ? '#006685' : 'transparent',
                        }}
                      >
                        <Text style={{ fontSize: 14, fontFamily: 'Manrope', fontWeight: '600', color: selected ? '#fff' : '#0b1c30' }}>
                          {l.label}
                        </Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
              )} />
          </View>

          {/* Submit */}
          <View style={{ marginTop: 4 }}>
            <PrimaryButton
              label="Commencer mon parcours →"
              onPress={handleSubmit(onSubmit)}
              loading={loading}
            />
          </View>
        </GlassCard>

        {/* Note bas */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, paddingHorizontal: 4 }}>
          <MaterialIcons name="lock" size={14} color="#6f787e" />
          <Text style={{ fontSize: 12, color: '#6f787e', fontFamily: 'Manrope', flex: 1, lineHeight: 18 }}>
            Vos données sont chiffrées et ne sont jamais partagées sans votre consentement.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
