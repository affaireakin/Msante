import { useState, useCallback, useRef } from 'react'
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StatusBar,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useResponsive } from '@/hooks/useResponsive'
import {
  useCreatePrescription,
  type MedicationLine,
} from '@/features/practitioner/hooks/usePrescription'
import { searchBdpmMedications, type BdpmMedication } from '@/data/medications'
import { DiagnosticAidSearch } from '@/components/DiagnosticAidSearch'

// ─── Empty medication factory ────────────────────────────────────────────────

function emptyMedication(): MedicationLine {
  return { name: '', dosage: '', frequency: '', duration: '', instructions: '' }
}

// ─── MedicationCard ──────────────────────────────────────────────────────────

interface MedicationCardProps {
  index: number
  med: MedicationLine
  canRemove: boolean
  onChange: (index: number, field: keyof MedicationLine, value: string) => void
  onRemove: (index: number) => void
  r: ReturnType<typeof useResponsive>
}

function MedicationCard({ index, med, canRemove, onChange, onRemove, r }: MedicationCardProps) {
  const [suggestions, setSuggestions] = useState<BdpmMedication[]>([])
  const searchSeq = useRef(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleNameChange = useCallback(
    (text: string) => {
      onChange(index, 'name', text)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      const seq = ++searchSeq.current
      debounceRef.current = setTimeout(async () => {
        const results = await searchBdpmMedications(text)
        if (seq === searchSeq.current) setSuggestions(results)
      }, 250)
    },
    [index, onChange]
  )

  const handleSuggestionPress = useCallback(
    (entry: BdpmMedication) => {
      onChange(index, 'name', entry.denomination)
      setSuggestions([])
    },
    [index, onChange]
  )

  return (
    <View
      style={{
        backgroundColor: 'rgba(255,255,255,0.60)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.80)',
        padding: r.cardPadding,
        marginBottom: 12,
        shadowColor: '#82d8ff',
        shadowOpacity: 0.05,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 12,
        elevation: 2,
      }}
    >
      {/* Card header */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: '#e5eeff',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                fontSize: r.fs.sm,
                color: '#82d8ff',
                fontFamily: 'Manrope',
                fontWeight: '700',
              }}
            >
              {index + 1}
            </Text>
          </View>
          <Text
            style={{
              fontSize: r.fs.md,
              color: '#0b1c30',
              fontFamily: 'Manrope',
              fontWeight: '600',
            }}
          >
            Médicament {index + 1}
          </Text>
        </View>
        {canRemove && (
          <TouchableOpacity
            onPress={() => onRemove(index)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: '#ffdad6',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MaterialIcons name="close" size={16} color="#ba1a1a" />
          </TouchableOpacity>
        )}
      </View>

      {/* Medication name + autocomplete */}
      <FieldLabel label="Nom du médicament *" r={r} />
      <TextInput
        value={med.name}
        onChangeText={handleNameChange}
        placeholder="ex : Paracétamol"
        placeholderTextColor="#6f787e"
        style={fieldStyle(r)}
        autoCorrect={false}
        autoCapitalize="words"
        returnKeyType="next"
      />
      {suggestions.length > 0 && (
        <View
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 8,
            borderWidth: 1,
            borderColor: '#dce9ff',
            marginTop: 2,
            marginBottom: 4,
            overflow: 'hidden',
          }}
        >
          {suggestions.map((entry) => (
            <TouchableOpacity
              key={entry.cis_code}
              onPress={() => handleSuggestionPress(entry)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderBottomColor: '#eff4ff',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <MaterialIcons name="medication" size={16} color="#82d8ff" />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: r.fs.md,
                    color: '#0b1c30',
                    fontFamily: 'Manrope',
                    fontWeight: '600',
                  }}
                >
                  {entry.denomination}
                </Text>
              </View>
              {entry.forme_pharmaceutique && (
                <View
                  style={{
                    backgroundColor: '#e5eeff',
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 999,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 9,
                      color: '#82d8ff',
                      fontFamily: 'Manrope',
                      fontWeight: '700',
                    }}
                  >
                    {entry.forme_pharmaceutique}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Dosage + Frequency row */}
      <View style={{ flexDirection: 'row', gap: r.gutter }}>
        <View style={{ flex: 1 }}>
          <FieldLabel label="Dosage" r={r} />
          <TextInput
            value={med.dosage}
            onChangeText={(v) => onChange(index, 'dosage', v)}
            placeholder="ex : 500 mg"
            placeholderTextColor="#6f787e"
            style={fieldStyle(r)}
            returnKeyType="next"
          />
        </View>
        <View style={{ flex: 1 }}>
          <FieldLabel label="Fréquence" r={r} />
          <TextInput
            value={med.frequency}
            onChangeText={(v) => onChange(index, 'frequency', v)}
            placeholder="ex : 3×/jour"
            placeholderTextColor="#6f787e"
            style={fieldStyle(r)}
            returnKeyType="next"
          />
        </View>
      </View>

      {/* Duration */}
      <FieldLabel label="Durée" r={r} />
      <TextInput
        value={med.duration}
        onChangeText={(v) => onChange(index, 'duration', v)}
        placeholder="ex : 7 jours"
        placeholderTextColor="#6f787e"
        style={fieldStyle(r)}
        returnKeyType="next"
      />

      {/* Instructions for this med */}
      <FieldLabel label="Instructions spécifiques" r={r} />
      <TextInput
        value={med.instructions}
        onChangeText={(v) => onChange(index, 'instructions', v)}
        placeholder="ex : À prendre pendant les repas"
        placeholderTextColor="#6f787e"
        style={[fieldStyle(r), { minHeight: 60, textAlignVertical: 'top' }]}
        multiline
        returnKeyType="default"
      />
    </View>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function FieldLabel({ label, r }: { label: string; r: ReturnType<typeof useResponsive> }) {
  return (
    <Text
      style={{
        fontSize: r.fs.sm,
        color: '#3f484d',
        fontFamily: 'Manrope',
        fontWeight: '600',
        marginBottom: 4,
        marginTop: 8,
        letterSpacing: 0.3,
      }}
    >
      {label}
    </Text>
  )
}

function fieldStyle(r: ReturnType<typeof useResponsive>) {
  return {
    backgroundColor: 'rgba(255,255,255,0.80)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dce9ff',
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: r.fs.md,
    color: '#0b1c30',
    fontFamily: 'Manrope',
    marginBottom: 2,
  } as const
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NewPrescriptionScreen() {
  const r = useResponsive()
  const router = useRouter()
  const { patientId, patientName, appointmentId } =
    useLocalSearchParams<{ patientId: string; patientName: string; appointmentId: string }>()

  const { mutateAsync: createPrescription, isPending } = useCreatePrescription()

  const [diagnosis, setDiagnosis] = useState('')
  const [medications, setMedications] = useState<MedicationLine[]>([emptyMedication()])
  const [globalInstructions, setGlobalInstructions] = useState('')

  // ── Medication list handlers ──────────────────────────────────────────────

  const handleMedChange = useCallback(
    (index: number, field: keyof MedicationLine, value: string) => {
      setMedications((prev) => {
        const next = [...prev]
        next[index] = { ...next[index], [field]: value }
        return next
      })
    },
    []
  )

  const handleAddMedication = useCallback(() => {
    setMedications((prev) => [...prev, emptyMedication()])
  }, [])

  const handleRemoveMedication = useCallback((index: number) => {
    setMedications((prev) => prev.filter((_, i) => i !== index))
  }, [])

  // ── Validation ────────────────────────────────────────────────────────────

  const validate = useCallback(() => {
    if (!diagnosis.trim()) {
      Alert.alert('Champ requis', 'Veuillez saisir un diagnostic ou motif.')
      return false
    }
    if (!medications.some((m) => m.name.trim())) {
      Alert.alert('Médicament requis', 'Ajoutez au moins un médicament avec son nom.')
      return false
    }
    return true
  }, [diagnosis, medications])

  // ── Save handlers ─────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!validate()) return
    try {
      await createPrescription({
        patientId,
        appointmentId,
        medications: medications.filter((m) => m.name.trim()),
        diagnosis: diagnosis.trim(),
        instructions: globalInstructions.trim(),
        consultationType: 'standalone',
      })
      Alert.alert('Brouillon enregistré', "L'ordonnance a été sauvegardée.", [
        { text: 'OK', onPress: () => router.back() },
      ])
    } catch {
      Alert.alert('Erreur', "Impossible d'enregistrer l'ordonnance. Réessayez.")
    }
  }, [validate, createPrescription, patientId, appointmentId, medications, diagnosis, globalInstructions, router])

  const handleSign = useCallback(async () => {
    if (!validate()) return
    try {
      await createPrescription({
        patientId,
        appointmentId,
        medications: medications.filter((m) => m.name.trim()),
        diagnosis: diagnosis.trim(),
        instructions: globalInstructions.trim(),
        consultationType: 'standalone',
      })
      Alert.alert('Ordonnance créée', 'PDF bientôt disponible.', [
        { text: 'OK', onPress: () => router.back() },
      ])
    } catch {
      Alert.alert('Erreur', "Impossible d'enregistrer l'ordonnance. Réessayez.")
    }
  }, [validate, createPrescription, patientId, appointmentId, medications, diagnosis, globalInstructions, router])

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: '#f8f9ff' }}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9ff" />

      {/* ── Header ── */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: r.px,
          paddingVertical: 12,
          backgroundColor: 'rgba(248,249,255,0.95)',
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.60)',
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: '#e5eeff',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}
        >
          <MaterialIcons name="arrow-back" size={20} color="#82d8ff" />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: r.fs.lg,
              color: '#0b1c30',
              fontFamily: 'Manrope',
              fontWeight: '700',
              letterSpacing: -0.3,
            }}
            numberOfLines={1}
          >
            Nouvelle ordonnance
          </Text>
          {!!patientName && (
            <Text
              style={{
                fontSize: r.fs.sm,
                color: '#82d8ff',
                fontFamily: 'Manrope',
                fontWeight: '500',
                marginTop: 1,
              }}
              numberOfLines={1}
            >
              {patientName}
            </Text>
          )}
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: '#e5eeff',
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 20,
          }}
        >
          <MaterialIcons name="medical-services" size={14} color="#82d8ff" />
          <Text
            style={{
              fontSize: r.fs.xs,
              color: '#82d8ff',
              fontFamily: 'Manrope',
              fontWeight: '700',
              letterSpacing: 0.5,
            }}
          >
            ORDONNANCE
          </Text>
        </View>
      </View>

      {/* ── Form ── */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: r.px,
            paddingTop: 16,
            paddingBottom: 120,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Diagnosis */}
          <View style={{ marginBottom: 16 }}>
            <Text
              style={{
                fontSize: r.fs.md,
                color: '#0b1c30',
                fontFamily: 'Manrope',
                fontWeight: '700',
                marginBottom: 8,
              }}
            >
              Diagnostic / Motif *
            </Text>
            <TextInput
              value={diagnosis}
              onChangeText={setDiagnosis}
              placeholder="ex : Infection respiratoire aiguë"
              placeholderTextColor="#6f787e"
              style={[fieldStyle(r), { minHeight: 56, textAlignVertical: 'top' }]}
              multiline
              returnKeyType="default"
            />
            <View style={{ marginTop: 10 }}>
              <DiagnosticAidSearch patientId={patientId} onSelect={d => setDiagnosis(d.label)} />
            </View>
          </View>

          {/* Medications section */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <Text
              style={{
                fontSize: r.fs.md,
                color: '#0b1c30',
                fontFamily: 'Manrope',
                fontWeight: '700',
              }}
            >
              Médicaments ({medications.length})
            </Text>
            <TouchableOpacity
              onPress={handleAddMedication}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: '#82d8ff',
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 20,
              }}
            >
              <MaterialIcons name="add" size={16} color="#0b1c30" />
              <Text
                style={{
                  fontSize: r.fs.sm,
                  color: '#0b1c30',
                  fontFamily: 'Manrope',
                  fontWeight: '800',
                }}
              >
                Ajouter
              </Text>
            </TouchableOpacity>
          </View>

          {medications.map((med, idx) => (
            <MedicationCard
              key={idx}
              index={idx}
              med={med}
              canRemove={medications.length > 1}
              onChange={handleMedChange}
              onRemove={handleRemoveMedication}
              r={r}
            />
          ))}

          {/* Global instructions */}
          <View style={{ marginTop: 4 }}>
            <Text
              style={{
                fontSize: r.fs.md,
                color: '#0b1c30',
                fontFamily: 'Manrope',
                fontWeight: '700',
                marginBottom: 8,
              }}
            >
              Instructions générales
            </Text>
            <TextInput
              value={globalInstructions}
              onChangeText={setGlobalInstructions}
              placeholder="Consignes pour le patient, précautions, suivi…"
              placeholderTextColor="#6f787e"
              style={[fieldStyle(r), { minHeight: 80, textAlignVertical: 'top' }]}
              multiline
              returnKeyType="default"
            />
          </View>
        </ScrollView>

        {/* ── Footer buttons ── */}
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            paddingHorizontal: r.px,
            paddingTop: 12,
            paddingBottom: Platform.OS === 'ios' ? 16 : 12,
            backgroundColor: 'rgba(248,249,255,0.97)',
            borderTopWidth: 1,
            borderTopColor: 'rgba(220,233,255,0.80)',
            flexDirection: 'row',
            gap: r.gutter,
          }}
        >
          {/* Draft button */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={isPending}
            style={{
              flex: 1,
              height: 50,
              borderRadius: 12,
              borderWidth: 1.5,
              borderColor: '#82d8ff',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'transparent',
              opacity: isPending ? 0.6 : 1,
            }}
          >
            <Text
              style={{
                fontSize: r.fs.md,
                color: '#82d8ff',
                fontFamily: 'Manrope',
                fontWeight: '700',
              }}
            >
              Brouillon
            </Text>
          </TouchableOpacity>

          {/* Sign button */}
          <TouchableOpacity
            onPress={handleSign}
            disabled={isPending}
            style={{
              flex: 1,
              height: 50,
              borderRadius: 12,
              backgroundColor: '#82d8ff',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#82d8ff',
              shadowOpacity: 0.3,
              shadowOffset: { width: 0, height: 4 },
              shadowRadius: 12,
              elevation: 4,
              opacity: isPending ? 0.6 : 1,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MaterialIcons name="draw" size={18} color="#0b1c30" />
              <Text
                style={{
                  fontSize: r.fs.md,
                  color: '#0b1c30',
                  fontFamily: 'Manrope',
                  fontWeight: '800',
                }}
              >
                Signer
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
