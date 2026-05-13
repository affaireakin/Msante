import { useState } from 'react'
import * as ImagePicker from 'expo-image-picker'
import { Alert, ActionSheetIOS, Platform } from 'react-native'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/features/auth/store/authStore'

type AssetType = 'avatar' | 'stamp' | 'signature'

async function pickImage(allowCamera: boolean): Promise<ImagePicker.ImagePickerResult | null> {
  if (allowCamera && Platform.OS === 'ios') {
    return new Promise((resolve) => {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Annuler', 'Prendre une photo', 'Choisir dans la galerie'], cancelButtonIndex: 0 },
        async (idx) => {
          if (idx === 0) return resolve(null)
          const { status } = idx === 1
            ? await ImagePicker.requestCameraPermissionsAsync()
            : await ImagePicker.requestMediaLibraryPermissionsAsync()
          if (status !== 'granted') {
            Alert.alert('Permission refusée', 'Autorisez l\'accès dans les réglages.')
            return resolve(null)
          }
          const result = idx === 1
            ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: true, aspect: [1, 1] })
            : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: true, aspect: [1, 1] })
          resolve(result)
        },
      )
    })
  }

  if (allowCamera) {
    // Android: show Alert with options
    return new Promise((resolve) => {
      Alert.alert(
        'Choisir une source',
        '',
        [
          { text: 'Annuler', style: 'cancel', onPress: () => resolve(null) },
          {
            text: 'Prendre une photo',
            onPress: async () => {
              const { status } = await ImagePicker.requestCameraPermissionsAsync()
              if (status !== 'granted') {
                Alert.alert('Permission refusée', 'Autorisez l\'accès à la caméra dans les réglages.')
                return resolve(null)
              }
              resolve(await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: true, aspect: [1, 1] }))
            },
          },
          {
            text: 'Galerie',
            onPress: async () => {
              const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
              if (status !== 'granted') {
                Alert.alert('Permission refusée', 'Autorisez l\'accès à la galerie dans les réglages.')
                return resolve(null)
              }
              resolve(await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: true, aspect: [1, 1] }))
            },
          },
        ]
      )
    })
  }

  // Library only (stamp, signature)
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (status !== 'granted') {
    Alert.alert('Permission refusée', 'Autorisez l\'accès à la galerie dans les réglages.')
    return null
  }
  return ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsEditing: false })
}

async function uploadAsset(uri: string, userId: string, practitionerId: string, assetType: AssetType) {
  const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg'
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'

  const response = await fetch(uri)
  const blob = await response.blob()

  if (assetType === 'avatar') {
    const path = `${userId}/avatar.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, blob, { upsert: true, contentType: mime })
    if (error) throw error
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    const { error: dbErr } = await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', userId)
    if (dbErr) throw dbErr
    return publicUrl
  }

  const assetName = assetType === 'stamp' ? 'stamp' : 'signature'
  const path = `${userId}/${assetName}.${ext}`
  const { error } = await supabase.storage.from('practitioner-assets').upload(path, blob, { upsert: true, contentType: mime })
  if (error) throw error

  const { data: { publicUrl } } = supabase.storage.from('practitioner-assets').getPublicUrl(path)
  const column = assetType === 'stamp' ? 'stamp_url' : 'signature_url'
  const { error: dbErr } = await supabase.from('practitioners').update({ [column]: publicUrl }).eq('id', practitionerId)
  if (dbErr) throw dbErr
  return publicUrl
}

export function usePractitionerAssetUpload() {
  const [uploading, setUploading] = useState<AssetType | null>(null)
  const profile = useAuthStore((s) => s.profile)
  const practitioner = useAuthStore((s) => s.practitioner)
  const setProfile = useAuthStore((s) => s.setProfile)
  const setPractitioner = useAuthStore((s) => s.setPractitioner)

  const upload = async (assetType: AssetType) => {
    if (!profile || !practitioner) return
    const allowCamera = assetType === 'avatar'
    const result = await pickImage(allowCamera)
    if (!result || result.canceled || !result.assets[0]) return

    setUploading(assetType)
    try {
      const url = await uploadAsset(result.assets[0].uri, profile.id, practitioner.id, assetType)

      // Update local store
      if (assetType === 'avatar') {
        setProfile({ ...profile, avatar_url: url })
      } else {
        setPractitioner({ ...practitioner, [assetType === 'stamp' ? 'stamp_url' : 'signature_url']: url })
      }
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible d\'uploader l\'image.')
    } finally {
      setUploading(null)
    }
  }

  const remove = async (assetType: AssetType) => {
    if (!profile || !practitioner) return
    Alert.alert(
      'Supprimer',
      `Supprimer ${assetType === 'avatar' ? 'la photo' : assetType === 'stamp' ? 'le cachet' : 'la signature'} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              if (assetType === 'avatar') {
                await supabase.from('users').update({ avatar_url: null }).eq('id', profile.id)
                setProfile({ ...profile, avatar_url: null })
              } else {
                const column = assetType === 'stamp' ? 'stamp_url' : 'signature_url'
                await supabase.from('practitioners').update({ [column]: null }).eq('id', practitioner.id)
                setPractitioner({ ...practitioner, [column]: null })
              }
            } catch (e) {
              Alert.alert('Erreur', e instanceof Error ? e.message : 'Impossible de supprimer.')
            }
          },
        },
      ]
    )
  }

  return { upload, remove, uploading }
}
