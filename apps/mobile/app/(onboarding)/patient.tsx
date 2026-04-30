import { useState } from 'react'
import { View, Text, TouchableOpacity, SafeAreaView, ScrollView, Alert } from 'react-native'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { GlassCard, AppTextInput, PrimaryButton } from '@/components/ui'
import { authService } from '@/features/auth/services/authService'
import { patientOnboardingSchema, type PatientOnboardingFormData } from '@/features/auth/schemas/authSchemas'

const COUNTRIES = [
  { label: '🇸🇳 Sénégal', value: 'SN' as const },
  { label: '🇨🇮 Côte d\'Ivoire', value: 'CI' as const },
  { label: '🇨🇲 Cameroun', value: 'CM' as const },
  { label: '🇫🇷 France', value: 'FR' as const },
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
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="mt-12 mb-8">
          <View className="flex-row items-center gap-2 mb-2">
            <View className="h-1 flex-1 bg-primary rounded-full" />
            <View className="h-1 flex-1 bg-outline-variant rounded-full" />
          </View>
          <Text className="text-xs font-bold text-primary font-manrope uppercase tracking-widest mb-2">
            Étape 1 sur 1
          </Text>
          <Text className="text-2xl font-bold text-on-surface font-manrope">
            Complétez votre profil
          </Text>
          <Text className="text-sm text-on-surface-variant font-manrope mt-1">
            Ces informations personnalisent votre expérience.
          </Text>
        </View>

        <GlassCard className="gap-5">
          <Controller control={control} name="full_name"
            render={({ field: { onChange, value } }) => (
              <AppTextInput
                label="Nom complet" value={value} onChangeText={onChange}
                error={errors.full_name?.message} placeholder="Prénom Nom"
                autoCapitalize="words"
              />
            )} />

          <Controller control={control} name="phone"
            render={({ field: { onChange, value } }) => (
              <AppTextInput
                label="Téléphone" value={value} onChangeText={onChange}
                keyboardType="phone-pad" error={errors.phone?.message}
                placeholder="+221 77 000 00 00"
              />
            )} />

          <Controller control={control} name="date_of_birth"
            render={({ field: { onChange, value } }) => (
              <AppTextInput
                label="Date de naissance" value={value} onChangeText={onChange}
                error={errors.date_of_birth?.message} placeholder="AAAA-MM-JJ"
                keyboardType="numeric"
              />
            )} />

          {/* Pays */}
          <View className="gap-2">
            <Text className="text-sm font-manrope font-medium text-on-surface-variant">Pays</Text>
            <Controller control={control} name="country"
              render={({ field: { onChange, value } }) => (
                <View className="flex-row flex-wrap gap-2">
                  {COUNTRIES.map(c => (
                    <TouchableOpacity
                      key={c.value}
                      onPress={() => onChange(c.value)}
                      className={`px-3 py-2 rounded-full border ${
                        value === c.value
                          ? 'bg-primary border-primary'
                          : 'border-outline-variant bg-transparent'
                      }`}
                    >
                      <Text className={`text-sm font-manrope ${value === c.value ? 'text-white' : 'text-on-surface'}`}>
                        {c.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )} />
            {errors.country && (
              <Text className="text-xs text-error font-manrope">{errors.country.message}</Text>
            )}
          </View>

          {/* Langue */}
          <View className="gap-2">
            <Text className="text-sm font-manrope font-medium text-on-surface-variant">Langue préférée</Text>
            <Controller control={control} name="language"
              render={({ field: { onChange, value } }) => (
                <View className="flex-row gap-2">
                  {LANGUAGES.map(l => (
                    <TouchableOpacity
                      key={l.value}
                      onPress={() => onChange(l.value)}
                      className={`px-4 py-2 rounded-full border ${
                        value === l.value
                          ? 'bg-primary border-primary'
                          : 'border-outline-variant bg-transparent'
                      }`}
                    >
                      <Text className={`text-sm font-manrope ${value === l.value ? 'text-white' : 'text-on-surface'}`}>
                        {l.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )} />
          </View>

          <PrimaryButton
            label="Commencer mon parcours"
            onPress={handleSubmit(onSubmit)}
            loading={loading}
          />
        </GlassCard>
      </ScrollView>
    </SafeAreaView>
  )
}
