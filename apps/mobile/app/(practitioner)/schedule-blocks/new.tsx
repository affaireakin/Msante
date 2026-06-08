import { useState } from 'react'
import {
  ScrollView, View, Text, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, StatusBar,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useResponsive } from '@/hooks/useResponsive'
import { supabase } from '@/services/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

type BlockReason = 'vacances' | 'formation' | 'maladie' | 'indisponibilite' | 'autre'

const REASON_OPTIONS: Array<{ value: BlockReason; label: string; emoji: string }> = [
  { value: 'vacances',       label: 'Vacances',       emoji: '🏖️' },
  { value: 'formation',      label: 'Formation',      emoji: '📚' },
  { value: 'maladie',        label: 'Maladie',        emoji: '🤒' },
  { value: 'indisponibilite', label: 'Indisponibilité', emoji: '🚫' },
  { value: 'autre',          label: 'Autre',          emoji: '📌' },
]

// Parse JJ/MM/AAAA → AAAA-MM-JJ for DB
function parseDate(input: string): string | null {
  const trimmed = input.trim()
  // Accept JJ/MM/AAAA or DD/MM/YYYY
  const parts = trimmed.split('/')
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts
    if (dd && mm && yyyy && dd.length <= 2 && mm.length <= 2 && yyyy.length === 4) {
      const iso = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
      const d = new Date(iso)
      if (!isNaN(d.getTime())) return iso
    }
  }
  return null
}

function formatDisplayDate(isoDate: string): string {
  try {
    return new Date(isoDate).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch {
    return isoDate
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

function useCreateScheduleBlock(practitionerId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (block: {
      start_date: string
      end_date: string
      reason: BlockReason
      notes?: string
    }) => {
      const { error } = await supabase.from('schedule_blocks').insert({
        practitioner_id: practitionerId,
        ...block,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['schedule-blocks', practitionerId] })
    },
  })
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function NewScheduleBlockScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ start?: string; end?: string }>()
  const { practitioner } = useAuth()
  const { px, fs, cardPadding, gutter } = useResponsive()
  const pid = practitioner?.id ?? ''

  const [startInput, setStartInput] = useState(params.start ?? '')
  const [endInput, setEndInput]     = useState(params.end   ?? '')
  const [reason, setReason]         = useState<BlockReason | null>(null)
  const [notes, setNotes]           = useState('')

  const createBlock = useCreateScheduleBlock(pid)

  const handleConfirm = async () => {
    const startDate = parseDate(startInput)
    const endDate   = parseDate(endInput)

    if (!startDate) {
      Alert.alert('Date invalide', 'Renseignez la date de début au format JJ/MM/AAAA.')
      return
    }
    if (!endDate) {
      Alert.alert('Date invalide', 'Renseignez la date de fin au format JJ/MM/AAAA.')
      return
    }
    if (new Date(startDate) > new Date(endDate)) {
      Alert.alert('Dates invalides', 'La date de fin doit être égale ou postérieure à la date de début.')
      return
    }
    if (!reason) {
      Alert.alert('Motif requis', 'Sélectionnez un motif pour ce blocage.')
      return
    }

    try {
      await createBlock.mutateAsync({
        start_date: startDate,
        end_date:   endDate,
        reason,
        notes: notes.trim() || undefined,
      })
      Alert.alert('Période bloquée', `Du ${formatDisplayDate(startDate)} au ${formatDisplayDate(endDate)} bloqué avec succès.`, [
        { text: 'OK', onPress: () => router.back() },
      ])
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Une erreur est survenue.'
      Alert.alert('Erreur', msg)
    }
  }

  const isLoading = createBlock.isPending
  const canSubmit = startInput.trim().length > 0 && endInput.trim().length > 0 && reason !== null

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: px, paddingVertical: 12,
        backgroundColor: 'rgba(255,255,255,0.70)',
        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.20)',
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <MaterialIcons name="arrow-back" size={22} color="#006685" />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'Manrope', fontSize: fs.lg, fontWeight: '700', color: '#0b1c30' }}>
          Bloquer une période
        </Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: px, gap: gutter }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Date range card */}
        <View style={{
          backgroundColor: 'rgba(255,255,255,0.60)', borderRadius: 16,
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.80)',
          padding: cardPadding,
          shadowColor: '#006685', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 10 }, shadowRadius: 30,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcons name="date-range" size={18} color="#006685" />
            </View>
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.md, fontWeight: '700', color: '#0b1c30' }}>
              Période à bloquer
            </Text>
          </View>

          {/* Start date */}
          <View style={{ gap: 6, marginBottom: gutter }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '700', color: '#6f787e', letterSpacing: 0.5 }}>
              DATE DE DÉBUT
            </Text>
            <TextInput
              value={startInput}
              onChangeText={setStartInput}
              placeholder="JJ/MM/AAAA"
              placeholderTextColor="#bec8ce"
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              style={{
                height: 48, borderRadius: 12, borderWidth: 1,
                borderColor: startInput ? '#006685' : '#bec8ce',
                paddingHorizontal: 16,
                fontFamily: 'Manrope', fontSize: fs.md, color: '#0b1c30',
                backgroundColor: 'rgba(255,255,255,0.80)',
              }}
            />
          </View>

          {/* End date */}
          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '700', color: '#6f787e', letterSpacing: 0.5 }}>
              DATE DE FIN
            </Text>
            <TextInput
              value={endInput}
              onChangeText={setEndInput}
              placeholder="JJ/MM/AAAA"
              placeholderTextColor="#bec8ce"
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              style={{
                height: 48, borderRadius: 12, borderWidth: 1,
                borderColor: endInput ? '#006685' : '#bec8ce',
                paddingHorizontal: 16,
                fontFamily: 'Manrope', fontSize: fs.md, color: '#0b1c30',
                backgroundColor: 'rgba(255,255,255,0.80)',
              }}
            />
          </View>
        </View>

        {/* Reason selector */}
        <View style={{
          backgroundColor: 'rgba(255,255,255,0.60)', borderRadius: 16,
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.80)',
          padding: cardPadding,
          shadowColor: '#006685', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 10 }, shadowRadius: 30,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#ffe170', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcons name="label-outline" size={18} color="#705d00" />
            </View>
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.md, fontWeight: '700', color: '#0b1c30' }}>
              Motif du blocage
            </Text>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {REASON_OPTIONS.map(opt => {
              const selected = reason === opt.value
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setReason(opt.value)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999,
                    borderWidth: 2,
                    borderColor: selected ? '#006685' : '#e5eeff',
                    backgroundColor: selected ? '#e5eeff' : 'rgba(255,255,255,0.60)',
                  }}
                >
                  <Text style={{ fontSize: fs.sm }}>{opt.emoji}</Text>
                  <Text style={{
                    fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '700',
                    color: selected ? '#006685' : '#6f787e',
                  }}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>

        {/* Notes */}
        <View style={{
          backgroundColor: 'rgba(255,255,255,0.60)', borderRadius: 16,
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.80)',
          padding: cardPadding,
          shadowColor: '#006685', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 10 }, shadowRadius: 30,
        }}>
          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '700', color: '#6f787e', letterSpacing: 0.5 }}>
              NOTES (OPTIONNEL)
            </Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Précisions supplémentaires..."
              placeholderTextColor="#bec8ce"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={{
                minHeight: 80, borderRadius: 12, borderWidth: 1,
                borderColor: notes ? '#006685' : '#bec8ce',
                paddingHorizontal: 16, paddingVertical: 12,
                fontFamily: 'Manrope', fontSize: fs.md, color: '#0b1c30',
                backgroundColor: 'rgba(255,255,255,0.80)',
              }}
            />
          </View>
        </View>

        {/* Confirm button */}
        <TouchableOpacity
          onPress={() => void handleConfirm()}
          disabled={isLoading || !canSubmit}
          style={{
            width: '100%', paddingVertical: 16, borderRadius: 999,
            alignItems: 'center', justifyContent: 'center',
            backgroundColor: '#006685',
            opacity: (isLoading || !canSubmit) ? 0.5 : 1,
            marginTop: 4,
          }}
        >
          {isLoading
            ? <ActivityIndicator color="#fff" size="small" />
            : (
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.md, fontWeight: '700', color: '#fff' }}>
                Confirmer le blocage
              </Text>
            )
          }
        </TouchableOpacity>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  )
}
