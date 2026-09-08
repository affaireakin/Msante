import { useState } from 'react'
import {
  ScrollView, View, Text, TouchableOpacity, Alert,
  TextInput, Modal, StatusBar, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useAuth } from '@/features/auth/hooks/useAuth'
import {
  useAvailabilityV2,
  useCreateConsultationType,
  useUpdateConsultationType,
  useDeleteConsultationType,
  type ConsultationType,
  type ConsultationTypeDraft,
} from '@/features/practitioner/hooks/useAvailabilitySettings'
import { GlassCard } from '@/components/ui/GlassCard'

// Retour terrain (2026-09-07) : Prestations et Disponibilités doivent être
// deux rubriques séparées sur la nav bar (comme Doctolib), pas un seul écran
// combiné "Disponibilités & Prestations" — cet écran ne couvre plus que la
// section Prestations. Les mutations restent dans le même hook partagé
// (useAvailabilitySettings) que availability.tsx pour ne pas dupliquer la
// logique métier.

// Pas d'Audio sur mobile (section 11 du cahier des charges du 2026-09-02) —
// la gestion avancée reste sur le Web. Correspond exactement aux valeurs de
// consultation_types.mode côté web (pas de 'audio' dans cet enum).
const MODE_OPTIONS: Array<{ value: ConsultationType['mode']; label: string; icon: keyof typeof MaterialIcons.glyphMap }> = [
  { value: 'both',       label: 'Présentiel + Vidéo', icon: 'sync-alt' },
  { value: 'presentiel', label: 'Présentiel',          icon: 'location-on' },
  { value: 'video',      label: 'Téléconsultation',    icon: 'videocam' },
]

const DURATIONS = [15, 30, 45, 60, 90]

function modeLabel(mode: ConsultationType['mode']) {
  return MODE_OPTIONS.find(m => m.value === mode)?.label ?? mode
}

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

export default function PrestationsScreen() {
  const { practitioner } = useAuth()
  const pid = practitioner?.id ?? ''

  const { data, isLoading } = useAvailabilityV2(pid)
  const createType = useCreateConsultationType(pid)
  const updateType = useUpdateConsultationType(pid)
  const deleteType = useDeleteConsultationType(pid)

  const types = data?.types ?? []

  const [typeModal, setTypeModal] = useState<{ visible: boolean; editId?: string; draft: ConsultationTypeDraft }>({ visible: false, draft: EMPTY_TYPE_DRAFT })

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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <View style={{ paddingHorizontal: 24, paddingVertical: 16, backgroundColor: 'rgba(255,255,255,0.70)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.20)' }}>
        <Text style={{ fontFamily: 'Manrope', fontSize: 20, fontWeight: '800', color: '#0b1c30' }}>Prestations</Text>
        <Text style={{ fontFamily: 'Manrope', fontSize: 13, color: '#6f787e', marginTop: 2 }}>Formats de séance & tarifs</Text>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#82d8ff" />
        </View>
      ) : (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingBottom: 110, gap: 20 }} showsVerticalScrollIndicator={false}>
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
    </SafeAreaView>
  )
}
