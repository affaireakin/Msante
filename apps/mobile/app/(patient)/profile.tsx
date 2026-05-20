import { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, Alert,
  ActivityIndicator, Switch, TextInput,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useAuthStore } from '@/features/auth/store/authStore'
import { supabase } from '@/services/supabase'

type IconName = React.ComponentProps<typeof MaterialIcons>['name']

// ── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
}

function memberSince(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

// ── Row components ────────────────────────────────────────────────────────────

function InfoRow({
  icon, label, value, onEdit,
}: { icon: IconName; label: string; value: string; onEdit?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(190,200,206,0.25)' }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
        <MaterialIcons name={icon} size={18} color="#006685" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: 'Manrope', fontSize: 11, color: '#6f787e', fontWeight: '600', marginBottom: 1 }}>{label}</Text>
        <Text style={{ fontFamily: 'Manrope', fontSize: 14, color: '#0b1c30', fontWeight: '500' }}>{value || '—'}</Text>
      </View>
      {onEdit && (
        <TouchableOpacity onPress={onEdit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialIcons name="edit" size={18} color="#006685" />
        </TouchableOpacity>
      )}
    </View>
  )
}

function SwitchRow({
  icon, label, value, onChange,
}: { icon: IconName; label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(190,200,206,0.25)' }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
        <MaterialIcons name={icon} size={18} color="#006685" />
      </View>
      <Text style={{ flex: 1, fontFamily: 'Manrope', fontSize: 14, color: '#0b1c30', fontWeight: '500' }}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#e2e8f0', true: '#82d8ff' }}
        thumbColor={value ? '#006685' : '#fff'}
      />
    </View>
  )
}

// ── Edit modal (inline, no separate modal) ────────────────────────────────────

function EditField({
  label, value, onChange, onCancel, onSave, saving, keyboardType = 'default',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  onCancel: () => void
  onSave: () => void
  saving: boolean
  keyboardType?: 'default' | 'phone-pad'
}) {
  return (
    <View style={{
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderRadius: 20,
      padding: 20,
      marginTop: 8,
      borderWidth: 1,
      borderColor: 'rgba(0,102,133,0.15)',
    }}>
      <Text style={{ fontFamily: 'Manrope', fontSize: 12, fontWeight: '700', color: '#006685', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        autoFocus
        style={{
          fontFamily: 'Manrope',
          fontSize: 15,
          color: '#0b1c30',
          borderBottomWidth: 1.5,
          borderBottomColor: '#006685',
          paddingVertical: 6,
          marginBottom: 16,
        }}
        placeholder="Entrez une valeur"
        placeholderTextColor="#bec8ce"
      />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <TouchableOpacity
          onPress={onCancel}
          style={{ flex: 1, paddingVertical: 10, borderRadius: 100, borderWidth: 1, borderColor: '#bec8ce', alignItems: 'center' }}
        >
          <Text style={{ fontFamily: 'Manrope', fontWeight: '600', color: '#6f787e', fontSize: 13 }}>Annuler</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onSave}
          disabled={saving}
          style={{ flex: 1, paddingVertical: 10, borderRadius: 100, backgroundColor: '#006685', alignItems: 'center' }}
        >
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={{ fontFamily: 'Manrope', fontWeight: '700', color: '#fff', fontSize: 13 }}>Enregistrer</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const router = useRouter()
  const { profile } = useAuth()
  const signOut = useAuthStore((s) => s.signOut)
  const setProfile = useAuthStore((s) => s.setProfile)
  const queryClient = useQueryClient()

  const [editField, setEditField] = useState<'full_name' | 'phone' | null>(null)
  const [editValue, setEditValue] = useState('')

  // Notification preferences — stored as user metadata
  const [notifReminders, setNotifReminders] = useState(true)
  const [notifMood, setNotifMood] = useState(true)
  const [notifTips, setNotifTips] = useState(false)

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
    onError: (err) => {
      Alert.alert('Erreur', err instanceof Error ? err.message : 'Impossible de sauvegarder')
    },
  })

  const handleSaveEdit = () => {
    if (!editField || !editValue.trim()) return
    updateProfile.mutate({ [editField]: editValue.trim() })
  }

  const handleSignOut = () => {
    Alert.alert(
      'Déconnexion',
      'Voulez-vous vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Déconnecter', style: 'destructive', onPress: () => signOut() },
      ]
    )
  }

  const handleChangePassword = () => {
    Alert.alert(
      'Changer le mot de passe',
      'Un email de réinitialisation va être envoyé à votre adresse.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Envoyer',
          onPress: async () => {
            const { error } = await supabase.auth.resetPasswordForEmail(
              profile?.id ? '' : '',
              { redirectTo: 'msante://reset-password' }
            )
            if (error) {
              Alert.alert('Erreur', error.message)
            } else {
              Alert.alert('Email envoyé', 'Vérifiez votre boîte mail pour réinitialiser votre mot de passe.')
            }
          },
        },
      ]
    )
  }

  if (!profile) return null

  const name = profile.full_name ?? 'Patient'
  const ini = initials(name)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
            <MaterialIcons name="arrow-back" size={22} color="#006685" />
          </TouchableOpacity>
          <Text style={{ fontFamily: 'Manrope', fontSize: 20, fontWeight: '700', color: '#0b1c30' }}>
            Mon profil
          </Text>
        </View>

        {/* Avatar + identity */}
        <View style={{ alignItems: 'center', paddingVertical: 28, paddingHorizontal: 24 }}>
          <View style={{
            width: 84, height: 84, borderRadius: 42,
            backgroundColor: '#006685', alignItems: 'center', justifyContent: 'center',
            shadowColor: '#006685', shadowOpacity: 0.25, shadowOffset: { width: 0, height: 8 }, shadowRadius: 20,
            marginBottom: 14,
          }}>
            <Text style={{ fontFamily: 'Manrope', fontWeight: '800', fontSize: 30, color: '#fff' }}>{ini}</Text>
          </View>
          <Text style={{ fontFamily: 'Manrope', fontSize: 20, fontWeight: '700', color: '#0b1c30', textAlign: 'center' }}>
            {name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
            <View style={{ backgroundColor: '#e5eeff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <MaterialIcons name="person" size={12} color="#006685" />
              <Text style={{ fontFamily: 'Manrope', fontSize: 11, fontWeight: '700', color: '#006685' }}>Patient</Text>
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
            <EditField
              label="Nom complet"
              value={editValue}
              onChange={setEditValue}
              onCancel={() => setEditField(null)}
              onSave={handleSaveEdit}
              saving={updateProfile.isPending}
            />
          )}

          <InfoRow
            icon="phone"
            label="Téléphone"
            value={profile.phone ?? ''}
            onEdit={() => { setEditField('phone'); setEditValue(profile.phone ?? '') }}
          />
          {editField === 'phone' && (
            <EditField
              label="Téléphone"
              value={editValue}
              onChange={setEditValue}
              onCancel={() => setEditField(null)}
              onSave={handleSaveEdit}
              saving={updateProfile.isPending}
              keyboardType="phone-pad"
            />
          )}

          <InfoRow icon="language" label="Pays" value={profile.country ?? 'SN'} />
        </View>

        {/* Notifications card */}
        <View style={{ marginHorizontal: 20, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.70)', padding: 20, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.80)' }}>
          <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '700', color: '#0b1c30', marginBottom: 4 }}>
            Notifications
          </Text>
          <SwitchRow
            icon="event"
            label="Rappels rendez-vous"
            value={notifReminders}
            onChange={setNotifReminders}
          />
          <SwitchRow
            icon="mood"
            label="Check-in humeur quotidien"
            value={notifMood}
            onChange={setNotifMood}
          />
          <SwitchRow
            icon="lightbulb"
            label="Conseils bien-être"
            value={notifTips}
            onChange={setNotifTips}
          />
        </View>

        {/* Security card */}
        <View style={{ marginHorizontal: 20, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.70)', padding: 20, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.80)' }}>
          <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '700', color: '#0b1c30', marginBottom: 4 }}>
            Sécurité
          </Text>
          <TouchableOpacity
            onPress={handleChangePassword}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14 }}
          >
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <MaterialIcons name="lock" size={18} color="#006685" />
            </View>
            <Text style={{ flex: 1, fontFamily: 'Manrope', fontSize: 14, color: '#0b1c30', fontWeight: '500' }}>
              Changer le mot de passe
            </Text>
            <MaterialIcons name="chevron-right" size={20} color="#bec8ce" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/(patient)/support' as never)}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderTopWidth: 1, borderTopColor: 'rgba(190,200,206,0.25)' }}
          >
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <MaterialIcons name="help" size={18} color="#006685" />
            </View>
            <Text style={{ flex: 1, fontFamily: 'Manrope', fontSize: 14, color: '#0b1c30', fontWeight: '500' }}>
              Aide & Support
            </Text>
            <MaterialIcons name="chevron-right" size={20} color="#bec8ce" />
          </TouchableOpacity>
        </View>

        {/* Sign out */}
        <View style={{ marginHorizontal: 20 }}>
          <TouchableOpacity
            onPress={handleSignOut}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              gap: 8, paddingVertical: 14, borderRadius: 100,
              backgroundColor: 'rgba(186,26,26,0.06)',
              borderWidth: 1, borderColor: 'rgba(186,26,26,0.15)',
            }}
          >
            <MaterialIcons name="logout" size={18} color="#ba1a1a" />
            <Text style={{ fontFamily: 'Manrope', fontWeight: '700', fontSize: 14, color: '#ba1a1a' }}>
              Déconnexion
            </Text>
          </TouchableOpacity>
          <Text style={{ fontFamily: 'Manrope', fontSize: 11, color: '#bec8ce', textAlign: 'center', marginTop: 12 }}>
            M-Santé v1.0 — Vos données sont chiffrées et sécurisées
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
