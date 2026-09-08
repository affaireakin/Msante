import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Image, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { GlassCard, AppTextInput, PrimaryButton, StepIndicator, pickDocumentAsset } from '@/components/ui'
import { supabase } from '@/services/supabase'
import { uploadLocalFile, mimeFromUri } from '@/services/uploadFile'
import { useAuthStore } from '@/features/auth/store/authStore'

const STEP_LABELS = ['Organisation', 'Documents']

const COUNTRIES = [
  { code: 'SN', label: 'Sénégal' },
  { code: 'CI', label: "Côte d'Ivoire" },
  { code: 'CM', label: 'Cameroun' },
  { code: 'FR', label: 'France' },
]

const STATUS_META: Record<string, { label: string; icon: React.ComponentProps<typeof MaterialIcons>['name']; bg: string; color: string }> = {
  pending: { label: 'En attente de validation', icon: 'pending-actions', bg: '#fef3c7', color: '#92400e' },
  rejected: { label: 'Demande refusée', icon: 'cancel', bg: '#ffdad6', color: '#ba1a1a' },
  suspended: { label: 'Organisation suspendue', icon: 'block', bg: '#ffdad6', color: '#ba1a1a' },
  archived: { label: 'Organisation archivée', icon: 'archive', bg: '#e5eeff', color: '#6f787e' },
}

interface PickedDoc { uri: string; name: string; type: string; isImage: boolean }

function slugify(name: string): string {
  const stripDiacritics = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '')
  const base = stripDiacritics(name.toLowerCase()).replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  const suffix = Math.random().toString(36).slice(2, 6)
  return `${base || 'organisation'}-${suffix}`
}

export default function OrganizationOnboardingScreen() {
  const router = useRouter()
  const setPendingOrganization = useAuthStore(s => s.setPendingOrganization)
  const signOut = useAuthStore(s => s.signOut)

  const [checking, setChecking] = useState(true)
  const [existingRequest, setExistingRequest] = useState<{ name: string; status: string } | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  const [step, setStep] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitProgress, setSubmitProgress] = useState('')
  const [error, setError] = useState('')

  // Step 0 — organisation
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [country, setCountry] = useState('SN')
  const [siret, setSiret] = useState('')

  // Step 1 — documents (au moins un requis, sans limite au-delà)
  const [docs, setDocs] = useState<PickedDoc[]>([])

  // Bug remonté : un échec réseau pendant l'envoi des documents (fréquent,
  // cf. "Network request failed") laissait l'utilisateur sur cet écran avec
  // la seule option de recliquer "Soumettre la demande" — qui refaisait un
  // INSERT organizations complet (slug randomisé à chaque appel, donc jamais
  // de conflit détecté) : deux lignes en base pour une seule vraie demande.
  // On retient l'id créé au premier passage pour ne jamais réinsérer, et les
  // index déjà envoyés pour ne pas dupliquer non plus les documents.
  const [orgId, setOrgId] = useState<string | null>(null)
  const [uploadedIdx, setUploadedIdx] = useState<Set<number>>(new Set())

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace('/(auth)/login'); return }
      setUserId(user.id)

      const { data: profile } = await supabase.from('users').select('email').eq('id', user.id).single()

      // .maybeSingle() lève une erreur dès qu'il existe 2 lignes ou plus —
      // exactement l'état où les doublons déjà créés mettent la base. La
      // vérification anti-doublon tombait donc en panne précisément quand
      // elle était le plus nécessaire, laissant passer une création de plus.
      // .limit(1) prend la demande la plus récente sans jamais échouer.
      const { data: existingOrgs } = await supabase
        .from('organizations')
        .select('name, status')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
      const existingOrg = existingOrgs?.[0] ?? null

      if (existingOrg) {
        setExistingRequest({ name: existingOrg.name, status: existingOrg.status })
        setChecking(false)
        return
      }

      if (profile?.email) setEmail(profile.email)
      setChecking(false)
    })
  }, [router])

  const pickDocument = async () => {
    const asset = await pickDocumentAsset()
    if (!asset) return
    setDocs(prev => [...prev, { uri: asset.uri, name: asset.name, isImage: asset.isImage, type: prev.length === 0 ? 'siret_extract' : 'autre' }])
  }

  const removeDoc = (idx: number) => setDocs(prev => prev.filter((_, i) => i !== idx))

  const handleNext = () => {
    setError('')
    if (step === 0) {
      if (!name.trim() || !email.trim() || !address.trim() || !city.trim() || !phone.trim()) {
        setError('Merci de compléter tous les champs obligatoires.')
        return
      }
      setStep(1)
    } else {
      void handleSubmit()
    }
  }

  const handleSubmit = async () => {
    if (!userId) return
    if (docs.length === 0) { setError('Au moins un document justificatif est requis.'); return }
    setSaving(true)
    setError('')
    try {
      let currentOrgId = orgId

      // L'état local ne survit pas à une fermeture de l'app : après un échec
      // d'envoi de documents, rouvrir l'app et resoumettre recréait une
      // organisation (c'est ainsi que 3 "Clinique rabi" se sont retrouvées en
      // base). On revérifie donc aussi côté serveur avant toute insertion.
      if (!currentOrgId) {
        const { data: priorOrgs } = await supabase
          .from('organizations')
          .select('id')
          .eq('created_by', userId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1)
        if (priorOrgs && priorOrgs.length > 0) {
          currentOrgId = priorOrgs[0].id
          setOrgId(priorOrgs[0].id)
        }
      }

      const isFreshSubmission = !currentOrgId

      if (!currentOrgId) {
        const { data: org, error: orgError } = await supabase
          .from('organizations')
          .insert({
            name: name.trim(),
            slug: slugify(name),
            email: email.trim(),
            phone: phone.trim(),
            address: address.trim(),
            city: city.trim(),
            postal_code: postalCode.trim() || null,
            country,
            siret: siret.trim() || null,
            status: 'pending',
            created_by: userId,
          })
          .select('id')
          .single()

        if (orgError || !org) throw new Error(orgError?.message ?? "Impossible de créer l'organisation")
        currentOrgId = org.id
        setOrgId(org.id)
      }
      if (!currentOrgId) throw new Error("Impossible de créer l'organisation")

      for (let i = 0; i < docs.length; i++) {
        if (uploadedIdx.has(i)) continue // déjà envoyé lors d'un essai précédent
        const doc = docs[i]
        setSubmitProgress(`Envoi du document ${i + 1}/${docs.length}...`)
        const ext = doc.name.split('.').pop() ?? 'pdf'
        const path = `${userId}/org_${doc.type}_${Date.now()}.${ext}`
        try {
          await uploadLocalFile('documents', path, doc.uri, mimeFromUri(doc.name, 'application/pdf'))
        } catch (e) {
          throw new Error(`Échec de l'envoi de "${doc.name}" : ${e instanceof Error ? e.message : 'erreur inconnue'}`)
        }
        await supabase.from('organization_documents').insert({
          organization_id: currentOrgId,
          document_type: doc.type,
          file_url: path,
        })
        setUploadedIdx(prev => new Set(prev).add(i))
      }

      if (isFreshSubmission) {
        const { data: admins } = await supabase.from('users').select('id').eq('role', 'admin')
        if (admins && admins.length > 0) {
          await supabase.from('notifications').insert(
            admins.map(a => ({
              user_id: a.id,
              type: 'organization_pending',
              title: 'Nouvelle organisation à valider',
              body: `${name.trim()} a soumis une demande de création.`,
              data: { organization_id: currentOrgId },
              channel: 'push',
              status: 'pending',
            })),
          )
        }
      }

      setPendingOrganization({ id: currentOrgId, name: name.trim(), status: 'pending' })
      setSubmitted(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Une erreur est survenue.')
    } finally {
      setSaving(false)
      setSubmitProgress('')
    }
  }

  const handleLogout = async () => {
    await signOut()
    router.replace('/(auth)/welcome')
  }

  if (checking) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff', alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color="#82d8ff" size="large" />
    </SafeAreaView>
  )

  // ── Écran de statut : une demande existe déjà pour ce compte ──
  if (existingRequest) {
    const meta = STATUS_META[existingRequest.status] ?? STATUS_META.pending
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: meta.bg, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <MaterialIcons name={meta.icon} size={36} color={meta.color} />
          </View>
          <Text style={{ fontFamily: 'Manrope', fontSize: 20, fontWeight: '800', color: '#0b1c30', textAlign: 'center', marginBottom: 8 }}>
            {meta.label}
          </Text>
          <Text style={{ fontFamily: 'Manrope', fontSize: 14, color: '#6f787e', textAlign: 'center', lineHeight: 21, marginBottom: 32 }}>
            {existingRequest.name}
          </Text>
          <TouchableOpacity onPress={handleLogout} style={{ paddingVertical: 12 }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: 14, fontWeight: '700', color: '#82d8ff' }}>Se déconnecter</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // ── Écran de confirmation post-soumission ──
  if (submitted) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <MaterialIcons name="check-circle" size={40} color="#82d8ff" />
        </View>
        <Text style={{ fontFamily: 'Manrope', fontSize: 22, fontWeight: '800', color: '#0b1c30', textAlign: 'center', marginBottom: 10 }}>
          Documents reçus
        </Text>
        <Text style={{ fontFamily: 'Manrope', fontSize: 14, color: '#6f787e', textAlign: 'center', lineHeight: 21, marginBottom: 32 }}>
          Nous avons bien reçu vos documents. Merci pour votre envoi. Nous allons les analyser et reviendrons vers vous dans les meilleurs délais.{'\n\n'}Vous serez informé(e) dès que l&apos;analyse sera terminée.
        </Text>
        <TouchableOpacity onPress={handleLogout} style={{ width: '100%', paddingVertical: 16, borderRadius: 999, alignItems: 'center', backgroundColor: '#82d8ff' }}>
          <Text style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: '800', color: '#0b1c30' }}>Retour à la connexion</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )

  // ── Formulaire ──
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      {/* Bug remonté : le clavier recouvrait les derniers champs (SIRET en
          particulier) — on ne voyait pas ce qu'on tapait, d'où des valeurs
          saisies à l'aveugle ("Hh", "Ff") retrouvées en base. */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ fontFamily: 'Manrope', fontSize: 22, fontWeight: '800', color: '#0b1c30', textAlign: 'center', marginBottom: 4 }}>
          Créer votre organisation
        </Text>
        <Text style={{ fontFamily: 'Manrope', fontSize: 13, color: '#6f787e', textAlign: 'center', marginBottom: 20 }}>
          {STEP_LABELS[step]}
        </Text>

        <View style={{ marginBottom: 20 }}>
          <StepIndicator total={STEP_LABELS.length} current={step} />
        </View>

        <GlassCard style={{ gap: 16 }}>
          {step === 0 && (
            <>
              <AppTextInput label="Nom de l'organisation *" value={name} onChangeText={setName} placeholder="Ex : Cabinet Médical Diallo" />
              <AppTextInput label="Email *" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
              <AppTextInput label="Téléphone *" value={phone} onChangeText={setPhone} placeholder="+221 7X XXX XX XX" keyboardType="phone-pad" />
              <AppTextInput label="Adresse *" value={address} onChangeText={setAddress} />
              <AppTextInput label="Ville *" value={city} onChangeText={setCity} />
              <AppTextInput label="Code postal" value={postalCode} onChangeText={setPostalCode} keyboardType="number-pad" />

              <View style={{ gap: 8 }}>
                <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '600', color: '#3f484d' }}>Pays</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {COUNTRIES.map(c => (
                    <TouchableOpacity key={c.code} onPress={() => setCountry(c.code)}
                      style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: country === c.code ? '#82d8ff' : '#e5eeff' }}>
                      <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '600', color: country === c.code ? '#fff' : '#82d8ff' }}>{c.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <AppTextInput label="SIRET (optionnel selon le pays)" value={siret} onChangeText={setSiret} />
            </>
          )}

          {step === 1 && (
            <>
              <Text style={{ fontFamily: 'Manrope', fontSize: 13, color: '#6f787e', lineHeight: 19 }}>
                Ajoutez au moins un justificatif (extrait SIRET/Kbis ou équivalent, pièce d&apos;identité du responsable...). Vous pouvez en ajouter autant que nécessaire.
              </Text>

              {docs.length > 0 && (
                <View style={{ gap: 8 }}>
                  {docs.map((doc, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f8f9ff', borderRadius: 12, borderWidth: 1, borderColor: '#e5eeff', padding: 12 }}>
                      {doc.isImage ? (
                        <Image source={{ uri: doc.uri }} style={{ width: 32, height: 32, borderRadius: 8 }} resizeMode="cover" />
                      ) : (
                        <MaterialIcons name="picture-as-pdf" size={18} color="#82d8ff" />
                      )}
                      <Text style={{ flex: 1, fontFamily: 'Manrope', fontSize: 13, color: '#0b1c30' }} numberOfLines={1}>{doc.name}</Text>
                      <TouchableOpacity onPress={() => removeDoc(i)}>
                        <MaterialIcons name="close" size={18} color="#6f787e" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity onPress={pickDocument}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#82d8ff', backgroundColor: 'rgba(0,102,133,0.03)' }}>
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialIcons name="add" size={18} color="#82d8ff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Manrope', fontSize: 14, fontWeight: '700', color: '#0b1c30' }}>Ajouter un document</Text>
                  <Text style={{ fontFamily: 'Manrope', fontSize: 12, color: '#6f787e' }}>PDF, JPG, PNG — max 10 Mo</Text>
                </View>
              </TouchableOpacity>
            </>
          )}

          {error ? <Text style={{ fontFamily: 'Manrope', fontSize: 13, color: '#ba1a1a' }}>{error}</Text> : null}
          {submitProgress ? (
            <Text style={{ fontFamily: 'Manrope', fontSize: 12, color: '#82d8ff', textAlign: 'center', fontWeight: '600' }}>
              {submitProgress}
            </Text>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
            {step > 0 && (
              <TouchableOpacity onPress={() => setStep(step - 1)} style={{ flex: 1, paddingVertical: 14, borderRadius: 999, alignItems: 'center', borderWidth: 1, borderColor: '#bec8ce' }}>
                <Text style={{ fontFamily: 'Manrope', fontSize: 14, fontWeight: '700', color: '#6f787e' }}>Retour</Text>
              </TouchableOpacity>
            )}
            <View style={{ flex: 2 }}>
              <PrimaryButton
                label={step === STEP_LABELS.length - 1 ? 'Soumettre la demande' : 'Suivant'}
                onPress={handleNext}
                loading={saving}
              />
            </View>
          </View>
        </GlassCard>

        <TouchableOpacity onPress={handleLogout} style={{ paddingVertical: 16 }}>
          <Text style={{ textAlign: 'center', fontSize: 13, color: '#6f787e', fontFamily: 'Manrope' }}>Se déconnecter</Text>
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
