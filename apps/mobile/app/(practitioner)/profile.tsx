import {
  View, Text, TouchableOpacity, StatusBar, Alert, ScrollView,
  Image, ActivityIndicator, Modal, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useAuthStore } from '@/features/auth/store/authStore'
import { GlassCard } from '@/components/ui/GlassCard'
import { AppTextInput, PrimaryButton } from '@/components/ui'
import { usePractitionerAssetUpload } from '@/features/practitioner/hooks/usePractitionerProfile'
import { supabase } from '@/services/supabase'

// ── Types ────────────────────────────────────────────────────────────────────

const editProfileSchema = z.object({
  full_name:            z.string().min(2, 'Minimum 2 caractères'),
  phone:                z.string().optional(),
  speciality:           z.string().min(2, 'Minimum 2 caractères'),
  bio:                  z.string().max(500, 'Maximum 500 caractères').optional(),
  session_price:        z.coerce.number().min(0, 'Prix invalide').optional(),
  session_duration_min: z.coerce.number().min(15).max(240),
  languages:            z.array(z.string()).min(1, 'Au moins une langue'),
})
type EditProfileFormData = z.infer<typeof editProfileSchema>

const LANG_OPTIONS = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
  { code: 'wo', label: 'Wolof' },
]
const DURATION_OPTIONS = [30, 45, 60, 90]

// ── Asset tile ────────────────────────────────────────────────────────────────

function AssetTile({
  label, icon, url, loading, onUpload, onRemove, contain,
}: {
  label: string
  icon: string
  url: string | null
  loading: boolean
  onUpload: () => void
  onRemove: () => void
  contain?: boolean
}) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 8 }}>
      <TouchableOpacity
        onPress={onUpload}
        onLongPress={url ? onRemove : undefined}
        activeOpacity={0.75}
        style={{
          width: '100%', aspectRatio: 1, borderRadius: 16,
          borderWidth: 1.5, borderStyle: url ? 'solid' : 'dashed',
          borderColor: url ? '#82d8ff' : '#bec8ce',
          backgroundColor: url ? '#f0f9ff' : 'rgba(255,255,255,0.6)',
          alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        }}
      >
        {loading ? (
          <ActivityIndicator color="#82d8ff" />
        ) : url ? (
          <>
            <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} resizeMode={contain ? 'contain' : 'cover'} />
            <View style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              backgroundColor: 'rgba(0,102,133,0.65)', paddingVertical: 4, alignItems: 'center',
            }}>
              <MaterialIcons name="edit" size={14} color="#fff" />
            </View>
          </>
        ) : (
          <View style={{ alignItems: 'center', gap: 4 }}>
            <MaterialIcons name={icon as 'photo-camera'} size={26} color="#bec8ce" />
            <Text style={{ fontFamily: 'Manrope', fontSize: 10, color: '#6f787e', textAlign: 'center' }}>Importer</Text>
          </View>
        )}
      </TouchableOpacity>
      <Text style={{ fontFamily: 'Manrope', fontSize: 11, fontWeight: '600', color: '#3f484d', textAlign: 'center' }}>{label}</Text>
    </View>
  )
}

// ── Edit Profile Modal ────────────────────────────────────────────────────────

function EditProfileModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { profile, practitioner } = useAuth()
  const setProfile = useAuthStore((s) => s.setProfile)
  const setPractitioner = useAuthStore((s) => s.setPractitioner)
  const qc = useQueryClient()

  const { control, handleSubmit, formState: { errors }, watch, setValue } = useForm<EditProfileFormData>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: {
      full_name:            profile?.full_name ?? '',
      phone:                profile?.phone ?? '',
      speciality:           practitioner?.speciality ?? '',
      bio:                  practitioner?.bio ?? '',
      session_price:        practitioner?.session_price ?? undefined,
      session_duration_min: practitioner?.session_duration_min ?? 60,
      languages:            practitioner?.languages ?? ['fr'],
    },
  })

  const selectedLangs = watch('languages') ?? ['fr']
  const selectedDuration = watch('session_duration_min')

  const save = useMutation({
    mutationFn: async (data: EditProfileFormData) => {
      if (!profile?.id || !practitioner?.id) throw new Error('Non authentifié')
      const [{ error: e1 }, { error: e2 }] = await Promise.all([
        supabase.from('users').update({ full_name: data.full_name, phone: data.phone ?? null }).eq('id', profile.id),
        supabase.from('practitioners').update({
          speciality:           data.speciality,
          bio:                  data.bio ?? null,
          session_price:        data.session_price ?? null,
          session_duration_min: data.session_duration_min,
          languages:            data.languages,
        }).eq('id', practitioner.id),
      ])
      if (e1) throw e1
      if (e2) throw e2
      return data
    },
    onSuccess: (data) => {
      if (profile) setProfile({ ...profile, full_name: data.full_name, phone: data.phone ?? null })
      if (practitioner) setPractitioner({
        ...practitioner,
        speciality:           data.speciality,
        bio:                  data.bio ?? null,
        session_price:        data.session_price ?? null,
        session_duration_min: data.session_duration_min,
        languages:            data.languages,
      })
      qc.invalidateQueries({ queryKey: ['practitioner-profile'] })
      onClose()
    },
    onError: (e) => Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible de sauvegarder'),
  })

  const toggleLang = (code: string) => {
    const current = selectedLangs
    if (current.includes(code)) {
      if (current.length > 1) setValue('languages', current.filter(l => l !== code))
    } else {
      setValue('languages', [...current, code])
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={{
          backgroundColor: '#f8f9ff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
          paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40, maxHeight: '90%',
        }}>
          {/* Handle */}
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#bec8ce', alignSelf: 'center', marginBottom: 20 }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: 18, fontWeight: '700', color: '#0b1c30' }}>
              Modifier mon profil
            </Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={22} color="#6f787e" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={{ gap: 16 }}>

              {/* Section perso */}
              <Text style={{ fontFamily: 'Manrope', fontSize: 11, fontWeight: '700', color: '#82d8ff', textTransform: 'uppercase', letterSpacing: 1 }}>
                Informations personnelles
              </Text>

              <Controller control={control} name="full_name"
                render={({ field: { onChange, value } }) => (
                  <AppTextInput label="Nom complet" value={value} onChangeText={onChange}
                    placeholder="Prénom Nom" error={errors.full_name?.message} />
                )} />

              <Controller control={control} name="phone"
                render={({ field: { onChange, value } }) => (
                  <AppTextInput label="Téléphone" value={value ?? ''} onChangeText={onChange}
                    placeholder="+221 77 000 00 00" keyboardType="phone-pad" />
                )} />

              {/* Section pro */}
              <Text style={{ fontFamily: 'Manrope', fontSize: 11, fontWeight: '700', color: '#82d8ff', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>
                Informations professionnelles
              </Text>

              <Controller control={control} name="speciality"
                render={({ field: { onChange, value } }) => (
                  <AppTextInput label="Spécialité" value={value} onChangeText={onChange}
                    placeholder="ex. Psychologue clinicien" error={errors.speciality?.message} />
                )} />

              <Controller control={control} name="bio"
                render={({ field: { onChange, value } }) => (
                  <AppTextInput label="Bio (optionnel)" value={value ?? ''} onChangeText={onChange}
                    placeholder="Décrivez votre approche thérapeutique..."
                    multiline numberOfLines={3}
                    style={{ minHeight: 80, textAlignVertical: 'top', paddingTop: 12 }}
                    error={errors.bio?.message} />
                )} />

              {/* Tarif */}
              <Controller control={control} name="session_price"
                render={({ field: { onChange, value } }) => (
                  <AppTextInput label="Tarif par séance (XOF)" value={value ? String(value) : ''} onChangeText={onChange}
                    placeholder="ex. 25000" keyboardType="numeric"
                    error={errors.session_price?.message} />
                )} />

              {/* Durée */}
              <View style={{ gap: 8 }}>
                <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '500', color: '#3f484d' }}>
                  Durée par séance (min)
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {DURATION_OPTIONS.map(d => (
                    <TouchableOpacity key={d} onPress={() => setValue('session_duration_min', d)}
                      style={{
                        flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
                        backgroundColor: selectedDuration === d ? '#82d8ff' : '#e5eeff',
                        borderWidth: 1.5,
                        borderColor: selectedDuration === d ? '#82d8ff' : 'transparent',
                      }}>
                      <Text style={{
                        fontFamily: 'Manrope', fontSize: 13, fontWeight: '700',
                        color: selectedDuration === d ? '#fff' : '#82d8ff',
                      }}>{d}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Langues */}
              <View style={{ gap: 8 }}>
                <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '500', color: '#3f484d' }}>
                  Langues parlées
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {LANG_OPTIONS.map(l => {
                    const active = selectedLangs.includes(l.code)
                    return (
                      <TouchableOpacity key={l.code} onPress={() => toggleLang(l.code)}
                        style={{
                          paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
                          backgroundColor: active ? '#82d8ff' : '#e5eeff',
                          borderWidth: 1.5, borderColor: active ? '#82d8ff' : 'transparent',
                        }}>
                        <Text style={{
                          fontFamily: 'Manrope', fontSize: 13, fontWeight: '600',
                          color: active ? '#fff' : '#82d8ff',
                        }}>{l.label}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
                {errors.languages && (
                  <Text style={{ fontFamily: 'Manrope', fontSize: 12, color: '#ba1a1a' }}>{errors.languages.message}</Text>
                )}
              </View>

              <View style={{ marginTop: 8, marginBottom: 16 }}>
                <PrimaryButton
                  label="Enregistrer"
                  onPress={handleSubmit((d) => save.mutate(d))}
                  loading={save.isPending}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const router = useRouter()
  const { profile, practitioner } = useAuth()
  const signOut = useAuthStore((s) => s.signOut)
  const { upload, remove, uploading } = usePractitionerAssetUpload()
  const [showEdit, setShowEdit] = useState(false)

  const initials = (profile?.full_name ?? 'P')
    .split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()

  // Tolerate a stale split between the two fields: a practitioner marked
  // is_verified should read as validated even if verification_status lags behind.
  const isApproved = practitioner?.verification_status === 'approved' || practitioner?.is_verified === true

  const handleSignOut = () => {
    Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnecter', style: 'destructive', onPress: () => signOut() },
    ])
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <EditProfileModal visible={showEdit} onClose={() => setShowEdit(false)} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 24, gap: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontFamily: 'Manrope', fontSize: 22, fontWeight: '700', color: '#0b1c30' }}>
            Profil
          </Text>
          <TouchableOpacity
            onPress={() => setShowEdit(true)}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
              backgroundColor: '#e5eeff',
            }}
          >
            <MaterialIcons name="edit" size={16} color="#82d8ff" />
            <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '700', color: '#82d8ff' }}>
              Éditer
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Avatar + identité ── */}
        <View style={{ alignItems: 'center', gap: 12 }}>
          <TouchableOpacity
            onPress={() => void upload('avatar')}
            onLongPress={profile?.avatar_url ? () => remove('avatar') : undefined}
            activeOpacity={0.82}
            style={{ position: 'relative' }}
          >
            <View style={{
              width: 100, height: 100, borderRadius: 50,
              backgroundColor: '#82d8ff', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', borderWidth: 3, borderColor: '#bee9ff',
            }}>
              {uploading === 'avatar' ? (
                <ActivityIndicator color="#005e7a" size="large" />
              ) : profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              ) : (
                <Text style={{ fontFamily: 'Manrope', fontWeight: '800', fontSize: 32, color: '#005e7a' }}>{initials}</Text>
              )}
            </View>
            <View style={{
              position: 'absolute', bottom: 2, right: 2,
              width: 28, height: 28, borderRadius: 14,
              backgroundColor: '#82d8ff', borderWidth: 2, borderColor: '#fff',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <MaterialIcons name="photo-camera" size={13} color="#0b1c30" />
            </View>
          </TouchableOpacity>

          <View style={{ alignItems: 'center', gap: 2 }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: 20, fontWeight: '700', color: '#0b1c30' }}>
              {profile?.full_name ?? '—'}
            </Text>
            <Text style={{ fontFamily: 'Manrope', fontSize: 14, color: '#6f787e' }}>
              {practitioner?.speciality ?? '—'}
            </Text>
            {practitioner?.bio ? (
              <Text style={{ fontFamily: 'Manrope', fontSize: 13, color: '#3f484d', textAlign: 'center', marginTop: 4, lineHeight: 20, paddingHorizontal: 16 }} numberOfLines={3}>
                {practitioner.bio}
              </Text>
            ) : null}
          </View>

          <View style={{
            paddingHorizontal: 16, paddingVertical: 6, borderRadius: 999,
            backgroundColor: isApproved ? '#d1fae5' : '#fef3c7',
          }}>
            <Text style={{
              fontFamily: 'Manrope', fontSize: 12, fontWeight: '700',
              color: isApproved ? '#1d7a3a' : '#92400e',
            }}>
              {isApproved ? '✓ Profil validé' : 'Validation en cours'}
            </Text>
          </View>
        </View>

        {/* ── Identité visuelle ── */}
        <GlassCard>
          <View style={{ gap: 14 }}>
            <View style={{ gap: 2 }}>
              <Text style={{ fontFamily: 'Manrope', fontSize: 12, fontWeight: '700', color: '#82d8ff', textTransform: 'uppercase', letterSpacing: 1.2 }}>
                Identité professionnelle
              </Text>
              <Text style={{ fontFamily: 'Manrope', fontSize: 12, color: '#6f787e' }}>
                Apparaît sur vos ordonnances et comptes-rendus
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <AssetTile label="Photo" icon="photo-camera"
                url={profile?.avatar_url ?? null} loading={uploading === 'avatar'}
                onUpload={() => void upload('avatar')} onRemove={() => remove('avatar')} />
              <AssetTile label="Cachet" icon="verified"
                url={practitioner?.stamp_url ?? null} loading={uploading === 'stamp'}
                onUpload={() => void upload('stamp')} onRemove={() => remove('stamp')} contain />
              <AssetTile label="Signature" icon="draw"
                url={practitioner?.signature_url ?? null} loading={uploading === 'signature'}
                onUpload={() => void upload('signature')} onRemove={() => remove('signature')} contain />
            </View>
            <Text style={{ fontFamily: 'Manrope', fontSize: 10, color: '#6f787e', lineHeight: 15 }}>
              Appuyez pour importer · Maintenez pour supprimer · PNG recommandé
            </Text>
          </View>
        </GlassCard>

        {/* ── Stats ── */}
        <GlassCard>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            {[
              { label: 'Note',   value: practitioner?.rating ? `${Number(practitioner.rating).toFixed(1)}/5` : '—' },
              { label: 'Avis',   value: String(practitioner?.total_reviews ?? 0) },
              { label: 'Tarif',  value: practitioner?.session_price ? `${Number(practitioner.session_price).toLocaleString('fr-FR')} XOF` : '—' },
              { label: 'Durée',  value: `${practitioner?.session_duration_min ?? 60} min` },
            ].map(({ label, value }) => (
              <View key={label} style={{ alignItems: 'center' }}>
                <Text style={{ fontFamily: 'Manrope', fontSize: 16, fontWeight: '700', color: '#0b1c30' }}>{value}</Text>
                <Text style={{ fontFamily: 'Manrope', fontSize: 11, color: '#6f787e', marginTop: 2 }}>{label}</Text>
              </View>
            ))}
          </View>
        </GlassCard>

        {/* ── Langues ── */}
        {(practitioner?.languages ?? []).length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(practitioner?.languages ?? []).map(l => {
              const opt = LANG_OPTIONS.find(o => o.code === l)
              return (
                <View key={l} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#e5eeff' }}>
                  <Text style={{ fontFamily: 'Manrope', fontSize: 12, fontWeight: '600', color: '#82d8ff' }}>
                    {opt?.label ?? l}
                  </Text>
                </View>
              )
            })}
          </View>
        )}

        {/* ── Gestion du cabinet — cartes groupées à la manière du profil patient ── */}
        <View style={{ borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.70)', padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.80)' }}>
          <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '700', color: '#0b1c30', marginBottom: 4 }}>
            Gestion du cabinet
          </Text>
          {[
            { icon: 'event-available' as const, label: 'Disponibilités & Prestations', href: '/(practitioner)/availability' as const },
            { icon: 'description' as const, label: 'Mes documents', href: '/(practitioner)/documents' as const },
            { icon: 'support-agent' as const, label: 'Mes secrétaires', href: '/(practitioner)/secretary' as const },
            { icon: 'gavel' as const, label: 'Litiges', href: '/(practitioner)/disputes' as const },
          ].map((item, i) => (
            <TouchableOpacity
              key={item.href}
              onPress={() => router.push(item.href as never)}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: 'rgba(190,200,206,0.25)' }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <MaterialIcons name={item.icon} size={18} color="#82d8ff" />
              </View>
              <Text style={{ flex: 1, fontFamily: 'Manrope', fontSize: 14, color: '#0b1c30', fontWeight: '500' }}>{item.label}</Text>
              <MaterialIcons name="chevron-right" size={20} color="#bec8ce" />
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Sign out ── */}
        <TouchableOpacity
          onPress={handleSignOut}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            gap: 8, paddingVertical: 14, borderRadius: 100,
            backgroundColor: 'rgba(186,26,26,0.06)', borderWidth: 1, borderColor: 'rgba(186,26,26,0.15)',
          }}
        >
          <MaterialIcons name="logout" size={18} color="#ba1a1a" />
          <Text style={{ fontFamily: 'Manrope', fontWeight: '700', fontSize: 14, color: '#ba1a1a' }}>Déconnexion</Text>
        </TouchableOpacity>

        <View style={{ height: 16 }} />
      </ScrollView>
    </SafeAreaView>
  )
}
