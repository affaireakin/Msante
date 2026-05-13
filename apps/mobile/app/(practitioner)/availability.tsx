import { useState, useCallback } from 'react'
import {
  ScrollView, View, Text, TouchableOpacity, Switch, Alert,
  TextInput, Modal, StatusBar, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useAuth } from '@/features/auth/hooks/useAuth'
import {
  useAvailabilitySettings,
  useSaveSchedule,
  useAddException,
  useDeleteException,
  usePractitionerServices,
  useCreateService,
  useUpdateService,
  useDeleteService,
  type DaySlot,
  type PractitionerService,
  type ServiceDraft,
} from '@/features/practitioner/hooks/useAvailabilitySettings'
import { GlassCard } from '@/components/ui/GlassCard'

const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

const SESSION_TYPES: Array<{ value: 'video' | 'audio' | 'presentiel'; label: string; emoji: string }> = [
  { value: 'video',      label: 'Vidéo',       emoji: '📹' },
  { value: 'audio',      label: 'Audio',        emoji: '🎧' },
  { value: 'presentiel', label: 'Présentiel',   emoji: '🏥' },
]

const DURATIONS = [15, 30, 45, 60, 90]

// ── Subcomponents ─────────────────────────────────────────────────────────────

function TimeInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled: boolean }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      editable={!disabled}
      placeholder="09:00"
      placeholderTextColor="#bec8ce"
      keyboardType="numbers-and-punctuation"
      maxLength={5}
      style={{
        flex: 1, height: 40, borderRadius: 10, borderWidth: 1,
        borderColor: disabled ? '#e5eeff' : '#bec8ce',
        paddingHorizontal: 12, fontFamily: 'Manrope', fontSize: 14,
        color: disabled ? '#bec8ce' : '#0b1c30',
        backgroundColor: disabled ? '#f8f9ff' : 'rgba(255,255,255,0.80)',
        textAlign: 'center',
      }}
    />
  )
}

function DayRow({ slot, onChange }: { slot: DaySlot; onChange: (u: DaySlot) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 4, opacity: slot.is_active ? 1 : 0.5 }}>
      <Switch
        value={slot.is_active}
        onValueChange={(v) => onChange({ ...slot, is_active: v })}
        trackColor={{ false: '#cbcdcf', true: '#82d8ff' }}
        thumbColor={slot.is_active ? '#006685' : '#f8f9ff'}
        style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
      />
      <Text style={{ width: 32, fontFamily: 'Manrope', fontSize: 13, fontWeight: '700', color: '#0b1c30' }}>
        {DAY_LABELS[slot.day_of_week]}
      </Text>
      {slot.is_active ? (
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TimeInput value={slot.start_time} onChange={(v) => onChange({ ...slot, start_time: v })} disabled={false} />
          <Text style={{ fontFamily: 'Manrope', fontSize: 13, color: '#6f787e' }}>—</Text>
          <TimeInput value={slot.end_time} onChange={(v) => onChange({ ...slot, end_time: v })} disabled={false} />
        </View>
      ) : (
        <Text style={{ flex: 1, fontFamily: 'Manrope', fontSize: 13, color: '#6f787e', fontStyle: 'italic' }}>
          Indisponible
        </Text>
      )}
    </View>
  )
}

function ServiceCard({
  service, onEdit, onDelete, onToggle,
}: {
  service: PractitionerService
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
}) {
  const typeInfo = SESSION_TYPES.find(t => t.value === service.type)
  return (
    <View style={{
      borderRadius: 14, borderWidth: 1,
      borderColor: service.is_active ? 'rgba(0,102,133,0.25)' : 'rgba(190,200,206,0.40)',
      backgroundColor: service.is_active ? 'rgba(229,238,255,0.5)' : 'rgba(255,255,255,0.40)',
      padding: 14, gap: 10,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 18 }}>{typeInfo?.emoji ?? '📋'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: '700', color: '#0b1c30' }}>
              {service.name}
            </Text>
            <Text style={{ fontFamily: 'Manrope', fontSize: 12, color: '#6f787e', marginTop: 1 }}>
              {typeInfo?.label} · {service.duration_min} min
            </Text>
          </View>
        </View>
        <Text style={{ fontFamily: 'Manrope', fontSize: 16, fontWeight: '800', color: '#006685' }}>
          {service.price.toLocaleString()} {service.currency}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity
          onPress={onToggle}
          style={{
            flex: 1, paddingVertical: 8, borderRadius: 999, alignItems: 'center',
            backgroundColor: service.is_active ? '#ffdad6' : '#e5eeff',
          }}
        >
          <Text style={{ fontFamily: 'Manrope', fontSize: 12, fontWeight: '700', color: service.is_active ? '#ba1a1a' : '#006685' }}>
            {service.is_active ? 'Désactiver' : 'Activer'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onEdit}
          style={{ flex: 1, paddingVertical: 8, borderRadius: 999, alignItems: 'center', backgroundColor: '#e5eeff' }}
        >
          <Text style={{ fontFamily: 'Manrope', fontSize: 12, fontWeight: '700', color: '#006685' }}>Modifier</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onDelete}
          style={{ width: 36, paddingVertical: 8, borderRadius: 999, alignItems: 'center', backgroundColor: '#ffdad6' }}
        >
          <MaterialIcons name="delete-outline" size={16} color="#ba1a1a" />
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ── Service Modal ─────────────────────────────────────────────────────────────

const EMPTY_DRAFT: ServiceDraft = {
  name: '', type: 'video', duration_min: 60, price: 0, currency: 'XOF', is_active: true,
}

function ServiceModal({
  visible, initial, onSave, onClose, isSaving,
}: {
  visible: boolean
  initial: ServiceDraft
  onSave: (d: ServiceDraft) => void
  onClose: () => void
  isSaving: boolean
}) {
  const [draft, setDraft] = useState<ServiceDraft>(initial)

  // Reset when modal opens
  const handleOpen = () => setDraft(initial)

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} onShow={handleOpen}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(11,28,48,0.45)' }}>
        <View style={{ backgroundColor: '#f8f9ff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 18 }}>
          <Text style={{ fontFamily: 'Manrope', fontSize: 18, fontWeight: '800', color: '#0b1c30' }}>
            {initial.name ? 'Modifier la prestation' : 'Nouvelle prestation'}
          </Text>

          {/* Name */}
          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: 12, fontWeight: '700', color: '#6f787e' }}>Nom de la prestation</Text>
            <TextInput
              value={draft.name}
              onChangeText={(v) => setDraft(d => ({ ...d, name: v }))}
              placeholder="Ex: Consultation vidéo 30 min"
              placeholderTextColor="#bec8ce"
              style={{ height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#bec8ce', paddingHorizontal: 16, fontFamily: 'Manrope', fontSize: 14, color: '#0b1c30', backgroundColor: 'rgba(255,255,255,0.80)' }}
            />
          </View>

          {/* Type */}
          <View style={{ gap: 8 }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: 12, fontWeight: '700', color: '#6f787e' }}>Type de séance</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {SESSION_TYPES.map(t => (
                <TouchableOpacity
                  key={t.value}
                  onPress={() => setDraft(d => ({ ...d, type: t.value }))}
                  style={{
                    flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', gap: 4,
                    borderWidth: 2,
                    borderColor: draft.type === t.value ? '#006685' : '#e5eeff',
                    backgroundColor: draft.type === t.value ? '#e5eeff' : 'rgba(255,255,255,0.60)',
                  }}
                >
                  <Text style={{ fontSize: 18 }}>{t.emoji}</Text>
                  <Text style={{ fontFamily: 'Manrope', fontSize: 11, fontWeight: '700', color: draft.type === t.value ? '#006685' : '#6f787e' }}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Duration */}
          <View style={{ gap: 8 }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: 12, fontWeight: '700', color: '#6f787e' }}>Durée</Text>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {DURATIONS.map(d => (
                <TouchableOpacity
                  key={d}
                  onPress={() => setDraft(dr => ({ ...dr, duration_min: d }))}
                  style={{
                    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999,
                    borderWidth: 2,
                    borderColor: draft.duration_min === d ? '#006685' : '#e5eeff',
                    backgroundColor: draft.duration_min === d ? '#e5eeff' : 'rgba(255,255,255,0.60)',
                  }}
                >
                  <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '700', color: draft.duration_min === d ? '#006685' : '#6f787e' }}>
                    {d} min
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Price */}
          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: 12, fontWeight: '700', color: '#6f787e' }}>Tarif (XOF)</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TextInput
                value={draft.price === 0 ? '' : String(draft.price)}
                onChangeText={(v) => setDraft(d => ({ ...d, price: Number(v.replace(/\D/g, '')) || 0 }))}
                placeholder="15 000"
                placeholderTextColor="#bec8ce"
                keyboardType="numeric"
                style={{ flex: 1, height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#bec8ce', paddingHorizontal: 16, fontFamily: 'Manrope', fontSize: 14, color: '#0b1c30', backgroundColor: 'rgba(255,255,255,0.80)' }}
              />
              <View style={{ paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#e5eeff', borderRadius: 12 }}>
                <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '700', color: '#006685' }}>XOF</Text>
              </View>
            </View>
          </View>

          {/* Actions */}
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
            <TouchableOpacity onPress={onClose} style={{ flex: 1, paddingVertical: 14, borderRadius: 999, alignItems: 'center', borderWidth: 1, borderColor: '#bec8ce', backgroundColor: 'rgba(255,255,255,0.60)' }}>
              <Text style={{ fontFamily: 'Manrope', fontSize: 14, fontWeight: '600', color: '#3f484d' }}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onSave(draft)}
              disabled={isSaving || !draft.name.trim() || draft.price <= 0}
              style={{ flex: 1, paddingVertical: 14, borderRadius: 999, alignItems: 'center', backgroundColor: '#006685', opacity: (isSaving || !draft.name.trim() || draft.price <= 0) ? 0.5 : 1 }}
            >
              {isSaving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={{ fontFamily: 'Manrope', fontSize: 14, fontWeight: '700', color: '#fff' }}>Enregistrer</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

// ── Main Screen ───────────────────────────────────────────────────────────────

interface ExceptionForm { label: string; start_date: string; end_date: string }

export default function AvailabilityScreen() {
  const router = useRouter()
  const { practitioner } = useAuth()
  const pid = practitioner?.id ?? ''

  const { data, isLoading } = useAvailabilitySettings(pid)
  const saveSchedule    = useSaveSchedule(pid)
  const addException    = useAddException(pid)
  const deleteException = useDeleteException(pid)

  const { data: services = [], isLoading: servicesLoading } = usePractitionerServices(pid)
  const createService = useCreateService(pid)
  const updateService = useUpdateService(pid)
  const deleteService = useDeleteService(pid)

  const [localSlots, setLocalSlots] = useState<DaySlot[] | null>(null)
  const [showExcModal, setShowExcModal] = useState(false)
  const [excForm, setExcForm] = useState<ExceptionForm>({ label: '', start_date: '', end_date: '' })
  const [saved, setSaved] = useState(false)

  // Service modal state
  const [serviceModal, setServiceModal] = useState<{ visible: boolean; editId?: string; draft: ServiceDraft }>({
    visible: false, draft: EMPTY_DRAFT,
  })

  const slots = localSlots ?? data?.slots ?? []
  const exceptions = data?.exceptions ?? []

  const updateSlot = useCallback((updated: DaySlot) => {
    const base = localSlots ?? data?.slots ?? []
    setLocalSlots(base.map((s) => (s.day_of_week === updated.day_of_week ? updated : s)))
  }, [localSlots, data?.slots])

  const handleSave = async () => {
    if (!localSlots) return
    try {
      await saveSchedule.mutateAsync(localSlots)
      setLocalSlots(null)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch { Alert.alert('Erreur', 'Impossible de sauvegarder.') }
  }

  const handleAddException = async () => {
    if (!excForm.label || !excForm.start_date || !excForm.end_date) {
      Alert.alert('Champs manquants', 'Renseignez le libellé et les dates.')
      return
    }
    await addException.mutateAsync(excForm)
    setExcForm({ label: '', start_date: '', end_date: '' })
    setShowExcModal(false)
  }

  const handleDeleteException = (id: string, label: string) => {
    Alert.alert('Supprimer ?', `Retirer "${label}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => deleteException.mutate(id) },
    ])
  }

  const handleSaveService = async (draft: ServiceDraft) => {
    if (serviceModal.editId) {
      await updateService.mutateAsync({ id: serviceModal.editId, ...draft })
    } else {
      await createService.mutateAsync(draft)
    }
    setServiceModal({ visible: false, draft: EMPTY_DRAFT })
  }

  const handleDeleteService = (id: string, name: string) => {
    Alert.alert('Supprimer ?', `Supprimer la prestation "${name}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => deleteService.mutate(id) },
    ])
  }

  const isDirty  = localSlots !== null
  const isSaving = saveSchedule.isPending

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 12, backgroundColor: 'rgba(255,255,255,0.70)', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.20)' }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <MaterialIcons name="arrow-back" size={22} color="#006685" />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'Manrope', fontSize: 17, fontWeight: '700', color: '#0b1c30' }}>
          Disponibilités & Prestations
        </Text>
        {isDirty ? (
          <TouchableOpacity onPress={handleSave} disabled={isSaving} style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: '#006685', opacity: isSaving ? 0.6 : 1 }}>
            {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '700', color: '#fff' }}>Enregistrer</Text>}
          </TouchableOpacity>
        ) : (
          <View style={{ width: 80, alignItems: 'flex-end' }}>
            {saved && <Text style={{ fontFamily: 'Manrope', fontSize: 12, color: '#1d7a3a' }}>✓ Sauvegardé</Text>}
          </View>
        )}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, gap: 20 }} showsVerticalScrollIndicator={false}>

        {/* ── 1. Planning hebdomadaire ── */}
        <GlassCard>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcons name="repeat" size={20} color="#006685" />
            </View>
            <View>
              <Text style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: '700', color: '#0b1c30' }}>Planning hebdomadaire</Text>
              <Text style={{ fontFamily: 'Manrope', fontSize: 12, color: '#6f787e', marginTop: 1 }}>Horaires récurrents chaque semaine</Text>
            </View>
          </View>

          {isLoading ? (
            <View style={{ gap: 12 }}>
              {[1,2,3,4,5].map(i => <View key={i} style={{ height: 44, borderRadius: 10, backgroundColor: '#e5eeff' }} />)}
            </View>
          ) : (
            <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(190,200,206,0.30)', paddingTop: 8, gap: 4 }}>
              {DAY_ORDER.map(d => {
                const slot = slots.find(s => s.day_of_week === d)
                if (!slot) return null
                return <DayRow key={d} slot={slot} onChange={updateSlot} />
              })}
            </View>
          )}
        </GlassCard>

        {/* ── 2. Prestations ── */}
        <GlassCard>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#ffe170', alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcons name="medical-services" size={20} color="#705d00" />
              </View>
              <View>
                <Text style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: '700', color: '#0b1c30' }}>Mes prestations</Text>
                <Text style={{ fontFamily: 'Manrope', fontSize: 12, color: '#6f787e', marginTop: 1 }}>Types de séance & tarifs</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => setServiceModal({ visible: true, editId: undefined, draft: EMPTY_DRAFT })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#e5eeff' }}
            >
              <Text style={{ fontFamily: 'Manrope', fontSize: 13, color: '#006685' }}>+</Text>
              <Text style={{ fontFamily: 'Manrope', fontSize: 12, fontWeight: '700', color: '#006685' }}>Ajouter</Text>
            </TouchableOpacity>
          </View>

          {servicesLoading ? (
            <ActivityIndicator color="#006685" />
          ) : services.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 20, gap: 8 }}>
              <Text style={{ fontSize: 32 }}>📋</Text>
              <Text style={{ fontFamily: 'Manrope', fontSize: 13, color: '#6f787e', textAlign: 'center' }}>
                Aucune prestation configurée.{'\n'}Ajoutez vos types de séance avec leur tarif.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {services.map(svc => (
                <ServiceCard
                  key={svc.id}
                  service={svc}
                  onEdit={() => setServiceModal({
                    visible: true,
                    editId: svc.id,
                    draft: { name: svc.name, type: svc.type, duration_min: svc.duration_min, price: svc.price, currency: svc.currency, is_active: svc.is_active },
                  })}
                  onDelete={() => handleDeleteService(svc.id, svc.name)}
                  onToggle={() => updateService.mutate({ id: svc.id, is_active: !svc.is_active })}
                />
              ))}
            </View>
          )}
        </GlassCard>

        {/* ── 3. Congés & exceptions ── */}
        <GlassCard>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#ffdad6', alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcons name="block" size={20} color="#ba1a1a" />
              </View>
              <View>
                <Text style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: '700', color: '#0b1c30' }}>Congés & exceptions</Text>
                <Text style={{ fontFamily: 'Manrope', fontSize: 12, color: '#6f787e', marginTop: 1 }}>Bloquer des plages indisponibles</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => setShowExcModal(true)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#e5eeff' }}
            >
              <Text style={{ fontFamily: 'Manrope', fontSize: 13, color: '#006685' }}>+</Text>
              <Text style={{ fontFamily: 'Manrope', fontSize: 12, fontWeight: '700', color: '#006685' }}>Ajouter</Text>
            </TouchableOpacity>
          </View>

          {exceptions.length === 0 ? (
            <Text style={{ fontFamily: 'Manrope', fontSize: 13, color: '#6f787e', textAlign: 'center', paddingVertical: 8, fontStyle: 'italic' }}>
              Aucun congé planifié
            </Text>
          ) : (
            <View style={{ gap: 8 }}>
              {exceptions.map(exc => (
                <View key={exc.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(190,200,206,0.40)', backgroundColor: 'rgba(255,255,255,0.60)' }}>
                  <View>
                    <Text style={{ fontFamily: 'Manrope', fontSize: 14, fontWeight: '600', color: '#0b1c30' }}>{exc.label}</Text>
                    <Text style={{ fontFamily: 'Manrope', fontSize: 12, color: '#6f787e', marginTop: 2 }}>
                      {new Date(exc.start_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} → {new Date(exc.end_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDeleteException(exc.id, exc.label)} style={{ padding: 8 }}>
                    <MaterialIcons name="delete-outline" size={20} color="#ba1a1a" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </GlassCard>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── Add Exception Modal ── */}
      <Modal visible={showExcModal} transparent animationType="slide" onRequestClose={() => setShowExcModal(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(11,28,48,0.40)' }}>
          <View style={{ backgroundColor: '#f8f9ff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 16 }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: 18, fontWeight: '700', color: '#0b1c30', marginBottom: 4 }}>
              Ajouter une exception
            </Text>
            {[
              { label: 'Libellé (ex: Congés été)', key: 'label', placeholder: 'Congés été' },
              { label: 'Date de début (AAAA-MM-JJ)', key: 'start_date', placeholder: '2026-08-01' },
              { label: 'Date de fin (AAAA-MM-JJ)',   key: 'end_date',   placeholder: '2026-08-15' },
            ].map(({ label, key, placeholder }) => (
              <View key={key} style={{ gap: 6 }}>
                <Text style={{ fontFamily: 'Manrope', fontSize: 12, fontWeight: '700', color: '#6f787e' }}>{label}</Text>
                <TextInput
                  value={excForm[key as keyof ExceptionForm]}
                  onChangeText={(v) => setExcForm(f => ({ ...f, [key]: v }))}
                  placeholder={placeholder}
                  placeholderTextColor="#bec8ce"
                  style={{ height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#bec8ce', paddingHorizontal: 16, fontFamily: 'Manrope', fontSize: 14, color: '#0b1c30', backgroundColor: 'rgba(255,255,255,0.80)' }}
                />
              </View>
            ))}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <TouchableOpacity onPress={() => setShowExcModal(false)} style={{ flex: 1, paddingVertical: 14, borderRadius: 999, alignItems: 'center', borderWidth: 1, borderColor: '#bec8ce', backgroundColor: 'rgba(255,255,255,0.60)' }}>
                <Text style={{ fontFamily: 'Manrope', fontSize: 14, fontWeight: '600', color: '#3f484d' }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAddException} disabled={addException.isPending} style={{ flex: 1, paddingVertical: 14, borderRadius: 999, alignItems: 'center', backgroundColor: '#006685', opacity: addException.isPending ? 0.6 : 1 }}>
                <Text style={{ fontFamily: 'Manrope', fontSize: 14, fontWeight: '700', color: '#fff' }}>Confirmer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Add/Edit Service Modal ── */}
      <ServiceModal
        visible={serviceModal.visible}
        initial={serviceModal.draft}
        onSave={(d) => void handleSaveService(d)}
        onClose={() => setServiceModal({ visible: false, draft: EMPTY_DRAFT })}
        isSaving={createService.isPending || updateService.isPending}
      />
    </SafeAreaView>
  )
}
