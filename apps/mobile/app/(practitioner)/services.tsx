import {
  View, Text, TouchableOpacity, ScrollView, Modal,
  StatusBar, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { GlassCard } from '@/components/ui/GlassCard'
import { AppTextInput, PrimaryButton } from '@/components/ui'
import {
  usePractitionerServices,
  type PractitionerService,
  type SessionType,
} from '@/features/practitioner/hooks/usePractitionerServices'

// ── Constants ─────────────────────────────────────────────────────────────────

const SESSION_TYPES: { id: SessionType; label: string; icon: string }[] = [
  { id: 'video',       label: 'Vidéo',       icon: 'videocam' },
  { id: 'audio',       label: 'Audio',       icon: 'headset' },
  { id: 'presentiel',  label: 'Présentiel',  icon: 'person' },
]

const DURATION_OPTIONS = [20, 30, 45, 60, 90, 120]

// ── Form schema ───────────────────────────────────────────────────────────────

const serviceSchema = z.object({
  name:          z.string().min(2, 'Minimum 2 caractères').max(80),
  duration_min:  z.coerce.number().min(15, 'Min 15 min').max(240, 'Max 240 min'),
  price:         z.coerce.number().min(0, 'Prix invalide').optional(),
  session_types: z.array(z.enum(['video', 'audio', 'presentiel'])).min(1, 'Choisir au moins un type'),
})
type ServiceFormData = z.infer<typeof serviceSchema>

// ── Service form modal ────────────────────────────────────────────────────────

function ServiceFormModal({
  visible,
  editing,
  onClose,
}: {
  visible: boolean
  editing: PractitionerService | null
  onClose: () => void
}) {
  const { createService, updateService } = usePractitionerServices()

  const { control, handleSubmit, formState: { errors }, watch, setValue, reset } =
    useForm<ServiceFormData>({
      resolver: zodResolver(serviceSchema),
      defaultValues: editing
        ? {
            name:          editing.name,
            duration_min:  editing.duration_min,
            price:         editing.price ?? undefined,
            session_types: editing.session_types,
          }
        : {
            name:          '',
            duration_min:  60,
            price:         undefined,
            session_types: ['video'],
          },
    })

  const selectedTypes  = watch('session_types') ?? ['video']
  const selectedDur    = watch('duration_min')

  const toggleType = (t: SessionType) => {
    if (selectedTypes.includes(t)) {
      if (selectedTypes.length > 1) setValue('session_types', selectedTypes.filter(s => s !== t) as SessionType[])
    } else {
      setValue('session_types', [...selectedTypes, t] as SessionType[])
    }
  }

  const isLoading = createService.isPending || updateService.isPending

  const onSubmit = async (data: ServiceFormData) => {
    try {
      if (editing) {
        await updateService.mutateAsync({
          id:            editing.id,
          name:          data.name,
          duration_min:  data.duration_min,
          price:         data.price ?? null,
          session_types: data.session_types,
        })
      } else {
        await createService.mutateAsync({
          name:          data.name,
          duration_min:  data.duration_min,
          price:         data.price ?? null,
          session_types: data.session_types,
        })
      }
      reset()
      onClose()
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible de sauvegarder')
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={{
          backgroundColor: '#f8f9ff',
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40,
          maxHeight: '85%',
        }}>
          {/* Handle */}
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#bec8ce', alignSelf: 'center', marginBottom: 20 }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: 18, fontWeight: '700', color: '#0b1c30' }}>
              {editing ? 'Modifier la prestation' : 'Nouvelle prestation'}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={22} color="#6f787e" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={{ gap: 16 }}>

              <Controller control={control} name="name"
                render={({ field: { onChange, value } }) => (
                  <AppTextInput label="Nom de la prestation" value={value} onChangeText={onChange}
                    placeholder="ex. Séance individuelle, Bilan psychologique..."
                    error={errors.name?.message} />
                )} />

              {/* Types */}
              <View style={{ gap: 8 }}>
                <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '500', color: '#3f484d' }}>
                  Types de séance
                </Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {SESSION_TYPES.map(t => {
                    const active = selectedTypes.includes(t.id)
                    return (
                      <TouchableOpacity key={t.id} onPress={() => toggleType(t.id)}
                        style={{
                          flex: 1, paddingVertical: 10, borderRadius: 12,
                          alignItems: 'center', gap: 4,
                          backgroundColor: active ? '#82d8ff' : '#e5eeff',
                          borderWidth: 1.5, borderColor: active ? '#82d8ff' : 'transparent',
                        }}>
                        <MaterialIcons name={t.icon as 'videocam'} size={18} color={active ? '#fff' : '#82d8ff'} />
                        <Text style={{
                          fontFamily: 'Manrope', fontSize: 11, fontWeight: '700',
                          color: active ? '#fff' : '#82d8ff',
                        }}>{t.label}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
                {errors.session_types && (
                  <Text style={{ fontFamily: 'Manrope', fontSize: 12, color: '#ba1a1a' }}>{errors.session_types.message}</Text>
                )}
              </View>

              {/* Durée */}
              <View style={{ gap: 8 }}>
                <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '500', color: '#3f484d' }}>
                  Durée (minutes)
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {DURATION_OPTIONS.map(d => {
                      const active = selectedDur === d
                      return (
                        <TouchableOpacity key={d} onPress={() => setValue('duration_min', d)}
                          style={{
                            width: 58, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
                            backgroundColor: active ? '#82d8ff' : '#e5eeff',
                            borderWidth: 1.5, borderColor: active ? '#82d8ff' : 'transparent',
                          }}>
                          <Text style={{
                            fontFamily: 'Manrope', fontSize: 14, fontWeight: '700',
                            color: active ? '#fff' : '#82d8ff',
                          }}>{d}</Text>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                </ScrollView>
                {errors.duration_min && (
                  <Text style={{ fontFamily: 'Manrope', fontSize: 12, color: '#ba1a1a' }}>{errors.duration_min.message}</Text>
                )}
              </View>

              <Controller control={control} name="price"
                render={({ field: { onChange, value } }) => (
                  <AppTextInput label="Tarif (XOF) — optionnel"
                    value={value !== undefined ? String(value) : ''}
                    onChangeText={onChange}
                    placeholder="ex. 25000"
                    keyboardType="numeric"
                    error={errors.price?.message} />
                )} />

              <View style={{ marginTop: 4, marginBottom: 16 }}>
                <PrimaryButton
                  label={editing ? 'Enregistrer les modifications' : 'Créer la prestation'}
                  onPress={handleSubmit(onSubmit)}
                  loading={isLoading}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ── Service card ──────────────────────────────────────────────────────────────

function ServiceCard({
  service,
  onEdit,
  onDelete,
}: {
  service: PractitionerService
  onEdit: () => void
  onDelete: () => void
}) {
  const typeIcons: Record<SessionType, string> = {
    video:      'videocam',
    audio:      'headset',
    presentiel: 'person',
  }
  const typeLabels: Record<SessionType, string> = {
    video:      'Vidéo',
    audio:      'Audio',
    presentiel: 'Présentiel',
  }

  return (
    <GlassCard>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>

        {/* Icon */}
        <View style={{
          width: 44, height: 44, borderRadius: 12,
          backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <MaterialIcons name="medical-services" size={20} color="#82d8ff" />
        </View>

        {/* Content */}
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: '700', color: '#0b1c30' }}>
            {service.name}
          </Text>

          {/* Types */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {service.session_types.map(t => (
              <View key={t} style={{
                flexDirection: 'row', alignItems: 'center', gap: 4,
                paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
                backgroundColor: '#e5eeff',
              }}>
                <MaterialIcons name={typeIcons[t] as 'videocam'} size={12} color="#82d8ff" />
                <Text style={{ fontFamily: 'Manrope', fontSize: 11, fontWeight: '600', color: '#82d8ff' }}>
                  {typeLabels[t]}
                </Text>
              </View>
            ))}
          </View>

          {/* Price + duration */}
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <MaterialIcons name="schedule" size={14} color="#6f787e" />
              <Text style={{ fontFamily: 'Manrope', fontSize: 13, color: '#3f484d' }}>
                {service.duration_min} min
              </Text>
            </View>
            {service.price != null && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <MaterialIcons name="payments" size={14} color="#6f787e" />
                <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '600', color: '#82d8ff' }}>
                  {Number(service.price).toLocaleString('fr-FR')} XOF
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Actions */}
        <View style={{ gap: 8, flexShrink: 0 }}>
          <TouchableOpacity onPress={onEdit}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}>
            <MaterialIcons name="edit" size={16} color="#82d8ff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#ffdad6', alignItems: 'center', justifyContent: 'center' }}>
            <MaterialIcons name="delete" size={16} color="#ba1a1a" />
          </TouchableOpacity>
        </View>
      </View>
    </GlassCard>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ServicesScreen() {
  const router = useRouter()
  const { services, deleteService } = usePractitionerServices()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<PractitionerService | null>(null)

  const servicesList = services.data ?? []

  const openCreate = () => {
    setEditing(null)
    setShowForm(true)
  }

  const openEdit = (service: PractitionerService) => {
    setEditing(service)
    setShowForm(true)
  }

  const handleDelete = (service: PractitionerService) => {
    Alert.alert(
      'Supprimer la prestation',
      `Supprimer "${service.name}" ? Cette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => deleteService.mutate(service.id),
        },
      ]
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <ServiceFormModal
        visible={showForm}
        editing={editing}
        onClose={() => setShowForm(false)}
      />

      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 24, paddingVertical: 16,
        backgroundColor: 'rgba(255,255,255,0.70)',
        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.30)',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}>
            <MaterialIcons name="arrow-back" size={20} color="#82d8ff" />
          </TouchableOpacity>
          <View>
            <Text style={{ fontFamily: 'Manrope', fontSize: 18, fontWeight: '700', color: '#0b1c30' }}>
              Mes prestations
            </Text>
            <Text style={{ fontFamily: 'Manrope', fontSize: 12, color: '#6f787e' }}>
              {servicesList.length} prestation{servicesList.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        <TouchableOpacity onPress={openCreate}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 6,
            paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
            backgroundColor: '#82d8ff',
          }}>
          <MaterialIcons name="add" size={18} color="#fff" />
          <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '700', color: '#fff' }}>
            Ajouter
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 24, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {services.isLoading ? (
          <View style={{ gap: 12 }}>
            {[1, 2, 3].map(i => (
              <View key={i} style={{ height: 100, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.50)' }} />
            ))}
          </View>
        ) : servicesList.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 60, gap: 16 }}>
            <View style={{
              width: 72, height: 72, borderRadius: 36,
              backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center',
            }}>
              <MaterialIcons name="medical-services" size={32} color="#82d8ff" />
            </View>
            <View style={{ alignItems: 'center', gap: 6 }}>
              <Text style={{ fontFamily: 'Manrope', fontSize: 17, fontWeight: '700', color: '#0b1c30' }}>
                Aucune prestation
              </Text>
              <Text style={{ fontFamily: 'Manrope', fontSize: 14, color: '#6f787e', textAlign: 'center', lineHeight: 20 }}>
                Créez vos premières prestations pour que les patients puissent réserver facilement.
              </Text>
            </View>
            <TouchableOpacity onPress={openCreate}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 8,
                paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999,
                backgroundColor: '#82d8ff', marginTop: 8,
              }}>
              <MaterialIcons name="add" size={18} color="#fff" />
              <Text style={{ fontFamily: 'Manrope', fontSize: 14, fontWeight: '700', color: '#fff' }}>
                Créer une prestation
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          servicesList.map(service => (
            <ServiceCard
              key={service.id}
              service={service}
              onEdit={() => openEdit(service)}
              onDelete={() => handleDelete(service)}
            />
          ))
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  )
}
