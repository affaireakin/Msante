import { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, Alert,
  ActivityIndicator, Switch, TextInput, Image, Modal, FlatList,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import * as ImagePicker from 'expo-image-picker'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useAuthStore } from '@/features/auth/store/authStore'
import { DeleteAccountSection } from '@/components/ui'
import { supabase } from '@/services/supabase'
import { uploadLocalFile, mimeFromUri } from '@/services/uploadFile'

type IconName = React.ComponentProps<typeof MaterialIcons>['name']

const COUNTRY_PREFIXES = [
  { code: '+221', flag: '🇸🇳', label: 'Sénégal' },
  { code: '+33', flag: '🇫🇷', label: 'France' },
  { code: '+225', flag: '🇨🇮', label: "Côte d'Ivoire" },
  { code: '+237', flag: '🇨🇲', label: 'Cameroun' },
  { code: '+212', flag: '🇲🇦', label: 'Maroc' },
  { code: '+1', flag: '🇺🇸', label: 'USA / Canada' },
  { code: '+44', flag: '🇬🇧', label: 'Royaume-Uni' },
  { code: '+32', flag: '🇧🇪', label: 'Belgique' },
]

const PRIORITY_SUGGESTIONS = [
  'Réduire mon anxiété',
  'Améliorer mon sommeil',
  'Gérer mon stress au travail',
  'Renforcer mon estime de soi',
  'Surmonter un deuil',
  'Améliorer mes relations',
  'Traiter une dépression',
  'Développer ma pleine conscience',
]

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
}

function memberSince(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

function InfoRow({ icon, label, value, onEdit }: { icon: IconName; label: string; value: string; onEdit?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(190,200,206,0.25)' }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
        <MaterialIcons name={icon} size={18} color="#82d8ff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: 'Manrope', fontSize: 11, color: '#6f787e', fontWeight: '600', marginBottom: 1 }}>{label}</Text>
        <Text style={{ fontFamily: 'Manrope', fontSize: 14, color: '#0b1c30', fontWeight: '500' }}>{value || '—'}</Text>
      </View>
      {onEdit && (
        <TouchableOpacity onPress={onEdit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialIcons name="edit" size={18} color="#82d8ff" />
        </TouchableOpacity>
      )}
    </View>
  )
}

function SwitchRow({ icon, label, value, onChange }: { icon: IconName; label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(190,200,206,0.25)' }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
        <MaterialIcons name={icon} size={18} color="#82d8ff" />
      </View>
      <Text style={{ flex: 1, fontFamily: 'Manrope', fontSize: 14, color: '#0b1c30', fontWeight: '500' }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: '#e2e8f0', true: '#82d8ff' }} thumbColor={value ? '#82d8ff' : '#fff'} />
    </View>
  )
}

export default function ProfileScreen() {
  const router = useRouter()
  const { profile } = useAuth()
  const signOut = useAuthStore((s) => s.signOut)
  const setProfile = useAuthStore((s) => s.setProfile)
  const queryClient = useQueryClient()

  const [editField, setEditField] = useState<'full_name' | 'phone' | 'conditions' | 'priorities' | null>(null)
  const [editValue, setEditValue] = useState('')
  const [phonePrefix, setPhonePrefix] = useState('+221')
  const [showPrefixPicker, setShowPrefixPicker] = useState(false)
  const [authEmail, setAuthEmail] = useState('')

  const [notifReminders, setNotifReminders] = useState(true)
  const [notifMood, setNotifMood] = useState(true)
  const [notifTips, setNotifTips] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setAuthEmail(data.user.email)
    })
    if (profile?.phone) {
      const prefix = COUNTRY_PREFIXES.find(p => profile.phone?.startsWith(p.code))
      if (prefix) setPhonePrefix(prefix.code)
    }
  }, [profile])

  // Medical profile query
  const { data: medicalProfile } = useQuery({
    queryKey: ['medical-profile', profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('patient_medical_profiles')
        .select('chronic_conditions, priorities')
        .eq('patient_id', profile!.id)
        .maybeSingle()
      return data
    },
  })

  const updateProfile = useMutation({
    mutationFn: async (updates: Partial<{ full_name: string; phone: string }>) => {
      if (!profile) throw new Error('Non connecté')
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', profile.id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      setProfile({ ...profile!, ...data })
      setEditField(null)
      queryClient.invalidateQueries({ queryKey: ['auth-profile'] })
    },
    onError: (err) => Alert.alert('Erreur', err instanceof Error ? err.message : 'Impossible de sauvegarder'),
  })

  const updateMedical = useMutation({
    mutationFn: async (updates: Partial<{ chronic_conditions: string[]; priorities: string[] }>) => {
      if (!profile) throw new Error('Non connecté')
      const { error } = await supabase
        .from('patient_medical_profiles')
        .upsert({ patient_id: profile.id, ...updates, updated_at: new Date().toISOString() })
      if (error) throw error
    },
    onSuccess: () => {
      setEditField(null)
      queryClient.invalidateQueries({ queryKey: ['medical-profile', profile?.id] })
    },
    onError: (err) => Alert.alert('Erreur', err instanceof Error ? err.message : 'Impossible de sauvegarder'),
  })

  const uploadAvatar = async () => {
    // Sélecteur système (Photo Picker) — aucune permission de galerie requise.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })
    if (result.canceled || !result.assets[0]) return
    const asset = result.assets[0]
    const fileExt = asset.uri.split('.').pop() ?? 'jpg'
    const filePath = `${profile!.id}/avatar.${fileExt}`

    try {
      await uploadLocalFile('avatars', filePath, asset.uri, mimeFromUri(asset.uri, 'image/jpeg'))
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : "Impossible d'envoyer la photo.")
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath)
    updateProfile.mutate({ full_name: profile!.full_name } as never)
    await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', profile!.id)
    setProfile({ ...profile!, avatar_url: publicUrl })
  }

  const handleSavePhone = () => {
    const raw = editValue.replace(/[^0-9]/g, '')
    const full = `${phonePrefix}${raw}`
    updateProfile.mutate({ phone: full })
  }

  const handleSaveConditions = () => {
    const items = editValue.split(',').map(s => s.trim()).filter(Boolean)
    updateMedical.mutate({ chronic_conditions: items })
  }

  const handleSavePriorities = () => {
    const items = editValue.split(',').map(s => s.trim()).filter(Boolean)
    updateMedical.mutate({ priorities: items })
  }

  const handleSignOut = () => {
    Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnecter', style: 'destructive', onPress: () => signOut() },
    ])
  }

  if (!profile) return null
  const name = profile.full_name ?? 'Patient'
  const ini = initials(name)
  const avatarUrl = (profile as unknown as { avatar_url?: string }).avatar_url
  const displayPhone = profile.phone
    ? profile.phone.replace(phonePrefix, `${phonePrefix} `)
    : ''

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      {/* Prefix picker modal */}
      <Modal visible={showPrefixPicker} transparent animationType="slide" onRequestClose={() => setShowPrefixPicker(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 }}>
            <Text style={{ fontFamily: 'Manrope', fontWeight: '700', fontSize: 16, color: '#0b1c30', marginBottom: 16 }}>
              Indicatif pays
            </Text>
            {COUNTRY_PREFIXES.map(p => (
              <TouchableOpacity
                key={p.code}
                onPress={() => { setPhonePrefix(p.code); setShowPrefixPicker(false) }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f4f8' }}
              >
                <Text style={{ fontSize: 22 }}>{p.flag}</Text>
                <Text style={{ fontFamily: 'Manrope', fontSize: 14, color: '#0b1c30', flex: 1 }}>{p.label}</Text>
                <Text style={{ fontFamily: 'Manrope', fontSize: 14, color: '#82d8ff', fontWeight: '700' }}>{p.code}</Text>
                {phonePrefix === p.code && <MaterialIcons name="check" size={18} color="#82d8ff" />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
            <MaterialIcons name="arrow-back" size={22} color="#82d8ff" />
          </TouchableOpacity>
          <Text style={{ fontFamily: 'Manrope', fontSize: 20, fontWeight: '700', color: '#0b1c30' }}>Mon profil</Text>
        </View>

        {/* Avatar + identity */}
        <View style={{ alignItems: 'center', paddingVertical: 28, paddingHorizontal: 24 }}>
          <TouchableOpacity onPress={uploadAvatar} style={{ marginBottom: 14 }} activeOpacity={0.8}>
            <View style={{
              width: 88, height: 88, borderRadius: 44,
              backgroundColor: '#82d8ff', alignItems: 'center', justifyContent: 'center',
              shadowColor: '#82d8ff', shadowOpacity: 0.25, shadowOffset: { width: 0, height: 8 }, shadowRadius: 20,
            }}>
              {avatarUrl
                ? <Image source={{ uri: avatarUrl }} style={{ width: 88, height: 88, borderRadius: 44 }} />
                : <Text style={{ fontFamily: 'Manrope', fontWeight: '800', fontSize: 30, color: '#fff' }}>{ini}</Text>
              }
            </View>
            <View style={{
              position: 'absolute', bottom: 0, right: 0,
              width: 28, height: 28, borderRadius: 14,
              backgroundColor: '#82d8ff', borderWidth: 2, borderColor: '#f8f9ff',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <MaterialIcons name="photo-camera" size={13} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={{ fontFamily: 'Manrope', fontSize: 20, fontWeight: '700', color: '#0b1c30', textAlign: 'center' }}>{name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
            <View style={{ backgroundColor: '#e5eeff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <MaterialIcons name="person" size={12} color="#82d8ff" />
              <Text style={{ fontFamily: 'Manrope', fontSize: 11, fontWeight: '700', color: '#82d8ff' }}>Patient</Text>
            </View>
            {profile.created_at && (
              <Text style={{ fontFamily: 'Manrope', fontSize: 11, color: '#6f787e' }}>
                Membre depuis {memberSince(profile.created_at)}
              </Text>
            )}
          </View>
        </View>

        {/* Info card */}
        <View style={{ marginHorizontal: 20, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.70)', padding: 20, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.80)' }}>
          <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '700', color: '#0b1c30', marginBottom: 4 }}>
            Informations personnelles
          </Text>

          <InfoRow
            icon="person"
            label="Nom complet"
            value={profile.full_name}
            onEdit={() => { setEditField('full_name'); setEditValue(profile.full_name ?? '') }}
          />
          {editField === 'full_name' && (
            <View style={{ backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 16, padding: 16, marginTop: 8, borderWidth: 1, borderColor: 'rgba(0,102,133,0.15)' }}>
              <TextInput
                value={editValue}
                onChangeText={setEditValue}
                autoFocus
                style={{ fontFamily: 'Manrope', fontSize: 15, color: '#0b1c30', borderBottomWidth: 1.5, borderBottomColor: '#82d8ff', paddingVertical: 6, marginBottom: 16 }}
                placeholderTextColor="#bec8ce"
              />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity onPress={() => setEditField(null)} style={{ flex: 1, paddingVertical: 10, borderRadius: 100, borderWidth: 1, borderColor: '#bec8ce', alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'Manrope', fontWeight: '600', color: '#6f787e', fontSize: 13 }}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => updateProfile.mutate({ full_name: editValue.trim() })} disabled={updateProfile.isPending} style={{ flex: 1, paddingVertical: 10, borderRadius: 100, backgroundColor: '#82d8ff', alignItems: 'center' }}>
                  {updateProfile.isPending ? <ActivityIndicator size="small" color="#0b1c30" /> : <Text style={{ fontFamily: 'Manrope', fontWeight: '800', color: '#0b1c30', fontSize: 13 }}>Enregistrer</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Email (read-only from auth) */}
          <InfoRow icon="email" label="Adresse email" value={authEmail} />

          {/* Phone with prefix */}
          <InfoRow
            icon="phone"
            label="Téléphone"
            value={displayPhone || (profile.phone ?? '')}
            onEdit={() => {
              const raw = profile.phone?.replace(phonePrefix, '') ?? ''
              setEditField('phone')
              setEditValue(raw)
            }}
          />
          {editField === 'phone' && (
            <View style={{ backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 16, padding: 16, marginTop: 8, borderWidth: 1, borderColor: 'rgba(0,102,133,0.15)' }}>
              <Text style={{ fontFamily: 'Manrope', fontSize: 12, fontWeight: '700', color: '#82d8ff', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Téléphone
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                <TouchableOpacity
                  onPress={() => setShowPrefixPicker(true)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#e5eeff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12 }}
                >
                  <Text style={{ fontSize: 16 }}>
                    {COUNTRY_PREFIXES.find(p => p.code === phonePrefix)?.flag}
                  </Text>
                  <Text style={{ fontFamily: 'Manrope', fontWeight: '700', color: '#82d8ff', fontSize: 13 }}>{phonePrefix}</Text>
                  <MaterialIcons name="arrow-drop-down" size={18} color="#82d8ff" />
                </TouchableOpacity>
                <TextInput
                  value={editValue}
                  onChangeText={setEditValue}
                  keyboardType="phone-pad"
                  autoFocus
                  placeholder="77 000 00 00"
                  style={{ flex: 1, fontFamily: 'Manrope', fontSize: 15, color: '#0b1c30', borderBottomWidth: 1.5, borderBottomColor: '#82d8ff', paddingVertical: 6 }}
                  placeholderTextColor="#bec8ce"
                />
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity onPress={() => setEditField(null)} style={{ flex: 1, paddingVertical: 10, borderRadius: 100, borderWidth: 1, borderColor: '#bec8ce', alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'Manrope', fontWeight: '600', color: '#6f787e', fontSize: 13 }}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSavePhone} disabled={updateProfile.isPending} style={{ flex: 1, paddingVertical: 10, borderRadius: 100, backgroundColor: '#82d8ff', alignItems: 'center' }}>
                  {updateProfile.isPending ? <ActivityIndicator size="small" color="#0b1c30" /> : <Text style={{ fontFamily: 'Manrope', fontWeight: '800', color: '#0b1c30', fontSize: 13 }}>Enregistrer</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}

          <InfoRow icon="language" label="Pays" value={profile.country ?? 'SN'} />
        </View>

        {/* Health card */}
        <View style={{ marginHorizontal: 20, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.70)', padding: 20, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.80)' }}>
          <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '700', color: '#0b1c30', marginBottom: 4 }}>
            Santé & bien-être
          </Text>

          {/* Maladies connues */}
          <InfoRow
            icon="local-hospital"
            label="Maladies connues"
            value={(medicalProfile?.chronic_conditions as string[] | undefined)?.join(', ') ?? ''}
            onEdit={() => {
              setEditField('conditions')
              setEditValue((medicalProfile?.chronic_conditions as string[] | undefined)?.join(', ') ?? '')
            }}
          />
          {editField === 'conditions' && (
            <View style={{ backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 16, padding: 16, marginTop: 8, borderWidth: 1, borderColor: 'rgba(0,102,133,0.15)' }}>
              <Text style={{ fontFamily: 'Manrope', fontSize: 11, color: '#6f787e', marginBottom: 6 }}>
                Séparez les éléments par des virgules
              </Text>
              <TextInput
                value={editValue}
                onChangeText={setEditValue}
                autoFocus
                multiline
                placeholder="Diabète, hypertension..."
                style={{ fontFamily: 'Manrope', fontSize: 14, color: '#0b1c30', borderBottomWidth: 1.5, borderBottomColor: '#82d8ff', paddingVertical: 6, marginBottom: 16, minHeight: 50 }}
                placeholderTextColor="#bec8ce"
              />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity onPress={() => setEditField(null)} style={{ flex: 1, paddingVertical: 10, borderRadius: 100, borderWidth: 1, borderColor: '#bec8ce', alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'Manrope', fontWeight: '600', color: '#6f787e', fontSize: 13 }}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveConditions} disabled={updateMedical.isPending} style={{ flex: 1, paddingVertical: 10, borderRadius: 100, backgroundColor: '#82d8ff', alignItems: 'center' }}>
                  {updateMedical.isPending ? <ActivityIndicator size="small" color="#0b1c30" /> : <Text style={{ fontFamily: 'Manrope', fontWeight: '800', color: '#0b1c30', fontSize: 13 }}>Enregistrer</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Mes priorités en ce moment */}
          <InfoRow
            icon="flag"
            label="Mes priorités en ce moment"
            value={(medicalProfile?.priorities as string[] | undefined)?.join(', ') ?? ''}
            onEdit={() => {
              setEditField('priorities')
              setEditValue((medicalProfile?.priorities as string[] | undefined)?.join(', ') ?? '')
            }}
          />
          {editField === 'priorities' && (
            <View style={{ backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 16, padding: 16, marginTop: 8, borderWidth: 1, borderColor: 'rgba(0,102,133,0.15)' }}>
              <Text style={{ fontFamily: 'Manrope', fontSize: 11, color: '#6f787e', marginBottom: 8 }}>
                Choisissez parmi les suggestions ou saisissez vos propres priorités
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {PRIORITY_SUGGESTIONS.map(s => {
                  const selected = editValue.split(',').map(v => v.trim()).includes(s)
                  return (
                    <TouchableOpacity
                      key={s}
                      onPress={() => {
                        const current = editValue.split(',').map(v => v.trim()).filter(Boolean)
                        if (selected) {
                          setEditValue(current.filter(v => v !== s).join(', '))
                        } else {
                          setEditValue([...current, s].join(', '))
                        }
                      }}
                      style={{
                        paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
                        backgroundColor: selected ? '#82d8ff' : '#e5eeff',
                        borderWidth: 1, borderColor: selected ? '#82d8ff' : '#82d8ff',
                      }}
                    >
                      <Text style={{ fontFamily: 'Manrope', fontSize: 11, fontWeight: '600', color: selected ? '#fff' : '#82d8ff' }}>
                        {s}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
              <TextInput
                value={editValue}
                onChangeText={setEditValue}
                multiline
                placeholder="Ou saisissez vos priorités, séparées par des virgules"
                style={{ fontFamily: 'Manrope', fontSize: 13, color: '#0b1c30', borderWidth: 1, borderColor: '#e5eeff', borderRadius: 10, padding: 10, marginBottom: 14, minHeight: 60 }}
                placeholderTextColor="#bec8ce"
              />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity onPress={() => setEditField(null)} style={{ flex: 1, paddingVertical: 10, borderRadius: 100, borderWidth: 1, borderColor: '#bec8ce', alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'Manrope', fontWeight: '600', color: '#6f787e', fontSize: 13 }}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSavePriorities} disabled={updateMedical.isPending} style={{ flex: 1, paddingVertical: 10, borderRadius: 100, backgroundColor: '#82d8ff', alignItems: 'center' }}>
                  {updateMedical.isPending ? <ActivityIndicator size="small" color="#0b1c30" /> : <Text style={{ fontFamily: 'Manrope', fontWeight: '800', color: '#0b1c30', fontSize: 13 }}>Enregistrer</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Notifications card */}
        <View style={{ marginHorizontal: 20, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.70)', padding: 20, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.80)' }}>
          <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '700', color: '#0b1c30', marginBottom: 4 }}>
            Notifications
          </Text>
          <SwitchRow icon="event" label="Rappels rendez-vous" value={notifReminders} onChange={setNotifReminders} />
          <SwitchRow icon="mood" label="Check-in humeur quotidien" value={notifMood} onChange={setNotifMood} />
          <SwitchRow icon="lightbulb" label="Conseils bien-être" value={notifTips} onChange={setNotifTips} />
        </View>

        {/* Security card */}
        <View style={{ marginHorizontal: 20, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.70)', padding: 20, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.80)' }}>
          <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '700', color: '#0b1c30', marginBottom: 4 }}>
            Sécurité
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(auth)/forgot-password' as never)}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14 }}
          >
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <MaterialIcons name="lock" size={18} color="#82d8ff" />
            </View>
            <Text style={{ flex: 1, fontFamily: 'Manrope', fontSize: 14, color: '#0b1c30', fontWeight: '500' }}>Changer le mot de passe</Text>
            <MaterialIcons name="chevron-right" size={20} color="#bec8ce" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/(patient)/permissions' as never)}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderTopWidth: 1, borderTopColor: 'rgba(190,200,206,0.25)' }}
          >
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <MaterialIcons name="shield" size={18} color="#82d8ff" />
            </View>
            <Text style={{ flex: 1, fontFamily: 'Manrope', fontSize: 14, color: '#0b1c30', fontWeight: '500' }}>Rôles & autorisations</Text>
            <MaterialIcons name="chevron-right" size={20} color="#bec8ce" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/(patient)/support' as never)}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderTopWidth: 1, borderTopColor: 'rgba(190,200,206,0.25)' }}
          >
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <MaterialIcons name="help" size={18} color="#82d8ff" />
            </View>
            <Text style={{ flex: 1, fontFamily: 'Manrope', fontSize: 14, color: '#0b1c30', fontWeight: '500' }}>Aide & Support</Text>
            <MaterialIcons name="chevron-right" size={20} color="#bec8ce" />
          </TouchableOpacity>
          {/* Retour terrain : trop visible juste sous Déconnexion — déplacé
              ici (section Aide & Support), plus en retrait. */}
          <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(190,200,206,0.25)' }}>
            <DeleteAccountSection />
          </View>
        </View>

        {/* Sign out */}
        <View style={{ marginHorizontal: 20 }}>
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
          <Text style={{ fontFamily: 'Manrope', fontSize: 11, color: '#bec8ce', textAlign: 'center', marginTop: 12 }}>
            M-Santé v1.0 — Vos données sont chiffrées et sécurisées
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
