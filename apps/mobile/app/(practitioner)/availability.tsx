import { useState } from 'react'
import {
  ScrollView, View, Text, TouchableOpacity, Alert,
  TextInput, Modal, StatusBar, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useAuth } from '@/features/auth/hooks/useAuth'
import {
  useAvailabilityV2,
  useAddWeeklyBlock,
  useToggleWeeklyBlock,
  useDeleteWeeklyBlock,
  useAddBlockedPeriod,
  useDeleteBlockedPeriod,
  formatDateFr,
  type ConsultationType,
  type WeeklyBlock,
} from '@/features/practitioner/hooks/useAvailabilitySettings'
import { GlassCard } from '@/components/ui/GlassCard'

// Retour terrain (2026-09-07) : Prestations et Disponibilités doivent être
// deux rubriques séparées sur la nav bar (comme Doctolib), pas un seul écran
// combiné "Disponibilités & Prestations" — la section Prestations a été
// déplacée dans prestations.tsx (nouvel onglet). Cet écran ne garde en
// lecture que `types` (nécessaire pour la liste à cocher du modal créneau).

const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

const REASON_TYPES = [
  { value: 'vacation', label: 'Congés' },
  { value: 'training', label: 'Formation' },
  { value: 'meeting',  label: 'Réunion' },
  { value: 'sick',     label: 'Maladie' },
  { value: 'travel',   label: 'Déplacement' },
  { value: 'other',    label: 'Autre' },
]

function reasonLabel(value: string) {
  return REASON_TYPES.find(r => r.value === value)?.label ?? value
}

// ── Weekly block modal ────────────────────────────────────────────────────────

interface BlockForm { start_time: string; end_time: string; type_ids: string[] }

// Bug remonté : le clavier par défaut (alphabétique) n'expose pas ":"
// directement, donc HH:MM tapé à la main tombait presque toujours sur
// "Format d'heure invalide". Même technique de masque déjà utilisée pour la
// date de naissance (onboarding/patient.tsx) : on ne saisit que des chiffres
// (clavier numérique dédié), le ":" s'insère tout seul.
function digitsToTime(digits: string): string {
  if (digits.length > 2) return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`
  return digits
}
function timeToDigits(time: string): string {
  return time.replace(/\D/g, '').slice(0, 4)
}

function WeeklyBlockModal({ visible, day, types, onSave, onClose, isSaving }: {
  visible: boolean; day: number | null; types: ConsultationType[]
  onSave: (day: number, form: BlockForm) => void; onClose: () => void; isSaving: boolean
}) {
  const [form, setForm] = useState<BlockForm>({ start_time: '09:00', end_time: '17:00', type_ids: types.map(t => t.id) })
  const toggleType = (id: string) => setForm(f => ({ ...f, type_ids: f.type_ids.includes(id) ? f.type_ids.filter(x => x !== id) : [...f.type_ids, id] }))

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} onShow={() => setForm({ start_time: '09:00', end_time: '17:00', type_ids: types.map(t => t.id) })}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(11,28,48,0.45)' }}>
        <View style={{ backgroundColor: '#f8f9ff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 18 }}>
          <Text style={{ fontFamily: 'Manrope', fontSize: 18, fontWeight: '800', color: '#0b1c30' }}>
            Ajouter un créneau · {day !== null ? DAY_LABELS[day] : ''}
          </Text>
          {/* Bug remonté : un praticien en déplacement (ex: France, heure
              d'été) a tapé son heure locale en pensant qu'elle serait
              comprise ainsi — la plateforme interprète toujours les horaires
              en heure du Sénégal (GMT, pas de changement d'heure), d'où un
              décalage de 2h à l'usage. On le rend explicite plutôt que de
              deviner un fuseau par praticien. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#e5eeff', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginTop: -8 }}>
            <MaterialIcons name="public" size={14} color="#006685" />
            <Text style={{ fontFamily: 'Manrope', fontSize: 11, fontWeight: '700', color: '#006685', flex: 1 }}>
              Heures en heure du Sénégal (GMT), même si vous êtes ailleurs
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ fontFamily: 'Manrope', fontSize: 12, fontWeight: '700', color: '#6f787e' }}>Début</Text>
              <TextInput
                value={form.start_time}
                onChangeText={v => setForm(f => ({ ...f, start_time: digitsToTime(timeToDigits(v)) }))}
                placeholder="09:00" placeholderTextColor="#bec8ce"
                keyboardType="number-pad" maxLength={5}
                style={{ height: 44, borderRadius: 12, borderWidth: 1, borderColor: '#bec8ce', paddingHorizontal: 14, fontFamily: 'Manrope', fontSize: 14, color: '#0b1c30', backgroundColor: 'rgba(255,255,255,0.80)', textAlign: 'center' }} />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ fontFamily: 'Manrope', fontSize: 12, fontWeight: '700', color: '#6f787e' }}>Fin</Text>
              <TextInput
                value={form.end_time}
                onChangeText={v => setForm(f => ({ ...f, end_time: digitsToTime(timeToDigits(v)) }))}
                placeholder="17:00" placeholderTextColor="#bec8ce"
                keyboardType="number-pad" maxLength={5}
                style={{ height: 44, borderRadius: 12, borderWidth: 1, borderColor: '#bec8ce', paddingHorizontal: 14, fontFamily: 'Manrope', fontSize: 14, color: '#0b1c30', backgroundColor: 'rgba(255,255,255,0.80)', textAlign: 'center' }} />
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: 12, fontWeight: '700', color: '#6f787e' }}>Prestations disponibles sur ce créneau</Text>
            {types.length === 0 ? (
              <Text style={{ fontFamily: 'Manrope', fontSize: 13, color: '#ba1a1a' }}>Ajoutez d&apos;abord une prestation dans l&apos;onglet Prestations.</Text>
            ) : (
              <View style={{ gap: 6 }}>
                {types.map(t => (
                  <TouchableOpacity key={t.id} onPress={() => toggleType(t.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
                    <MaterialIcons name={form.type_ids.includes(t.id) ? 'check-box' : 'check-box-outline-blank'} size={20} color={form.type_ids.includes(t.id) ? '#82d8ff' : '#bec8ce'} />
                    <Text style={{ fontFamily: 'Manrope', fontSize: 14, color: '#0b1c30' }}>{t.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
            <TouchableOpacity onPress={onClose} style={{ flex: 1, paddingVertical: 14, borderRadius: 999, alignItems: 'center', borderWidth: 1, borderColor: '#bec8ce', backgroundColor: 'rgba(255,255,255,0.60)' }}>
              <Text style={{ fontFamily: 'Manrope', fontSize: 14, fontWeight: '600', color: '#3f484d' }}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => day !== null && onSave(day, form)}
              disabled={isSaving || form.type_ids.length === 0}
              style={{ flex: 1, paddingVertical: 14, borderRadius: 999, alignItems: 'center', backgroundColor: '#82d8ff', opacity: (isSaving || form.type_ids.length === 0) ? 0.5 : 1 }}
            >
              {isSaving ? <ActivityIndicator color="#0b1c30" size="small" /> : <Text style={{ fontFamily: 'Manrope', fontSize: 14, fontWeight: '800', color: '#0b1c30' }}>Ajouter</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

interface BlockedForm { start_date: string; end_date: string; reason_type: string; reason_label: string }
const EMPTY_BLOCKED_FORM: BlockedForm = { start_date: '', end_date: '', reason_type: 'vacation', reason_label: '' }

export default function AvailabilityScreen() {
  const { practitioner } = useAuth()
  const pid = practitioner?.id ?? ''

  const { data, isLoading } = useAvailabilityV2(pid)
  const addBlock = useAddWeeklyBlock(pid)
  const toggleBlock = useToggleWeeklyBlock(pid)
  const deleteBlock = useDeleteWeeklyBlock(pid)
  const addBlockedPeriod = useAddBlockedPeriod(pid)
  const deleteBlockedPeriod = useDeleteBlockedPeriod(pid)

  const types = data?.types ?? []
  const weekly = data?.weekly ?? []
  const blocked = data?.blocked ?? []

  const [blockModal, setBlockModal] = useState<{ visible: boolean; day: number | null }>({ visible: false, day: null })
  const [showBlockedModal, setShowBlockedModal] = useState(false)
  const [blockedForm, setBlockedForm] = useState<BlockedForm>(EMPTY_BLOCKED_FORM)

  const handleSaveBlock = async (day: number, form: BlockForm) => {
    try {
      await addBlock.mutateAsync({ day_of_week: day, start_time: form.start_time, end_time: form.end_time, consultation_type_ids: form.type_ids })
      setBlockModal({ visible: false, day: null })
    } catch {
      Alert.alert('Erreur', 'Format d\'heure invalide (attendu HH:MM) ou créneau non enregistré.')
    }
  }

  const handleDeleteBlock = (id: string) => {
    Alert.alert('Supprimer ce créneau ?', 'Il ne sera plus proposé aux patients.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => deleteBlock.mutate(id) },
    ])
  }

  const handleAddBlockedPeriod = async () => {
    if (!blockedForm.start_date || !blockedForm.end_date) {
      Alert.alert('Champs manquants', 'Renseignez les deux dates (JJ/MM/AAAA).')
      return
    }
    const iso = (fr: string) => {
      const [d, m, y] = fr.split('/')
      return d && m && y ? `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}` : null
    }
    const start = iso(blockedForm.start_date)
    const end = iso(blockedForm.end_date)
    if (!start || !end) {
      Alert.alert('Date invalide', 'Utilisez le format JJ/MM/AAAA, ex: 01/08/2026.')
      return
    }
    try {
      await addBlockedPeriod.mutateAsync({ start_date: start, end_date: end, reason_type: blockedForm.reason_type, reason_label: blockedForm.reason_label || null })
      setBlockedForm(EMPTY_BLOCKED_FORM)
      setShowBlockedModal(false)
    } catch {
      Alert.alert('Erreur', 'Impossible d\'enregistrer cette période.')
    }
  }

  const handleDeleteBlockedPeriod = (id: string) => {
    Alert.alert('Supprimer ?', 'Cette période redeviendra disponible pour les rendez-vous.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => deleteBlockedPeriod.mutate(id) },
    ])
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <View style={{ paddingHorizontal: 24, paddingVertical: 16, backgroundColor: 'rgba(255,255,255,0.70)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.20)' }}>
        <Text style={{ fontFamily: 'Manrope', fontSize: 20, fontWeight: '800', color: '#0b1c30' }}>Disponibilités</Text>
        <Text style={{ fontFamily: 'Manrope', fontSize: 13, color: '#6f787e', marginTop: 2 }}>Planning hebdomadaire & congés</Text>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#82d8ff" />
        </View>
      ) : (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingBottom: 110, gap: 20 }} showsVerticalScrollIndicator={false}>

        {/* ── Planning hebdomadaire ── */}
        <GlassCard>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcons name="repeat" size={20} color="#82d8ff" />
            </View>
            <View>
              <Text style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: '700', color: '#0b1c30' }}>Planning hebdomadaire</Text>
              <Text style={{ fontFamily: 'Manrope', fontSize: 12, color: '#6f787e', marginTop: 1 }}>Créneaux récurrents chaque semaine</Text>
            </View>
          </View>

          <View style={{ gap: 14 }}>
            {DAY_ORDER.map(day => {
              const dayBlocks = weekly.filter((w: WeeklyBlock) => w.day_of_week === day)
              return (
                <View key={day} style={{ borderTopWidth: 1, borderTopColor: 'rgba(190,200,206,0.30)', paddingTop: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '700', color: '#0b1c30' }}>{DAY_LABELS[day]}</Text>
                    <TouchableOpacity onPress={() => setBlockModal({ visible: true, day })} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: '#e5eeff' }}>
                      <Text style={{ fontFamily: 'Manrope', fontSize: 11, fontWeight: '700', color: '#82d8ff' }}>+ Créneau</Text>
                    </TouchableOpacity>
                  </View>
                  {dayBlocks.length === 0 ? (
                    <Text style={{ fontFamily: 'Manrope', fontSize: 12, color: '#6f787e', fontStyle: 'italic', marginBottom: 6 }}>Indisponible</Text>
                  ) : (
                    <View style={{ gap: 6 }}>
                      {dayBlocks.map((b: WeeklyBlock) => (
                        <View key={b.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, opacity: b.is_active ? 1 : 0.5 }}>
                          <TouchableOpacity onPress={() => toggleBlock.mutate({ id: b.id, is_active: !b.is_active })}>
                            <MaterialIcons name={b.is_active ? 'toggle-on' : 'toggle-off'} size={26} color={b.is_active ? '#82d8ff' : '#bec8ce'} />
                          </TouchableOpacity>
                          <Text style={{ fontFamily: 'Manrope', fontSize: 13, color: '#0b1c30', flex: 1 }}>
                            {b.start_time.slice(0, 5)} — {b.end_time.slice(0, 5)}
                            <Text style={{ color: '#6f787e' }}> · {b.consultation_type_ids.length} prestation{b.consultation_type_ids.length > 1 ? 's' : ''}</Text>
                          </Text>
                          <TouchableOpacity onPress={() => handleDeleteBlock(b.id)} style={{ padding: 4 }}>
                            <MaterialIcons name="close" size={16} color="#ba1a1a" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        </GlassCard>

        {/* ── Congés & indisponibilités ── */}
        <GlassCard>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#ffdad6', alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcons name="event-busy" size={20} color="#ba1a1a" />
              </View>
              <View>
                <Text style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: '700', color: '#0b1c30' }}>Congés & indisponibilités</Text>
                <Text style={{ fontFamily: 'Manrope', fontSize: 12, color: '#6f787e', marginTop: 1 }}>Les créneaux dans ces périodes disparaissent automatiquement</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => { setBlockedForm(EMPTY_BLOCKED_FORM); setShowBlockedModal(true) }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#e5eeff' }}
            >
              <Text style={{ fontFamily: 'Manrope', fontSize: 13, color: '#82d8ff' }}>+</Text>
              <Text style={{ fontFamily: 'Manrope', fontSize: 12, fontWeight: '700', color: '#82d8ff' }}>Bloquer</Text>
            </TouchableOpacity>
          </View>

          {blocked.length === 0 ? (
            <Text style={{ fontFamily: 'Manrope', fontSize: 13, color: '#6f787e', textAlign: 'center', paddingVertical: 8, fontStyle: 'italic' }}>
              Aucune période bloquée
            </Text>
          ) : (
            <View style={{ gap: 8 }}>
              {blocked.map(b => (
                <View key={b.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(186,26,26,0.20)', backgroundColor: 'rgba(255,218,214,0.20)' }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: '#ffdad6', alignSelf: 'flex-start' }}>
                      <Text style={{ fontFamily: 'Manrope', fontSize: 11, fontWeight: '700', color: '#ba1a1a' }}>{reasonLabel(b.reason_type)}</Text>
                    </View>
                    <Text style={{ fontFamily: 'Manrope', fontSize: 13, color: '#0b1c30', fontWeight: '600' }}>
                      {formatDateFr(b.start_date, { day: '2-digit', month: 'short' })} → {formatDateFr(b.end_date)}
                    </Text>
                    {b.reason_label ? <Text style={{ fontFamily: 'Manrope', fontSize: 12, color: '#6f787e' }} numberOfLines={1}>{b.reason_label}</Text> : null}
                  </View>
                  <TouchableOpacity onPress={() => handleDeleteBlockedPeriod(b.id)} style={{ padding: 8 }}>
                    <MaterialIcons name="delete-outline" size={20} color="#ba1a1a" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </GlassCard>

        <View style={{ height: 32 }} />
      </ScrollView>
      )}

      <WeeklyBlockModal
        visible={blockModal.visible}
        day={blockModal.day}
        types={types.filter(t => t.is_active)}
        onSave={(day, form) => void handleSaveBlock(day, form)}
        onClose={() => setBlockModal({ visible: false, day: null })}
        isSaving={addBlock.isPending}
      />

      {/* ── Blocked period modal ── */}
      <Modal visible={showBlockedModal} transparent animationType="slide" onRequestClose={() => setShowBlockedModal(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(11,28,48,0.40)' }}>
          <View style={{ backgroundColor: '#f8f9ff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 16 }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: 18, fontWeight: '700', color: '#0b1c30', marginBottom: 4 }}>
              Bloquer une période
            </Text>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={{ fontFamily: 'Manrope', fontSize: 12, fontWeight: '700', color: '#6f787e' }}>Date de début (JJ/MM/AAAA)</Text>
                <TextInput
                  value={blockedForm.start_date}
                  onChangeText={v => setBlockedForm(f => ({ ...f, start_date: v }))}
                  placeholder="01/08/2026"
                  placeholderTextColor="#bec8ce"
                  keyboardType="numbers-and-punctuation"
                  style={{ height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#bec8ce', paddingHorizontal: 16, fontFamily: 'Manrope', fontSize: 14, color: '#0b1c30', backgroundColor: 'rgba(255,255,255,0.80)' }}
                />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={{ fontFamily: 'Manrope', fontSize: 12, fontWeight: '700', color: '#6f787e' }}>Date de fin (JJ/MM/AAAA)</Text>
                <TextInput
                  value={blockedForm.end_date}
                  onChangeText={v => setBlockedForm(f => ({ ...f, end_date: v }))}
                  placeholder="15/08/2026"
                  placeholderTextColor="#bec8ce"
                  keyboardType="numbers-and-punctuation"
                  style={{ height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#bec8ce', paddingHorizontal: 16, fontFamily: 'Manrope', fontSize: 14, color: '#0b1c30', backgroundColor: 'rgba(255,255,255,0.80)' }}
                />
              </View>
            </View>

            <View style={{ gap: 8 }}>
              <Text style={{ fontFamily: 'Manrope', fontSize: 12, fontWeight: '700', color: '#6f787e' }}>Motif</Text>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {REASON_TYPES.map(r => (
                  <TouchableOpacity
                    key={r.value}
                    onPress={() => setBlockedForm(f => ({ ...f, reason_type: r.value }))}
                    style={{
                      paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 2,
                      borderColor: blockedForm.reason_type === r.value ? '#82d8ff' : '#e5eeff',
                      backgroundColor: blockedForm.reason_type === r.value ? '#e5eeff' : 'rgba(255,255,255,0.60)',
                    }}
                  >
                    <Text style={{ fontFamily: 'Manrope', fontSize: 12, fontWeight: '700', color: blockedForm.reason_type === r.value ? '#82d8ff' : '#6f787e' }}>{r.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ fontFamily: 'Manrope', fontSize: 12, fontWeight: '700', color: '#6f787e' }}>Note (optionnel)</Text>
              <TextInput
                value={blockedForm.reason_label}
                onChangeText={v => setBlockedForm(f => ({ ...f, reason_label: v }))}
                placeholder="Ex: Congés été"
                placeholderTextColor="#bec8ce"
                style={{ height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#bec8ce', paddingHorizontal: 16, fontFamily: 'Manrope', fontSize: 14, color: '#0b1c30', backgroundColor: 'rgba(255,255,255,0.80)' }}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <TouchableOpacity onPress={() => setShowBlockedModal(false)} style={{ flex: 1, paddingVertical: 14, borderRadius: 999, alignItems: 'center', borderWidth: 1, borderColor: '#bec8ce', backgroundColor: 'rgba(255,255,255,0.60)' }}>
                <Text style={{ fontFamily: 'Manrope', fontSize: 14, fontWeight: '600', color: '#3f484d' }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => void handleAddBlockedPeriod()} disabled={addBlockedPeriod.isPending} style={{ flex: 1, paddingVertical: 14, borderRadius: 999, alignItems: 'center', backgroundColor: '#82d8ff', opacity: addBlockedPeriod.isPending ? 0.6 : 1 }}>
                <Text style={{ fontFamily: 'Manrope', fontSize: 14, fontWeight: '800', color: '#0b1c30' }}>Confirmer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}
