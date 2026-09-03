import { useState } from 'react'
import {
  ScrollView, View, Text, TouchableOpacity, Alert,
  TextInput, Modal, StatusBar, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useAuth } from '@/features/auth/hooks/useAuth'
import {
  useAvailabilityV2,
  useCreateConsultationType,
  useUpdateConsultationType,
  useDeleteConsultationType,
  useAddWeeklyBlock,
  useToggleWeeklyBlock,
  useDeleteWeeklyBlock,
  useAddBlockedPeriod,
  useDeleteBlockedPeriod,
  formatDateFr,
  type ConsultationType,
  type ConsultationTypeDraft,
  type WeeklyBlock,
} from '@/features/practitioner/hooks/useAvailabilitySettings'
import { GlassCard } from '@/components/ui/GlassCard'

const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

// Pas d'Audio sur mobile (section 11 du cahier des charges) — la gestion
// avancée reste sur le Web. Correspond exactement aux valeurs de
// consultation_types.mode côté web (pas de 'audio' dans cet enum).
const MODE_OPTIONS: Array<{ value: ConsultationType['mode']; label: string; icon: keyof typeof MaterialIcons.glyphMap }> = [
  { value: 'both',       label: 'Présentiel + Vidéo', icon: 'sync-alt' },
  { value: 'presentiel', label: 'Présentiel',          icon: 'location-on' },
  { value: 'video',      label: 'Téléconsultation',    icon: 'videocam' },
]

const DURATIONS = [15, 30, 45, 60, 90]

const REASON_TYPES = [
  { value: 'vacation', label: 'Congés' },
  { value: 'training', label: 'Formation' },
  { value: 'meeting',  label: 'Réunion' },
  { value: 'sick',     label: 'Maladie' },
  { value: 'travel',   label: 'Déplacement' },
  { value: 'other',    label: 'Autre' },
]

function modeLabel(mode: ConsultationType['mode']) {
  return MODE_OPTIONS.find(m => m.value === mode)?.label ?? mode
}

function reasonLabel(value: string) {
  return REASON_TYPES.find(r => r.value === value)?.label ?? value
}

// ── Consultation type card + modal ───────────────────────────────────────────

function TypeCard({ type, onEdit, onDelete, onToggle }: {
  type: ConsultationType; onEdit: () => void; onDelete: () => void; onToggle: () => void
}) {
  return (
    <View style={{
      borderRadius: 14, borderWidth: 1,
      borderColor: type.is_active ? 'rgba(0,102,133,0.25)' : 'rgba(190,200,206,0.40)',
      backgroundColor: type.is_active ? 'rgba(229,238,255,0.5)' : 'rgba(255,255,255,0.40)',
      padding: 14, gap: 10,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          <View style={{ width: 12, height: 40, borderRadius: 6, backgroundColor: type.color }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: '700', color: '#0b1c30' }}>{type.name}</Text>
            <Text style={{ fontFamily: 'Manrope', fontSize: 12, color: '#6f787e', marginTop: 1 }}>
              {modeLabel(type.mode)} · {type.duration_min} min
            </Text>
          </View>
        </View>
        <Text style={{ fontFamily: 'Manrope', fontSize: 16, fontWeight: '800', color: '#82d8ff' }}>
          {type.price ? `${type.price.toLocaleString()} ${type.currency}` : '—'}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity onPress={onToggle} style={{ flex: 1, paddingVertical: 8, borderRadius: 999, alignItems: 'center', backgroundColor: type.is_active ? '#ffdad6' : '#e5eeff' }}>
          <Text style={{ fontFamily: 'Manrope', fontSize: 12, fontWeight: '700', color: type.is_active ? '#ba1a1a' : '#82d8ff' }}>
            {type.is_active ? 'Désactiver' : 'Activer'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onEdit} style={{ flex: 1, paddingVertical: 8, borderRadius: 999, alignItems: 'center', backgroundColor: '#e5eeff' }}>
          <Text style={{ fontFamily: 'Manrope', fontSize: 12, fontWeight: '700', color: '#82d8ff' }}>Modifier</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} style={{ width: 36, paddingVertical: 8, borderRadius: 999, alignItems: 'center', backgroundColor: '#ffdad6' }}>
          <MaterialIcons name="delete-outline" size={16} color="#ba1a1a" />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const EMPTY_TYPE_DRAFT: ConsultationTypeDraft = {
  name: '', duration_min: 30, price: null, currency: 'XOF', color: '#82d8ff', description: null, mode: 'both', is_active: true,
}

function TypeModal({ visible, initial, onSave, onClose, isSaving }: {
  visible: boolean; initial: ConsultationTypeDraft; onSave: (d: ConsultationTypeDraft) => void; onClose: () => void; isSaving: boolean
}) {
  const [draft, setDraft] = useState<ConsultationTypeDraft>(initial)
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} onShow={() => setDraft(initial)}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(11,28,48,0.45)' }}>
        <View style={{ backgroundColor: '#f8f9ff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 18 }}>
          <Text style={{ fontFamily: 'Manrope', fontSize: 18, fontWeight: '800', color: '#0b1c30' }}>
            {initial.name ? 'Modifier la prestation' : 'Nouvelle prestation'}
          </Text>

          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: 12, fontWeight: '700', color: '#6f787e' }}>Nom de la prestation</Text>
            <TextInput
              value={draft.name}
              onChangeText={v => setDraft(d => ({ ...d, name: v }))}
              placeholder="Ex: Consultation 30 min"
              placeholderTextColor="#bec8ce"
              style={{ height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#bec8ce', paddingHorizontal: 16, fontFamily: 'Manrope', fontSize: 14, color: '#0b1c30', backgroundColor: 'rgba(255,255,255,0.80)' }}
            />
          </View>

          <View style={{ gap: 8 }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: 12, fontWeight: '700', color: '#6f787e' }}>Format</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {MODE_OPTIONS.map(m => (
                <TouchableOpacity
                  key={m.value}
                  onPress={() => setDraft(d => ({ ...d, mode: m.value }))}
                  style={{
                    flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', gap: 4,
                    borderWidth: 2,
                    borderColor: draft.mode === m.value ? '#82d8ff' : '#e5eeff',
                    backgroundColor: draft.mode === m.value ? '#e5eeff' : 'rgba(255,255,255,0.60)',
                  }}
                >
                  <MaterialIcons name={m.icon} size={18} color={draft.mode === m.value ? '#82d8ff' : '#6f787e'} />
                  <Text style={{ fontFamily: 'Manrope', fontSize: 10, fontWeight: '700', color: draft.mode === m.value ? '#82d8ff' : '#6f787e', textAlign: 'center' }}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: 12, fontWeight: '700', color: '#6f787e' }}>Durée</Text>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {DURATIONS.map(d => (
                <TouchableOpacity
                  key={d}
                  onPress={() => setDraft(dr => ({ ...dr, duration_min: d }))}
                  style={{
                    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 2,
                    borderColor: draft.duration_min === d ? '#82d8ff' : '#e5eeff',
                    backgroundColor: draft.duration_min === d ? '#e5eeff' : 'rgba(255,255,255,0.60)',
                  }}
                >
                  <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '700', color: draft.duration_min === d ? '#82d8ff' : '#6f787e' }}>{d} min</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: 12, fontWeight: '700', color: '#6f787e' }}>Tarif (XOF)</Text>
            <TextInput
              value={draft.price ? String(draft.price) : ''}
              onChangeText={v => setDraft(d => ({ ...d, price: Number(v.replace(/\D/g, '')) || null }))}
              placeholder="15 000"
              placeholderTextColor="#bec8ce"
              keyboardType="numeric"
              style={{ height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#bec8ce', paddingHorizontal: 16, fontFamily: 'Manrope', fontSize: 14, color: '#0b1c30', backgroundColor: 'rgba(255,255,255,0.80)' }}
            />
          </View>

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
            <TouchableOpacity onPress={onClose} style={{ flex: 1, paddingVertical: 14, borderRadius: 999, alignItems: 'center', borderWidth: 1, borderColor: '#bec8ce', backgroundColor: 'rgba(255,255,255,0.60)' }}>
              <Text style={{ fontFamily: 'Manrope', fontSize: 14, fontWeight: '600', color: '#3f484d' }}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onSave(draft)}
              disabled={isSaving || !draft.name.trim()}
              style={{ flex: 1, paddingVertical: 14, borderRadius: 999, alignItems: 'center', backgroundColor: '#82d8ff', opacity: (isSaving || !draft.name.trim()) ? 0.5 : 1 }}
            >
              {isSaving ? <ActivityIndicator color="#0b1c30" size="small" /> : <Text style={{ fontFamily: 'Manrope', fontSize: 14, fontWeight: '800', color: '#0b1c30' }}>Enregistrer</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

// ── Weekly block modal ────────────────────────────────────────────────────────

interface BlockForm { start_time: string; end_time: string; type_ids: string[] }

function WeeklyBlockModal({ visible, day, types, onSave, onClose, isSaving }: {
  visible: boolean; day: number | null; types: ConsultationType[]
  onSave: (day: number, form: BlockForm) => void; onClose: () => void; isSaving: boolean
}) {
  const [form, setForm] = useState<BlockForm>({ start_time: '09:00', end_time: '17:00', type_ids: types.map(t => t.id) })
  const toggleType = (id: string) => setForm(f => ({ ...f, type_ids: f.type_ids.includes(id) ? f.type_ids.filter(x => x !== id) : [...f.type_ids, id] }))

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} onShow={() => setForm({ start_time: '09:00', end_time: '17:00', type_ids: types.map(t => t.id) })}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(11,28,48,0.45)' }}>
        <View style={{ backgroundColor: '#f8f9ff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 18 }}>
          <Text style={{ fontFamily: 'Manrope', fontSize: 18, fontWeight: '800', color: '#0b1c30' }}>
            Ajouter un créneau · {day !== null ? DAY_LABELS[day] : ''}
          </Text>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ fontFamily: 'Manrope', fontSize: 12, fontWeight: '700', color: '#6f787e' }}>Début</Text>
              <TextInput value={form.start_time} onChangeText={v => setForm(f => ({ ...f, start_time: v }))} placeholder="09:00" placeholderTextColor="#bec8ce"
                style={{ height: 44, borderRadius: 12, borderWidth: 1, borderColor: '#bec8ce', paddingHorizontal: 14, fontFamily: 'Manrope', fontSize: 14, color: '#0b1c30', backgroundColor: 'rgba(255,255,255,0.80)', textAlign: 'center' }} />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ fontFamily: 'Manrope', fontSize: 12, fontWeight: '700', color: '#6f787e' }}>Fin</Text>
              <TextInput value={form.end_time} onChangeText={v => setForm(f => ({ ...f, end_time: v }))} placeholder="17:00" placeholderTextColor="#bec8ce"
                style={{ height: 44, borderRadius: 12, borderWidth: 1, borderColor: '#bec8ce', paddingHorizontal: 14, fontFamily: 'Manrope', fontSize: 14, color: '#0b1c30', backgroundColor: 'rgba(255,255,255,0.80)', textAlign: 'center' }} />
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: 12, fontWeight: '700', color: '#6f787e' }}>Prestations disponibles sur ce créneau</Text>
            {types.length === 0 ? (
              <Text style={{ fontFamily: 'Manrope', fontSize: 13, color: '#ba1a1a' }}>Ajoutez d&apos;abord une prestation ci-dessus.</Text>
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
    </Modal>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

interface BlockedForm { start_date: string; end_date: string; reason_type: string; reason_label: string }
const EMPTY_BLOCKED_FORM: BlockedForm = { start_date: '', end_date: '', reason_type: 'vacation', reason_label: '' }

export default function AvailabilityScreen() {
  const router = useRouter()
  const { practitioner } = useAuth()
  const pid = practitioner?.id ?? ''

  const { data, isLoading } = useAvailabilityV2(pid)
  const createType = useCreateConsultationType(pid)
  const updateType = useUpdateConsultationType(pid)
  const deleteType = useDeleteConsultationType(pid)
  const addBlock = useAddWeeklyBlock(pid)
  const toggleBlock = useToggleWeeklyBlock(pid)
  const deleteBlock = useDeleteWeeklyBlock(pid)
  const addBlockedPeriod = useAddBlockedPeriod(pid)
  const deleteBlockedPeriod = useDeleteBlockedPeriod(pid)

  const types = data?.types ?? []
  const weekly = data?.weekly ?? []
  const blocked = data?.blocked ?? []

  const [typeModal, setTypeModal] = useState<{ visible: boolean; editId?: string; draft: ConsultationTypeDraft }>({ visible: false, draft: EMPTY_TYPE_DRAFT })
  const [blockModal, setBlockModal] = useState<{ visible: boolean; day: number | null }>({ visible: false, day: null })
  const [showBlockedModal, setShowBlockedModal] = useState(false)
  const [blockedForm, setBlockedForm] = useState<BlockedForm>(EMPTY_BLOCKED_FORM)

  const handleSaveType = async (draft: ConsultationTypeDraft) => {
    if (typeModal.editId) await updateType.mutateAsync({ id: typeModal.editId, ...draft })
    else await createType.mutateAsync(draft)
    setTypeModal({ visible: false, draft: EMPTY_TYPE_DRAFT })
  }

  const handleDeleteType = (id: string, name: string) => {
    Alert.alert('Supprimer ?', `Supprimer la prestation "${name}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => deleteType.mutate(id) },
    ])
  }

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

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: 'rgba(255,255,255,0.70)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.20)' }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <MaterialIcons name="arrow-back" size={22} color="#82d8ff" />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'Manrope', fontSize: 17, fontWeight: '700', color: '#0b1c30' }}>
          Disponibilités & Prestations
        </Text>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#82d8ff" />
        </View>
      ) : (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, gap: 20 }} showsVerticalScrollIndicator={false}>

        {/* ── 1. Prestations ── */}
        <GlassCard>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#ffe170', alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcons name="medical-services" size={20} color="#705d00" />
              </View>
              <View>
                <Text style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: '700', color: '#0b1c30' }}>Mes prestations</Text>
                <Text style={{ fontFamily: 'Manrope', fontSize: 12, color: '#6f787e', marginTop: 1 }}>Formats de séance & tarifs</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => setTypeModal({ visible: true, editId: undefined, draft: EMPTY_TYPE_DRAFT })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#e5eeff' }}
            >
              <Text style={{ fontFamily: 'Manrope', fontSize: 13, color: '#82d8ff' }}>+</Text>
              <Text style={{ fontFamily: 'Manrope', fontSize: 12, fontWeight: '700', color: '#82d8ff' }}>Ajouter</Text>
            </TouchableOpacity>
          </View>

          {types.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 20, gap: 8 }}>
              <MaterialIcons name="event-note" size={32} color="#cbd5e1" />
              <Text style={{ fontFamily: 'Manrope', fontSize: 13, color: '#6f787e', textAlign: 'center' }}>
                Aucune prestation configurée.{'\n'}Ajoutez vos formats de séance avec leur tarif.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {types.map(t => (
                <TypeCard
                  key={t.id}
                  type={t}
                  onEdit={() => setTypeModal({ visible: true, editId: t.id, draft: { name: t.name, duration_min: t.duration_min, price: t.price, currency: t.currency, color: t.color, description: t.description, mode: t.mode, is_active: t.is_active } })}
                  onDelete={() => handleDeleteType(t.id, t.name)}
                  onToggle={() => updateType.mutate({ id: t.id, is_active: !t.is_active })}
                />
              ))}
            </View>
          )}
        </GlassCard>

        {/* ── 2. Planning hebdomadaire ── */}
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

        {/* ── 3. Congés & indisponibilités ── */}
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

      <TypeModal
        visible={typeModal.visible}
        initial={typeModal.draft}
        onSave={d => void handleSaveType(d)}
        onClose={() => setTypeModal({ visible: false, draft: EMPTY_TYPE_DRAFT })}
        isSaving={createType.isPending || updateType.isPending}
      />

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
