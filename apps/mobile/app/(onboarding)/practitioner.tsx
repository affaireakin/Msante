import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
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

const STEP_LABELS = ['Profil', 'Documents', 'Récap']

export default function PractitionerOnboardingScreen() {
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [documents, setDocuments] = useState<UploadedDoc[]>([])
  const [step1Data, setStep1Data] = useState<PractitionerStep1FormData | null>(null)

  const { control, handleSubmit, watch, formState: { errors } } = useForm<PractitionerStep1FormData>({
    resolver: zodResolver(practitionerStep1Schema),
    defaultValues: { languages: ['fr'], session_currency: 'XOF', session_duration_min: 60 },
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ marginTop: 40, marginBottom: 28 }}>
          {/* Step indicator */}
          <StepIndicator total={3} current={step} />

          {/* Step labels */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, marginBottom: 20, paddingHorizontal: 4 }}>
            {STEP_LABELS.map((label, i) => (
              <Text key={label} style={{
                fontSize: 11,
                fontFamily: 'Manrope',
                fontWeight: i === step ? '700' : '400',
                color: i === step ? '#006685' : i < step ? '#1d7a3a' : '#6f787e',
              }}>
                {i < step ? '✓ ' : ''}{label}
              </Text>
            ))}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcons
                name={step === 0 ? 'medical-services' : step === 1 ? 'folder-open' : 'check-circle'}
                size={22}
                color="#006685"
              />
            </View>
            <View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#006685', letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'Manrope' }}>
                Étape {step + 1} sur 3
              </Text>
              <Text style={{ fontSize: 22, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope', letterSpacing: -0.5 }}>
                {step === 0 ? 'Profil professionnel' : step === 1 ? 'Vérification' : 'Récapitulatif'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── STEP 0 — Infos pro ── */}
        {step === 0 && (
          <GlassCard style={{ gap: 20 }}>
            <Controller control={control} name="speciality"
              render={({ field: { onChange, value } }) => (
                <AppTextInput
                  label="Spécialité" value={value} onChangeText={onChange}
                  error={errors.speciality?.message}
                  placeholder="Ex : Psychologue clinicien"
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
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '500', color: '#3f484d', fontFamily: 'Manrope' }}>Langues parlées</Text>
              <Controller control={control} name="languages"
                render={({ field: { onChange } }) => (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
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
                          style={{
                            paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                            borderWidth: 1.5,
                            borderColor: isSelected ? '#006685' : '#bec8ce',
                            backgroundColor: isSelected ? '#006685' : 'transparent',
                          }}
                        >
                          <Text style={{ fontSize: 13, fontFamily: 'Manrope', fontWeight: '600', color: isSelected ? '#fff' : '#0b1c30' }}>
                            {l.label}
                          </Text>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                )} />
              {errors.languages && (
                <Text style={{ fontSize: 12, color: '#ba1a1a', fontFamily: 'Manrope' }}>{errors.languages.message as string}</Text>
              )}
            </View>

            {/* Tarif */}
            <Controller control={control} name="session_price"
              render={({ field: { onChange, value } }) => (
                <AppTextInput
                  label="Tarif par session (XOF)"
                  value={value?.toString() ?? ''}
                  onChangeText={v => onChange(v ? Number(v) : undefined)}
                  keyboardType="numeric" error={errors.session_price?.message}
                  placeholder="25000"
                />
              )} />

            {/* Durée */}
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '500', color: '#3f484d', fontFamily: 'Manrope' }}>Durée de session</Text>
              <Controller control={control} name="session_duration_min"
                render={({ field: { onChange } }) => (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {DURATIONS.map(d => {
                      const active = selectedDuration === d
                      return (
                        <TouchableOpacity
                          key={d}
                          onPress={() => onChange(d)}
                          style={{
                            flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
                            borderWidth: 1.5,
                            borderColor: active ? '#006685' : '#bec8ce',
                            backgroundColor: active ? '#006685' : 'transparent',
                          }}
                        >
                          <Text style={{ fontSize: 13, fontFamily: 'Manrope', fontWeight: '700', color: active ? '#fff' : '#0b1c30' }}>
                            {d}min
                          </Text>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                )} />
            </View>

            <PrimaryButton label="Suivant →" onPress={handleSubmit(handleStep1)} />
          </GlassCard>
        )}

        {/* ── STEP 1 — Documents ── */}
        {step === 1 && (
          <GlassCard style={{ gap: 16 }}>
            <View>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope', marginBottom: 4 }}>
                Documents de vérification
              </Text>
              <Text style={{ fontSize: 12, color: '#6f787e', fontFamily: 'Manrope', lineHeight: 18 }}>
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

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
              <TouchableOpacity
                onPress={() => setStep(0)}
                style={{ flex: 1, paddingVertical: 16, borderRadius: 12, borderWidth: 1.5, borderColor: '#bec8ce', alignItems: 'center' }}
              >
                <Text style={{ fontFamily: 'Manrope', fontWeight: '600', color: '#0b1c30' }}>← Retour</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <PrimaryButton label="Suivant →" onPress={handleStep2} />
              </View>
            </View>
          </GlassCard>
        )}

        {/* ── STEP 2 — Récap ── */}
        {step === 2 && (
          <GlassCard style={{ gap: 20, alignItems: 'center' }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcons name="verified" size={36} color="#006685" />
            </View>

            <View style={{ alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope' }}>
                Récapitulatif
              </Text>
              <Text style={{ fontSize: 13, color: '#6f787e', fontFamily: 'Manrope', textAlign: 'center', lineHeight: 20 }}>
                Votre profil sera examiné sous 48h.{'\n'}Accès provisoire activé immédiatement.
              </Text>
            </View>

            <View style={{ width: '100%', gap: 12, backgroundColor: '#eff4ff', borderRadius: 14, padding: 16 }}>
              {[
                { label: 'Spécialité', value: step1Data?.speciality },
                { label: 'Tarif', value: `${step1Data?.session_price?.toLocaleString()} ${step1Data?.session_currency}` },
                { label: 'Durée', value: `${step1Data?.session_duration_min} min` },
                { label: 'Documents', value: `${documents.length} fichier${documents.length > 1 ? 's' : ''}` },
              ].map(row => (
                <View key={row.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <MaterialIcons name="check-circle" size={16} color="#006685" />
                  <Text style={{ fontSize: 13, fontFamily: 'Manrope', color: '#3f484d' }}>
                    <Text style={{ fontWeight: '700' }}>{row.label} : </Text>{row.value}
                  </Text>
                </View>
              ))}
            </View>

            <View style={{ width: '100%', flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => setStep(1)}
                style={{ flex: 1, paddingVertical: 16, borderRadius: 12, borderWidth: 1.5, borderColor: '#bec8ce', alignItems: 'center' }}
              >
                <Text style={{ fontFamily: 'Manrope', fontWeight: '600', color: '#0b1c30' }}>← Retour</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <PrimaryButton label="Soumettre" onPress={handleFinalSubmit} loading={loading} />
              </View>
            </View>
          </GlassCard>
        )}

        {/* Note bas */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, paddingHorizontal: 4 }}>
          <MaterialIcons name="security" size={14} color="#6f787e" />
          <Text style={{ fontSize: 12, color: '#6f787e', fontFamily: 'Manrope', flex: 1, lineHeight: 18 }}>
            Données chiffrées · Conformité RGPD · Vérification humaine par l'équipe M-Santé
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
