import { useState } from 'react'
import { View, Text, TouchableOpacity, SafeAreaView, ScrollView, Alert } from 'react-native'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { GlassCard, AppTextInput, PrimaryButton, StepIndicator, DocumentUploader } from '@/components/ui'
import { authService } from '@/features/auth/services/authService'
import { practitionerStep1Schema, type PractitionerStep1FormData } from '@/features/auth/schemas/authSchemas'
import type { PractitionerOnboardingData } from '@/types/auth'

type UploadedDoc = {
  uri: string
  name: string
  document_type: 'diploma' | 'license' | 'id_card' | 'other'
}

const DURATIONS = [30, 45, 60, 90]
const LANGUAGES = [
  { label: 'Français', value: 'fr' },
  { label: 'English', value: 'en' },
  { label: 'Wolof', value: 'wo' },
  { label: 'Arabic', value: 'ar' },
]

export default function PractitionerOnboardingScreen() {
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [documents, setDocuments] = useState<UploadedDoc[]>([])
  const [step1Data, setStep1Data] = useState<PractitionerStep1FormData | null>(null)

  const { control, handleSubmit, watch, formState: { errors } } = useForm<PractitionerStep1FormData>({
    resolver: zodResolver(practitionerStep1Schema),
    defaultValues: {
      languages: ['fr'],
      session_currency: 'XOF',
      session_duration_min: 60,
    },
  })

  const selectedLanguages = watch('languages') ?? []
  const selectedDuration = watch('session_duration_min')

  const handleStep1 = (data: PractitionerStep1FormData) => {
    setStep1Data(data)
    setStep(1)
  }

  const handleStep2 = () => {
    if (documents.length === 0) {
      Alert.alert('Documents requis', 'Uploadez au moins un document de vérification.')
      return
    }
    setStep(2)
  }

  const handleFinalSubmit = async () => {
    if (!step1Data) return
    setLoading(true)
    try {
      const data: PractitionerOnboardingData = { ...step1Data, documents }
      await authService.completePractitionerOnboarding(data)
    } catch {
      Alert.alert('Erreur', 'Impossible de soumettre. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  const toggleDoc = (doc: UploadedDoc) => {
    setDocuments(prev => [
      ...prev.filter(d => d.document_type !== doc.document_type),
      doc,
    ])
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="mt-12 mb-6">
          <Text className="text-2xl font-bold text-on-surface font-manrope mb-4">
            Profil praticien
          </Text>
          <StepIndicator total={3} current={step} />
          <Text className="text-xs text-on-surface-variant font-manrope text-center mt-2">
            Étape {step + 1} sur 3
          </Text>
        </View>

        {/* STEP 0 — Infos professionnelles */}
        {step === 0 && (
          <GlassCard className="gap-5">
            <Text className="text-base font-semibold text-on-surface font-manrope">
              Informations professionnelles
            </Text>

            <Controller control={control} name="speciality"
              render={({ field: { onChange, value } }) => (
                <AppTextInput
                  label="Spécialité" value={value} onChangeText={onChange}
                  error={errors.speciality?.message}
                  placeholder="Ex: Psychologue clinicien"
                />
              )} />

            <Controller control={control} name="bio"
              render={({ field: { onChange, value } }) => (
                <AppTextInput
                  label="Biographie" value={value} onChangeText={onChange}
                  multiline numberOfLines={4} error={errors.bio?.message}
                  placeholder="Décrivez votre parcours et votre approche thérapeutique..."
                  style={{ height: 100, textAlignVertical: 'top' }}
                />
              )} />

            {/* Langues */}
            <View className="gap-2">
              <Text className="text-sm font-manrope font-medium text-on-surface-variant">
                Langues parlées
              </Text>
              <Controller control={control} name="languages"
                render={({ field: { onChange } }) => (
                  <View className="flex-row flex-wrap gap-2">
                    {LANGUAGES.map(l => {
                      const isSelected = selectedLanguages.includes(l.value)
                      return (
                        <TouchableOpacity
                          key={l.value}
                          onPress={() => {
                            if (isSelected && selectedLanguages.length > 1) {
                              onChange(selectedLanguages.filter(v => v !== l.value))
                            } else if (!isSelected) {
                              onChange([...selectedLanguages, l.value])
                            }
                          }}
                          className={`px-3 py-2 rounded-full border ${
                            isSelected ? 'bg-primary border-primary' : 'border-outline-variant'
                          }`}
                        >
                          <Text className={`text-sm font-manrope ${isSelected ? 'text-white' : 'text-on-surface'}`}>
                            {l.label}
                          </Text>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                )} />
              {errors.languages && (
                <Text className="text-xs text-error font-manrope">{errors.languages.message}</Text>
              )}
            </View>

            {/* Tarif */}
            <Controller control={control} name="session_price"
              render={({ field: { onChange, value } }) => (
                <AppTextInput
                  label="Tarif par session (XOF)" value={value?.toString() ?? ''}
                  onChangeText={v => onChange(v ? Number(v) : undefined)}
                  keyboardType="numeric" error={errors.session_price?.message}
                  placeholder="25000"
                />
              )} />

            {/* Durée */}
            <View className="gap-2">
              <Text className="text-sm font-manrope font-medium text-on-surface-variant">
                Durée de session
              </Text>
              <Controller control={control} name="session_duration_min"
                render={({ field: { onChange } }) => (
                  <View className="flex-row gap-2">
                    {DURATIONS.map(d => (
                      <TouchableOpacity
                        key={d}
                        onPress={() => onChange(d)}
                        className={`flex-1 py-2 rounded-lg border items-center ${
                          selectedDuration === d ? 'bg-primary border-primary' : 'border-outline-variant'
                        }`}
                      >
                        <Text className={`text-sm font-manrope ${selectedDuration === d ? 'text-white' : 'text-on-surface'}`}>
                          {d}min
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )} />
            </View>

            <PrimaryButton label="Suivant →" onPress={handleSubmit(handleStep1)} />
          </GlassCard>
        )}

        {/* STEP 1 — Documents */}
        {step === 1 && (
          <GlassCard className="gap-5">
            <View>
              <Text className="text-base font-semibold text-on-surface font-manrope">
                Documents de vérification
              </Text>
              <Text className="text-xs text-on-surface-variant font-manrope mt-1">
                Stockés de façon sécurisée · Examinés sous 48h · PDF ou image
              </Text>
            </View>

            <DocumentUploader
              label="Diplôme" documentType="diploma"
              value={documents.find(d => d.document_type === 'diploma')}
              onUpload={toggleDoc}
            />
            <DocumentUploader
              label="Licence professionnelle" documentType="license"
              value={documents.find(d => d.document_type === 'license')}
              onUpload={toggleDoc}
            />
            <DocumentUploader
              label="Pièce d'identité" documentType="id_card"
              value={documents.find(d => d.document_type === 'id_card')}
              onUpload={toggleDoc}
            />

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setStep(0)}
                className="flex-1 py-4 rounded-lg border border-outline-variant items-center"
              >
                <Text className="text-on-surface font-manrope font-medium">← Retour</Text>
              </TouchableOpacity>
              <View className="flex-1">
                <PrimaryButton label="Suivant →" onPress={handleStep2} />
              </View>
            </View>
          </GlassCard>
        )}

        {/* STEP 2 — Récapitulatif */}
        {step === 2 && (
          <GlassCard className="gap-5 items-center">
            <View className="w-16 h-16 bg-primary-container rounded-full items-center justify-center">
              <Text className="text-3xl">📋</Text>
            </View>
            <View className="gap-1 items-center">
              <Text className="text-lg font-bold text-on-surface font-manrope">
                Récapitulatif
              </Text>
              <Text className="text-sm text-on-surface-variant font-manrope text-center">
                Votre profil sera examiné sous 48h. Accès provisoire activé immédiatement.
              </Text>
            </View>

            <View className="w-full gap-3 bg-surface-container-low rounded-xl p-4">
              <View className="flex-row items-center gap-2">
                <Text className="text-sm text-primary font-manrope">✓</Text>
                <Text className="text-sm font-manrope text-on-surface">
                  Spécialité : {step1Data?.speciality}
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Text className="text-sm text-primary font-manrope">✓</Text>
                <Text className="text-sm font-manrope text-on-surface">
                  Tarif : {step1Data?.session_price?.toLocaleString()} {step1Data?.session_currency}
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Text className="text-sm text-primary font-manrope">✓</Text>
                <Text className="text-sm font-manrope text-on-surface">
                  {documents.length} document{documents.length > 1 ? 's' : ''} uploadé{documents.length > 1 ? 's' : ''}
                </Text>
              </View>
            </View>

            <View className="w-full flex-row gap-3">
              <TouchableOpacity
                onPress={() => setStep(1)}
                className="flex-1 py-4 rounded-lg border border-outline-variant items-center"
              >
                <Text className="text-on-surface font-manrope font-medium">← Retour</Text>
              </TouchableOpacity>
              <View className="flex-1">
                <PrimaryButton
                  label="Soumettre"
                  onPress={handleFinalSubmit}
                  loading={loading}
                />
              </View>
            </View>
          </GlassCard>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
