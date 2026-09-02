import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, Alert, Image, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as ImagePicker from 'expo-image-picker'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { GlassCard, AppTextInput, PrimaryButton, StepIndicator, DocumentUploader } from '@/components/ui'
import { authService } from '@/features/auth/services/authService'
import { practitionerStep1Schema, type PractitionerStep1FormData } from '@/features/auth/schemas/authSchemas'
import { supabase } from '@/services/supabase'
import type { PractitionerOnboardingData } from '@/types/auth'
import type { DocumentType } from '@/types/database'

type UploadedDoc = {
  uri: string
  name: string
  document_type: DocumentType
}

type DocConfig = {
  key: DocumentType
  label: string
  hint: string
}

// Le `key` (document_type) doit être une des 6 valeurs acceptées par le
// CHECK constraint Postgres (diploma/license/id_card/order_certificate/
// professional_insurance/other) — le `label` reste la description exacte
// affichée à l'utilisateur, seul le tag interne est parfois approximatif
// faute d'un type dédié (ex. un justificatif d'adresse est tagué 'other'
// ou 'license' selon la catégorie, pour rester unique dans la liste).
const HEALTHCARE_DOCS: DocConfig[] = [
  { key: 'diploma', label: 'Diplôme', hint: 'Médecine, psychologie, psychiatrie...' },
  { key: 'license', label: 'Autorisation d\'exercer', hint: 'Numéro RPPS, ordre, ou équivalent' },
  { key: 'order_certificate', label: 'Carte de l\'Ordre professionnel', hint: 'Ordre des médecins, des psychologues...' },
  { key: 'id_card', label: 'Pièce d\'identité officielle', hint: 'CNI, passeport ou titre de séjour' },
  { key: 'other', label: 'Justificatif adresse professionnelle', hint: 'Bail, facture récente...' },
]

const WELLNESS_DOCS: DocConfig[] = [
  { key: 'diploma', label: 'Certificat de formation', hint: 'Diplôme bien-être, coaching certifié...' },
  { key: 'professional_insurance', label: 'Attestation d\'assurance pro', hint: 'Responsabilité civile professionnelle' },
  { key: 'id_card', label: 'Pièce d\'identité officielle', hint: 'CNI, passeport ou titre de séjour' },
  { key: 'license', label: 'Justificatif adresse professionnelle', hint: 'Bail, facture récente...' },
  { key: 'other', label: 'Portfolio ou références', hint: 'PDF de témoignages, certifications, références' },
]

const DURATIONS = [30, 45, 60, 90]
const LANGUAGES = [
  { label: 'Français', value: 'fr' },
  { label: 'English', value: 'en' },
  { label: 'Wolof', value: 'wo' },
  { label: 'Arabic', value: 'ar' },
]
const STEP_LABELS = ['Profil', 'Documents', 'Récap']

export default function PractitionerOnboardingScreen() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [documents, setDocuments] = useState<UploadedDoc[]>([])
  const [step1Data, setStep1Data] = useState<PractitionerStep1FormData | null>(null)
  const [practitionerType, setPractitionerType] = useState<'healthcare' | 'wellness'>('healthcare')
  const [profilePhoto, setProfilePhoto] = useState<{ uri: string } | null>(null)
  const [pickingPhoto, setPickingPhoto] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.user_metadata?.practitioner_type === 'wellness') {
        setPractitionerType('wellness')
      }
    })
  }, [])

  const { control, handleSubmit, watch, formState: { errors } } = useForm<PractitionerStep1FormData>({
    resolver: zodResolver(practitionerStep1Schema),
    defaultValues: { languages: ['fr'], session_currency: 'XOF', session_duration_min: 60 },
  })

  const selectedLanguages = watch('languages') ?? []
  const selectedDuration = watch('session_duration_min')
  const requiredDocs = practitionerType === 'healthcare' ? HEALTHCARE_DOCS : WELLNESS_DOCS

  const handleStep1 = (data: PractitionerStep1FormData) => {
    setStep1Data(data)
    setStep(1)
  }

  const handleStep2 = () => {
    if (!profilePhoto) {
      Alert.alert('Photo requise', 'Ajoutez votre photo de profil professionnelle.')
      return
    }
    const missing = requiredDocs.filter(d => !documents.find(doc => doc.document_type === d.key))
    if (missing.length > 0) {
      Alert.alert(
        'Documents manquants',
        `Veuillez uploader les ${requiredDocs.length} documents requis :\n• ${missing.map(d => d.label).join('\n• ')}`,
      )
      return
    }
    setStep(2)
  }

  const handleFinalSubmit = async () => {
    if (!step1Data) return
    setLoading(true)
    try {
      const data: PractitionerOnboardingData = {
        ...step1Data,
        documents,
        profilePhotoUri: profilePhoto?.uri,
      }
      await authService.completePractitionerOnboarding(data)
      router.replace('/(onboarding)/practitioner-submitted')
    } catch (err) {
      console.error('practitioner onboarding submit failed', err)
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      Alert.alert('Impossible de soumettre', message)
      setLoading(false)
    }
  }

  const toggleDoc = (doc: UploadedDoc) => {
    setDocuments(prev => [
      ...prev.filter(d => d.document_type !== doc.document_type),
      doc,
    ])
  }

  const pickProfilePhoto = async () => {
    setPickingPhoto(true)
    // Sélecteur système (Photo Picker) — aucune permission de galerie requise.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })
    setPickingPhoto(false)
    if (!result.canceled && result.assets[0]) {
      setProfilePhoto({ uri: result.assets[0].uri })
    }
  }

  const uploadedCount = requiredDocs.filter(d => documents.find(doc => doc.document_type === d.key)).length

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ marginTop: 40, marginBottom: 28 }}>
          <StepIndicator total={3} current={step} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, marginBottom: 20, paddingHorizontal: 4 }}>
            {STEP_LABELS.map((label, i) => (
              <Text key={label} style={{
                fontSize: 11,
                fontFamily: 'Manrope',
                fontWeight: i === step ? '700' : '400',
                color: i === step ? '#82d8ff' : i < step ? '#1d7a3a' : '#6f787e',
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
                color="#82d8ff"
              />
            </View>
            <View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#82d8ff', letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'Manrope' }}>
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
                            borderColor: isSelected ? '#82d8ff' : '#bec8ce',
                            backgroundColor: isSelected ? '#82d8ff' : 'transparent',
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
                            borderColor: active ? '#82d8ff' : '#bec8ce',
                            backgroundColor: active ? '#82d8ff' : 'transparent',
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
            {/* Header */}
            <View>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope', marginBottom: 4 }}>
                Documents de vérification
              </Text>
              <Text style={{ fontSize: 12, color: '#6f787e', fontFamily: 'Manrope', lineHeight: 18 }}>
                {uploadedCount + (profilePhoto ? 1 : 0)}/{requiredDocs.length + 1} · Stockés de façon sécurisée · Examinés sous 48h
              </Text>
            </View>

            {/* Progress bar */}
            <View style={{ height: 4, backgroundColor: '#e5eeff', borderRadius: 2 }}>
              <View style={{
                height: 4,
                borderRadius: 2,
                backgroundColor: '#82d8ff',
                width: `${Math.round(((uploadedCount + (profilePhoto ? 1 : 0)) / (requiredDocs.length + 1)) * 100)}%`,
              }} />
            </View>

            {/* Profile photo */}
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialIcons name="person" size={15} color="#82d8ff" />
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#82d8ff', fontFamily: 'Manrope', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  Photo de profil
                </Text>
                <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: '#ba1a1a' }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff', fontFamily: 'Manrope' }}>OBLIGATOIRE</Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={pickProfilePhoto}
                disabled={pickingPhoto}
                activeOpacity={0.7}
                style={{
                  borderWidth: 1.5,
                  borderStyle: profilePhoto ? 'solid' : 'dashed',
                  borderColor: profilePhoto ? '#82d8ff' : '#bec8ce',
                  borderRadius: 14,
                  padding: 16,
                  alignItems: 'center',
                  backgroundColor: profilePhoto ? '#f0f9ff' : 'transparent',
                  flexDirection: 'row',
                  gap: 16,
                }}
              >
                {profilePhoto ? (
                  <Image
                    source={{ uri: profilePhoto.uri }}
                    style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#e5eeff' }}
                  />
                ) : (
                  <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}>
                    {pickingPhoto
                      ? <ActivityIndicator size="small" color="#82d8ff" />
                      : <MaterialIcons name="add-a-photo" size={24} color="#82d8ff" />
                    }
                  </View>
                )}
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#0b1c30', fontFamily: 'Manrope' }}>
                    {profilePhoto ? 'Photo sélectionnée' : 'Choisir ma photo'}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#6f787e', fontFamily: 'Manrope' }}>
                    {profilePhoto ? 'Appuyer pour changer' : 'Photo professionnelle visible par les patients'}
                  </Text>
                </View>
                {profilePhoto && (
                  <MaterialIcons name="check-circle" size={22} color="#82d8ff" />
                )}
              </TouchableOpacity>
            </View>

            {/* Separator */}
            <View style={{ height: 1, backgroundColor: '#e5eeff' }} />

            {/* Required documents */}
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialIcons name="folder-open" size={15} color="#82d8ff" />
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#82d8ff', fontFamily: 'Manrope', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  {practitionerType === 'healthcare' ? 'Pièces professionnelles' : 'Justificatifs requis'} ({uploadedCount}/{requiredDocs.length})
                </Text>
              </View>

              {requiredDocs.map((docConf) => {
                const uploaded = documents.find(d => d.document_type === docConf.key)
                return (
                  <View key={docConf.key} style={{ gap: 4 }}>
                    <DocumentUploader
                      label={docConf.label}
                      documentType={docConf.key}
                      value={uploaded}
                      onUpload={toggleDoc}
                    />
                    {!uploaded && (
                      <Text style={{ fontSize: 11, color: '#6f787e', fontFamily: 'Manrope', paddingLeft: 4 }}>
                        {docConf.hint}
                      </Text>
                    )}
                  </View>
                )
              })}
            </View>

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
            {profilePhoto ? (
              <Image
                source={{ uri: profilePhoto.uri }}
                style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: '#82d8ff' }}
              />
            ) : (
              <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcons name="verified" size={36} color="#82d8ff" />
              </View>
            )}

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
                { label: 'Type', value: practitionerType === 'healthcare' ? 'Professionnel de santé' : 'Praticien bien-être' },
                { label: 'Spécialité', value: step1Data?.speciality },
                { label: 'Tarif', value: `${step1Data?.session_price?.toLocaleString()} ${step1Data?.session_currency}` },
                { label: 'Durée', value: `${step1Data?.session_duration_min} min` },
                { label: 'Photo', value: profilePhoto ? 'Ajoutée ✓' : '—' },
                { label: 'Documents', value: `${documents.length} / ${requiredDocs.length} fichiers` },
              ].map(row => (
                <View key={row.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <MaterialIcons name="check-circle" size={16} color="#82d8ff" />
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
