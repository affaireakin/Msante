import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, Alert, Switch } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { GlassCard, AppTextInput, PrimaryButton } from '@/components/ui'
import { authService } from '@/features/auth/services/authService'
import { patientOnboardingSchema, type PatientOnboardingFormData } from '@/features/auth/schemas/authSchemas'
import { supabase } from '@/services/supabase'

// ─── Constants ──────────────────────────────────────────────────────────────

const NOTIF_ROWS: Array<{ key: 'reminders' | 'dailyCheckin' | 'tips' | 'community'; icon: string; label: string; subtitle: string }> = [
  { key: 'reminders', icon: 'alarm', label: 'Rappels rendez-vous', subtitle: 'Recevez des rappels avant chaque séance' },
  { key: 'dailyCheckin', icon: 'mood', label: 'Check-in bien-être quotidien', subtitle: 'Un petit moment pour vous chaque matin' },
  { key: 'tips', icon: 'lightbulb', label: 'Conseils & astuces bien-être', subtitle: 'Contenus sélectionnés par nos praticiens' },
  { key: 'community', icon: 'groups', label: 'Nouvelles de la communauté', subtitle: 'Actualités et mises à jour M-Santé' },
]

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

const HEALTH_CONDITIONS = [
  'Anxiété',
  'Dépression',
  'Insomnie',
  'Stress chronique',
  'Burn-out',
  'Trouble alimentaire',
  'Autre',
]

const WELLNESS_GOALS = [
  'Réduire le stress',
  'Améliorer le sommeil',
  'Gérer mes émotions',
  'Développer ma confiance',
  'Mieux me connaître',
  'Accompagnement professionnel',
]

type NotifPrefs = {
  reminders: boolean
  dailyCheckin: boolean
  tips: boolean
  community: boolean
}

// ─── Progress Bar ────────────────────────────────────────────────────────────

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <View style={{ gap: 6, marginBottom: 16 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: '#82d8ff', letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'Manrope', marginBottom: 6 }}>
        Étape {step} sur {total}
      </Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor: i < step ? '#82d8ff' : '#bec8ce',
            }}
          />
        ))}
      </View>
    </View>
  )
}

// ─── Section Header ──────────────────────────────────────────────────────────

function StepHeader({
  icon,
  title,
  subtitle,
  iconColor = '#82d8ff',
  iconBg = '#e5eeff',
}: {
  icon: string
  title: string
  subtitle: string
  iconColor?: string
  iconBg?: string
}) {
  return (
    <View style={{ marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: iconBg, alignItems: 'center', justifyContent: 'center' }}>
          <MaterialIcons name={icon as 'person'} size={22} color={iconColor} />
        </View>
        <Text style={{ fontSize: 22, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope', letterSpacing: -0.5 }}>
          {title}
        </Text>
      </View>
      <Text style={{ fontSize: 14, color: '#6f787e', fontFamily: 'Manrope', lineHeight: 20 }}>
        {subtitle}
      </Text>
    </View>
  )
}

// ─── Multi-select Chips ───────────────────────────────────────────────────────

function ChipSelector({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string
  options: string[]
  selected: string[]
  onToggle: (value: string) => void
}) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontSize: 14, fontWeight: '600', color: '#0b1c30', fontFamily: 'Manrope' }}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((opt) => {
          const isSelected = selected.includes(opt)
          return (
            <TouchableOpacity
              key={opt}
              onPress={() => onToggle(opt)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 20,
                borderWidth: 1.5,
                borderColor: isSelected ? '#82d8ff' : '#bec8ce',
                backgroundColor: isSelected ? '#82d8ff' : 'transparent',
              }}
            >
              <Text style={{ fontSize: 13, fontFamily: 'Manrope', fontWeight: '600', color: isSelected ? '#ffffff' : '#0b1c30' }}>
                {opt}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

// ─── Skip Button ─────────────────────────────────────────────────────────────

function SkipButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 4 }}>
      <Text style={{ fontSize: 14, color: '#82d8ff', fontFamily: 'Manrope', fontWeight: '600' }}>
        Passer cette étape →
      </Text>
    </TouchableOpacity>
  )
}

// ─── Back Button ─────────────────────────────────────────────────────────────

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ marginBottom: 16, alignSelf: 'flex-start', padding: 4 }}>
      <MaterialIcons name="arrow-back" size={24} color="#82d8ff" />
    </TouchableOpacity>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PatientOnboardingScreen() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)

  // Step 2 state — health metadata
  const [healthConditions, setHealthConditions] = useState<string[]>([])
  const [wellnessGoals, setWellnessGoals] = useState<string[]>([])

  // Step 3 state — notification prefs
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>({
    reminders: true,
    dailyCheckin: true,
    tips: false,
    community: false,
  })

  const { control, handleSubmit, formState: { errors } } = useForm<PatientOnboardingFormData>({
    resolver: zodResolver(patientOnboardingSchema),
    defaultValues: { country: 'SN', language: 'fr' },
  })

  // Toggle helpers
  const toggleChip = (list: string[], setter: (v: string[]) => void, value: string) => {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value])
  }

  const toggleNotif = (key: keyof NotifPrefs) => {
    setNotifPrefs((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // Final submit — called from step 4
  const onSubmit = async (data: PatientOnboardingFormData) => {
    setLoading(true)
    try {
      await authService.completePatientOnboarding(data)

      // Fire-and-forget: save extended health metadata
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        supabase
          .from('users')
          .update({
            health_conditions: healthConditions,
            wellness_goals: wellnessGoals,
            notif_prefs: notifPrefs,
          })
          .eq('id', user.id)
          .then(({ error }) => {
            if (error) console.error('profile metadata update failed', error.message)
          })
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de sauvegarder le profil. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 1 — Profile ─────────────────────────────────────────────────────

  if (step === 1) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ marginTop: 40, marginBottom: 28 }}>
            <ProgressBar step={1} total={4} />
            <StepHeader
              icon="person"
              title="Votre profil"
              subtitle="Ces informations personnalisent votre expérience M-Santé."
            />
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
                            borderColor: selected ? '#82d8ff' : '#bec8ce',
                            backgroundColor: selected ? '#82d8ff' : 'transparent',
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
                            borderColor: selected ? '#82d8ff' : '#bec8ce',
                            backgroundColor: selected ? '#82d8ff' : 'transparent',
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

            {/* Continue */}
            <View style={{ marginTop: 4 }}>
              <PrimaryButton
                label="Continuer →"
                onPress={handleSubmit(() => setStep(2))}
              />
            </View>
          </GlassCard>

          {/* Privacy note */}
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

  // ── Step 2 — Santé & antécédents ─────────────────────────────────────────

  if (step === 2) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ marginTop: 40, marginBottom: 28 }}>
            <BackButton onPress={() => setStep(1)} />
            <ProgressBar step={2} total={4} />
            <StepHeader
              icon="favorite"
              title="Votre santé"
              subtitle="Ces informations nous aident à personnaliser votre accompagnement. Tout reste confidentiel."
              iconColor="#ba1a1a"
              iconBg="#ffdad6"
            />
          </View>

          <GlassCard style={{ gap: 24 }}>
            <ChipSelector
              label="Avez-vous des antécédents médicaux ?"
              options={HEALTH_CONDITIONS}
              selected={healthConditions}
              onToggle={(v) => toggleChip(healthConditions, setHealthConditions, v)}
            />

            <ChipSelector
              label="Vos objectifs bien-être"
              options={WELLNESS_GOALS}
              selected={wellnessGoals}
              onToggle={(v) => toggleChip(wellnessGoals, setWellnessGoals, v)}
            />

            <View style={{ marginTop: 4 }}>
              <PrimaryButton
                label="Continuer →"
                onPress={() => setStep(3)}
              />
            </View>
          </GlassCard>

          <SkipButton onPress={() => {
              setHealthConditions([])
              setWellnessGoals([])
              setStep(3)
            }} />
        </ScrollView>
      </SafeAreaView>
    )
  }

  // ── Step 3 — Préférences notifications ───────────────────────────────────

  if (step === 3) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ marginTop: 40, marginBottom: 28 }}>
            <BackButton onPress={() => setStep(2)} />
            <ProgressBar step={3} total={4} />
            <StepHeader
              icon="notifications"
              title="Restez connecté(e)"
              subtitle="Choisissez les notifications qui vous conviennent. Modifiables à tout moment."
            />
          </View>

          <GlassCard style={{ gap: 0 }}>
            {NOTIF_ROWS.map((row, index) => (
              <View
                key={row.key}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                  paddingVertical: 16,
                  borderBottomWidth: index < NOTIF_ROWS.length - 1 ? 1 : 0,
                  borderBottomColor: '#e5eeff',
                }}
              >
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialIcons name={row.icon as 'alarm'} size={20} color="#82d8ff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#0b1c30', fontFamily: 'Manrope' }}>{row.label}</Text>
                  <Text style={{ fontSize: 12, color: '#6f787e', fontFamily: 'Manrope', marginTop: 2 }}>{row.subtitle}</Text>
                </View>
                <Switch
                  value={notifPrefs[row.key]}
                  onValueChange={() => toggleNotif(row.key)}
                  trackColor={{ false: '#bec8ce', true: '#82d8ff' }}
                  thumbColor="#ffffff"
                />
              </View>
            ))}
          </GlassCard>

          <View style={{ marginTop: 20 }}>
            <PrimaryButton
              label="Continuer →"
              onPress={() => setStep(4)}
            />
          </View>

          <SkipButton onPress={() => setStep(4)} />
        </ScrollView>
      </SafeAreaView>
    )
  }

  // ── Step 4 — Feature Tour ────────────────────────────────────────────────

  const featureCards = [
    {
      icon: 'mood',
      iconColor: '#82d8ff',
      iconBg: '#e5eeff',
      title: 'Mood Tracker',
      subtitle: 'Suivez votre humeur chaque jour et identifiez vos tendances émotionnelles.',
    },
    {
      icon: 'self-improvement',
      iconColor: '#7c3aed',
      iconBg: '#ede9fe',
      title: 'Méditation guidée',
      subtitle: 'Séances audio adaptées à votre niveau, dès 5 minutes par jour.',
    },
    {
      icon: 'smart-toy',
      iconColor: '#705d00',
      iconBg: '#fef9c3',
      title: 'Assistant Mounima',
      subtitle: 'Votre compagnon bien-être IA, disponible 24h/24 pour vous écouter.',
    },
  ]

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ marginTop: 40, marginBottom: 28 }}>
          <BackButton onPress={() => setStep(3)} />
          <ProgressBar step={4} total={4} />
          <StepHeader
            icon="auto-awesome"
            title="Votre boîte à outils"
            subtitle="Découvrez tout ce que M-Santé met à votre disposition pour prendre soin de vous."
            iconColor="#705d00"
            iconBg="#fef9c3"
          />
        </View>

        <View style={{ gap: 12 }}>
          {featureCards.map((card) => (
            <GlassCard
              key={card.title}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 14,
                paddingVertical: 16,
                paddingHorizontal: 16,
              }}
            >
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: card.iconBg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <MaterialIcons name={card.icon as 'mood'} size={24} color={card.iconColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope', marginBottom: 4 }}>
                  {card.title}
                </Text>
                <Text style={{ fontSize: 13, color: '#6f787e', fontFamily: 'Manrope', lineHeight: 18 }}>
                  {card.subtitle}
                </Text>
              </View>
            </GlassCard>
          ))}
        </View>

        {/* CTA */}
        <View style={{ marginTop: 28 }}>
          <PrimaryButton
            label="Commencer mon parcours →"
            onPress={handleSubmit(onSubmit)}
            loading={loading}
          />
        </View>

        {/* Privacy note */}
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
