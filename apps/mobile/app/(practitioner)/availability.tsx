import { useState, useCallback } from 'react'
import {
  ScrollView, View, Text, TouchableOpacity, Switch, Alert,
  TextInput, Modal, StatusBar, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useAuth } from '@/features/auth/hooks/useAuth'
import {
  useAvailabilitySettings,
  useSaveSchedule,
  useAddException,
  useDeleteException,
  type DaySlot,
} from '@/features/practitioner/hooks/useAvailabilitySettings'
import { GlassCard } from '@/components/ui/GlassCard'

const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

function TimeInput({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  disabled: boolean
}) {
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
        flex: 1,
        height: 40,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: disabled ? '#e5eeff' : '#bec8ce',
        paddingHorizontal: 12,
        fontFamily: 'Manrope',
        fontSize: 14,
        color: disabled ? '#bec8ce' : '#0b1c30',
        backgroundColor: disabled ? '#f8f9ff' : 'rgba(255,255,255,0.80)',
        textAlign: 'center',
      }}
    />
  )
}

function DayRow({
  slot,
  onChange,
}: {
  slot: DaySlot
  onChange: (updated: DaySlot) => void
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        paddingHorizontal: 4,
        opacity: slot.is_active ? 1 : 0.5,
      }}
    >
      <Switch
        value={slot.is_active}
        onValueChange={(v) => onChange({ ...slot, is_active: v })}
        trackColor={{ false: '#cbcdcf', true: '#82d8ff' }}
        thumbColor={slot.is_active ? '#006685' : '#f8f9ff'}
        style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
      />
      <Text
        style={{
          width: 32,
          fontFamily: 'Manrope',
          fontSize: 13,
          fontWeight: '700',
          color: '#0b1c30',
        }}
      >
        {DAY_LABELS[slot.day_of_week]}
      </Text>

      {slot.is_active ? (
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TimeInput
            value={slot.start_time}
            onChange={(v) => onChange({ ...slot, start_time: v })}
            disabled={false}
          />
          <Text style={{ fontFamily: 'Manrope', fontSize: 13, color: '#6f787e' }}>—</Text>
          <TimeInput
            value={slot.end_time}
            onChange={(v) => onChange({ ...slot, end_time: v })}
            disabled={false}
          />
        </View>
      ) : (
        <Text
          style={{
            flex: 1,
            fontFamily: 'Manrope',
            fontSize: 13,
            color: '#6f787e',
            fontStyle: 'italic',
          }}
        >
          Indisponible
        </Text>
      )}
    </View>
  )
}

interface ExceptionForm {
  label: string
  start_date: string
  end_date: string
}

export default function AvailabilityScreen() {
  const router = useRouter()
  const { practitioner } = useAuth()
  const pid = practitioner?.id ?? ''

  const { data, isLoading } = useAvailabilitySettings(pid)
  const saveSchedule = useSaveSchedule(pid)
  const addException = useAddException(pid)
  const deleteException = useDeleteException(pid)

  const [localSlots, setLocalSlots] = useState<DaySlot[] | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<ExceptionForm>({ label: '', start_date: '', end_date: '' })
  const [saved, setSaved] = useState(false)

  const slots = localSlots ?? data?.slots ?? []
  const exceptions = data?.exceptions ?? []

  const updateSlot = useCallback(
    (updated: DaySlot) => {
      const base = localSlots ?? data?.slots ?? []
      setLocalSlots(base.map((s) => (s.day_of_week === updated.day_of_week ? updated : s)))
    },
    [localSlots, data?.slots],
  )

  const handleSave = async () => {
    if (!localSlots) return
    try {
      await saveSchedule.mutateAsync(localSlots)
      setLocalSlots(null)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      Alert.alert('Erreur', 'Impossible de sauvegarder.')
    }
  }

  const handleAddException = async () => {
    if (!form.label || !form.start_date || !form.end_date) {
      Alert.alert('Champs manquants', 'Renseignez le libellé et les dates.')
      return
    }
    await addException.mutateAsync(form)
    setForm({ label: '', start_date: '', end_date: '' })
    setShowModal(false)
  }

  const handleDeleteException = (id: string, label: string) => {
    Alert.alert('Supprimer ?', `Retirer "${label}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => deleteException.mutate(id),
      },
    ])
  }

  const isDirty = localSlots !== null
  const isSaving = saveSchedule.isPending

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 24,
          paddingVertical: 12,
          backgroundColor: 'rgba(255,255,255,0.70)',
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.20)',
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Text style={{ fontFamily: 'Manrope', fontSize: 22, color: '#006685' }}>←</Text>
        </TouchableOpacity>
        <Text
          style={{ fontFamily: 'Manrope', fontSize: 17, fontWeight: '700', color: '#0b1c30' }}
        >
          Disponibilités
        </Text>
        {isDirty ? (
          <TouchableOpacity
            onPress={handleSave}
            disabled={isSaving}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: '#006685',
              opacity: isSaving ? 0.6 : 1,
            }}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text
                style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '700', color: '#fff' }}
              >
                Enregistrer
              </Text>
            )}
          </TouchableOpacity>
        ) : (
          <View style={{ width: 80, alignItems: 'flex-end' }}>
            {saved && (
              <Text style={{ fontFamily: 'Manrope', fontSize: 12, color: '#1d7a3a' }}>
                ✓ Sauvegardé
              </Text>
            )}
          </View>
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 24, gap: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Weekly Schedule */}
        <GlassCard>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: '#e5eeff',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 18 }}>🔄</Text>
            </View>
            <View>
              <Text
                style={{
                  fontFamily: 'Manrope',
                  fontSize: 15,
                  fontWeight: '700',
                  color: '#0b1c30',
                }}
              >
                Planning hebdomadaire
              </Text>
              <Text style={{ fontFamily: 'Manrope', fontSize: 12, color: '#6f787e', marginTop: 1 }}>
                Horaires récurrents chaque semaine
              </Text>
            </View>
          </View>

          {isLoading ? (
            <View style={{ gap: 12 }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <View
                  key={i}
                  style={{ height: 44, borderRadius: 10, backgroundColor: '#e5eeff' }}
                />
              ))}
            </View>
          ) : (
            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: 'rgba(190,200,206,0.30)',
                paddingTop: 8,
                gap: 4,
              }}
            >
              {DAY_ORDER.map((d) => {
                const slot = slots.find((s) => s.day_of_week === d)
                if (!slot) return null
                return <DayRow key={d} slot={slot} onChange={updateSlot} />
              })}
            </View>
          )}
        </GlassCard>

        {/* Time Off & Exceptions */}
        <GlassCard>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: '#ffdad6',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 18 }}>🚫</Text>
              </View>
              <View>
                <Text
                  style={{
                    fontFamily: 'Manrope',
                    fontSize: 15,
                    fontWeight: '700',
                    color: '#0b1c30',
                  }}
                >
                  Congés & exceptions
                </Text>
                <Text
                  style={{ fontFamily: 'Manrope', fontSize: 12, color: '#6f787e', marginTop: 1 }}
                >
                  Bloquer des plages indisponibles
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => setShowModal(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: '#e5eeff',
              }}
            >
              <Text style={{ fontFamily: 'Manrope', fontSize: 13, color: '#006685' }}>+</Text>
              <Text
                style={{ fontFamily: 'Manrope', fontSize: 12, fontWeight: '700', color: '#006685' }}
              >
                Ajouter
              </Text>
            </TouchableOpacity>
          </View>

          {exceptions.length === 0 ? (
            <Text
              style={{
                fontFamily: 'Manrope',
                fontSize: 13,
                color: '#6f787e',
                textAlign: 'center',
                paddingVertical: 8,
                fontStyle: 'italic',
              }}
            >
              Aucun congé planifié
            </Text>
          ) : (
            <View style={{ gap: 8 }}>
              {exceptions.map((exc) => (
                <View
                  key={exc.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: 'rgba(190,200,206,0.40)',
                    backgroundColor: 'rgba(255,255,255,0.60)',
                  }}
                >
                  <View>
                    <Text
                      style={{
                        fontFamily: 'Manrope',
                        fontSize: 14,
                        fontWeight: '600',
                        color: '#0b1c30',
                      }}
                    >
                      {exc.label}
                    </Text>
                    <Text
                      style={{ fontFamily: 'Manrope', fontSize: 12, color: '#6f787e', marginTop: 2 }}
                    >
                      {new Date(exc.start_date).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                      })}{' '}
                      →{' '}
                      {new Date(exc.end_date).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDeleteException(exc.id, exc.label)}
                    style={{ padding: 8 }}
                  >
                    <Text style={{ fontSize: 16 }}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </GlassCard>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Add Exception Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: 'flex-end',
            backgroundColor: 'rgba(11,28,48,0.40)',
          }}
        >
          <View
            style={{
              backgroundColor: '#f8f9ff',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              gap: 16,
            }}
          >
            <Text
              style={{
                fontFamily: 'Manrope',
                fontSize: 18,
                fontWeight: '700',
                color: '#0b1c30',
                marginBottom: 4,
              }}
            >
              Ajouter une exception
            </Text>

            {[
              { label: 'Libellé (ex: Congés été)', key: 'label', placeholder: 'Congés été' },
              { label: 'Date de début (AAAA-MM-JJ)', key: 'start_date', placeholder: '2026-08-01' },
              { label: 'Date de fin (AAAA-MM-JJ)', key: 'end_date', placeholder: '2026-08-15' },
            ].map(({ label, key, placeholder }) => (
              <View key={key} style={{ gap: 6 }}>
                <Text
                  style={{ fontFamily: 'Manrope', fontSize: 12, fontWeight: '700', color: '#6f787e' }}
                >
                  {label}
                </Text>
                <TextInput
                  value={form[key as keyof ExceptionForm]}
                  onChangeText={(v) => setForm((f) => ({ ...f, [key]: v }))}
                  placeholder={placeholder}
                  placeholderTextColor="#bec8ce"
                  style={{
                    height: 48,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: '#bec8ce',
                    paddingHorizontal: 16,
                    fontFamily: 'Manrope',
                    fontSize: 14,
                    color: '#0b1c30',
                    backgroundColor: 'rgba(255,255,255,0.80)',
                  }}
                />
              </View>
            ))}

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <TouchableOpacity
                onPress={() => setShowModal(false)}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 999,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: '#bec8ce',
                  backgroundColor: 'rgba(255,255,255,0.60)',
                }}
              >
                <Text
                  style={{ fontFamily: 'Manrope', fontSize: 14, fontWeight: '600', color: '#3f484d' }}
                >
                  Annuler
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAddException}
                disabled={addException.isPending}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 999,
                  alignItems: 'center',
                  backgroundColor: '#006685',
                  opacity: addException.isPending ? 0.6 : 1,
                }}
              >
                <Text
                  style={{ fontFamily: 'Manrope', fontSize: 14, fontWeight: '700', color: '#fff' }}
                >
                  Confirmer
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}
