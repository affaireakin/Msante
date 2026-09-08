import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, TextInput, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import * as ImagePicker from 'expo-image-picker'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { uploadLocalFile, mimeFromUri } from '@/services/uploadFile'
import { useResponsive } from '@/hooks/useResponsive'

interface OrgOverview {
  organizationId: string
  name: string
  city: string | null
  logoUrl: string | null
  description: string | null
  openingHours: string | null
  practitionerCount: number
  todayAppointmentCount: number
  pendingAppointmentCount: number
}

function useOrgOverview() {
  return useQuery<OrgOverview | null>({
    queryKey: ['org-overview'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const { data: profile } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
      const organizationId = profile?.organization_id
      if (!organizationId) return null

      const { data: org } = await supabase
        .from('organizations')
        .select('name, city, logo_url, description, opening_hours')
        .eq('id', organizationId)
        .single()

      const startOfDay = new Date(); startOfDay.setUTCHours(0, 0, 0, 0)
      const endOfDay = new Date(startOfDay); endOfDay.setUTCDate(endOfDay.getUTCDate() + 1)

      const [{ count: practitionerCount }, { count: todayAppointmentCount }, { count: pendingAppointmentCount }] = await Promise.all([
        supabase.from('practitioners').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
        supabase.from('appointments').select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .gte('scheduled_at', startOfDay.toISOString())
          .lt('scheduled_at', endOfDay.toISOString())
          .not('status', 'in', '("cancelled")'),
        supabase.from('appointments').select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .eq('status', 'pending'),
      ])

      return {
        organizationId,
        name: org?.name ?? '—',
        city: org?.city ?? null,
        logoUrl: org?.logo_url ?? null,
        description: org?.description ?? null,
        openingHours: org?.opening_hours ?? null,
        practitionerCount: practitionerCount ?? 0,
        todayAppointmentCount: todayAppointmentCount ?? 0,
        pendingAppointmentCount: pendingAppointmentCount ?? 0,
      }
    },
    staleTime: 30_000,
  })
}

export default function OrganizationDashboardScreen() {
  const router = useRouter()
  const { fs, scale } = useResponsive()
  const qc = useQueryClient()
  const { data, isLoading } = useOrgOverview()
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [desc, setDesc] = useState('')
  const [hours, setHours] = useState('')
  const [editingProfile, setEditingProfile] = useState(false)
  const [saving, setSaving] = useState(false)

  const startEditing = () => {
    setDesc(data?.description ?? '')
    setHours(data?.openingHours ?? '')
    setEditingProfile(true)
  }

  const pickLogoSource = (): Promise<ImagePicker.ImagePickerResult | null> => new Promise((resolve) => {
    Alert.alert('Logo de l\'organisation', 'Prendre une photo ou choisir depuis la galerie', [
      { text: 'Annuler', style: 'cancel', onPress: () => resolve(null) },
      {
        text: 'Prendre une photo',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync()
          if (status !== 'granted') {
            Alert.alert('Permission refusée', "Autorisez l'accès à la caméra dans les réglages.")
            return resolve(null)
          }
          resolve(await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: true, aspect: [1, 1] }))
        },
      },
      {
        text: 'Galerie',
        onPress: async () => {
          // Sélecteur système (Photo Picker) — aucune permission de galerie requise.
          resolve(await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: true, aspect: [1, 1] }))
        },
      },
    ])
  })

  const uploadLogo = async () => {
    if (!data?.organizationId) return
    const result = await pickLogoSource()
    if (!result || result.canceled || !result.assets[0]) return

    setUploadingLogo(true)
    try {
      const ext = result.assets[0].uri.split('.').pop() ?? 'jpg'
      const path = `${data.organizationId}/logo.${ext}`
      await uploadLocalFile('organization-logos', path, result.assets[0].uri, mimeFromUri(result.assets[0].uri, 'image/jpeg'))
      const { data: { publicUrl } } = supabase.storage.from('organization-logos').getPublicUrl(path)
      await supabase.from('organizations').update({ logo_url: `${publicUrl}?t=${Date.now()}` }).eq('id', data.organizationId)
      qc.invalidateQueries({ queryKey: ['org-overview'] })
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : "Impossible d'envoyer le logo.")
    } finally {
      setUploadingLogo(false)
    }
  }

  const saveProfile = async () => {
    if (!data?.organizationId) return
    setSaving(true)
    try {
      await supabase.from('organizations').update({ description: desc || null, opening_hours: hours || null }).eq('id', data.organizationId)
      qc.invalidateQueries({ queryKey: ['org-overview'] })
      setEditingProfile(false)
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible de sauvegarder.')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#82d8ff" size="large" />
      </SafeAreaView>
    )
  }

  const KPIS = [
    { label: 'Praticiens', value: data?.practitionerCount ?? 0, icon: 'medical-services' as const, color: '#005e7a', bg: '#e5eeff' },
    { label: "RDV aujourd'hui", value: data?.todayAppointmentCount ?? 0, icon: 'calendar-today' as const, color: '#1d7a3a', bg: '#e8f5e9' },
    { label: 'RDV en attente', value: data?.pendingAppointmentCount ?? 0, icon: 'schedule' as const, color: '#705d00', bg: '#fff8e1' },
  ]

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: scale(20), paddingBottom: scale(110), gap: scale(16) }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.xxl, fontWeight: '800', color: '#0b1c30' }}>{data?.name ?? '—'}</Text>
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, color: '#6f787e', marginTop: 2 }}>
              {data?.city ? `${data.city} · ` : ''}Vue d&apos;ensemble de votre organisation
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(organization)/notifications')}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.70)', borderWidth: 1, borderColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}
          >
            <MaterialIcons name="notifications-none" size={20} color="#0b1c30" />
          </TouchableOpacity>
        </View>

        {/* Logo */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(14), backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: scale(16), borderWidth: 1, borderColor: '#e5eeff', padding: scale(16) }}>
          <View style={{ width: scale(56), height: scale(56), borderRadius: scale(14), backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {uploadingLogo ? (
              <ActivityIndicator color="#005e7a" />
            ) : data?.logoUrl ? (
              <Image source={{ uri: data.logoUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            ) : (
              <MaterialIcons name="storefront" size={scale(26)} color="#005e7a" />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '700', color: '#0b1c30' }}>Logo de l&apos;organisation</Text>
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#6f787e' }}>Visible par les patients</Text>
          </View>
          <TouchableOpacity onPress={uploadLogo} disabled={uploadingLogo} style={{ paddingHorizontal: scale(12), paddingVertical: scale(8), borderRadius: 999, backgroundColor: '#82d8ff' }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: '#0b1c30' }}>{data?.logoUrl ? 'Changer' : 'Ajouter'}</Text>
          </TouchableOpacity>
        </View>

        {/* Profil public */}
        <View style={{ backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: scale(16), borderWidth: 1, borderColor: '#e5eeff', padding: scale(16), gap: scale(10) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '700', color: '#0b1c30' }}>Profil public</Text>
            {!editingProfile && (
              <TouchableOpacity onPress={startEditing}>
                <MaterialIcons name="edit" size={scale(16)} color="#82d8ff" />
              </TouchableOpacity>
            )}
          </View>
          {editingProfile ? (
            <>
              <TextInput
                value={desc} onChangeText={setDesc} placeholder="Présentez votre cabinet..." multiline numberOfLines={3}
                style={{ fontFamily: 'Manrope', fontSize: fs.sm, color: '#0b1c30', backgroundColor: '#f8f9ff', borderRadius: scale(10), borderWidth: 1, borderColor: '#e5eeff', padding: scale(10), minHeight: scale(70), textAlignVertical: 'top' }}
              />
              <TextInput
                value={hours} onChangeText={setHours} placeholder="Ex: Lun-Ven 8h-18h" multiline
                style={{ fontFamily: 'Manrope', fontSize: fs.sm, color: '#0b1c30', backgroundColor: '#f8f9ff', borderRadius: scale(10), borderWidth: 1, borderColor: '#e5eeff', padding: scale(10), minHeight: scale(44), textAlignVertical: 'top' }}
              />
              <View style={{ flexDirection: 'row', gap: scale(10) }}>
                <TouchableOpacity onPress={() => setEditingProfile(false)} style={{ flex: 1, paddingVertical: scale(10), borderRadius: 999, borderWidth: 1, borderColor: '#bec8ce', alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: '#6f787e' }}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={saveProfile} disabled={saving} style={{ flex: 1, paddingVertical: scale(10), borderRadius: 999, backgroundColor: '#82d8ff', alignItems: 'center' }}>
                  {saving ? <ActivityIndicator size="small" color="#0b1c30" /> : <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '800', color: '#0b1c30' }}>Enregistrer</Text>}
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, color: data?.description ? '#3f484d' : '#6f787e' }}>
                {data?.description || 'Aucune description'}
              </Text>
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#6f787e' }}>
                {data?.openingHours || 'Horaires non renseignés'}
              </Text>
            </>
          )}
        </View>

        {/* KPIs */}
        <View style={{ gap: scale(10) }}>
          {KPIS.map(kpi => (
            <View key={kpi.label} style={{ flexDirection: 'row', alignItems: 'center', gap: scale(14), backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: scale(16), borderWidth: 1, borderColor: '#e5eeff', padding: scale(16) }}>
              <View style={{ width: scale(44), height: scale(44), borderRadius: scale(12), backgroundColor: kpi.bg, alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcons name={kpi.icon} size={scale(20)} color={kpi.color} />
              </View>
              <View>
                <Text style={{ fontFamily: 'Manrope', fontSize: fs.xl, fontWeight: '800', color: '#0b1c30' }}>{kpi.value}</Text>
                <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#6f787e', fontWeight: '600' }}>{kpi.label}</Text>
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity
          onPress={() => router.push('/(organization)/collaborators')}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: scale(8), paddingVertical: scale(14), borderRadius: 999, backgroundColor: '#82d8ff' }}
        >
          <MaterialIcons name="group" size={scale(18)} color="#0b1c30" />
          <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '800', color: '#0b1c30' }}>Gérer mon équipe</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}
