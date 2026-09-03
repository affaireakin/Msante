import { useState } from 'react'
import { Text, TouchableOpacity, View, Image, Alert, ActivityIndicator } from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'

export interface UploadedDoc<T extends string = string> {
  uri: string
  name: string
  document_type: T
  isImage: boolean
}

interface DocumentUploaderProps<T extends string> {
  label: string
  hint?: string
  documentType: T
  value?: UploadedDoc<T>
  onUpload: (doc: UploadedDoc<T>) => void
  uploading?: boolean
}

// Doit correspondre exactement aux types MIME acceptés par les buckets de
// stockage (verification-documents / documents) — supabase/migrations/
// 20260430000005_storage_buckets.sql. 'image/*' laissait passer le HEIC
// (photos iPhone), rejeté silencieusement par le bucket à l'upload.
const ACCEPTED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

async function requestCameraPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync()
  if (status !== 'granted') {
    Alert.alert('Permission refusée', "Autorisez l'accès à la caméra dans les réglages pour photographier ce document.")
    return false
  }
  return true
}

export interface PickedAsset { uri: string; name: string; isImage: boolean }

// Prise de photo caméra / galerie / fichier PDF pour un document — logique
// partagée entre DocumentUploader (praticien, un slot par type de document
// requis) et l'écran organisation (liste ouverte, un bouton "Ajouter" qui
// empile les documents) : la forme de la liste diffère selon l'écran, mais
// pas la façon de choisir un fichier, donc une seule fonction pour ça.
export function pickDocumentAsset(): Promise<PickedAsset | null> {
  return new Promise((resolve) => {
    Alert.alert(
      'Ajouter un document',
      'Photo, galerie ou fichier PDF',
      [
        { text: 'Annuler', style: 'cancel', onPress: () => resolve(null) },
        {
          text: 'Prendre une photo',
          onPress: async () => {
            if (!(await requestCameraPermission())) return resolve(null)
            const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: true })
            resolve(!result.canceled && result.assets[0] ? { uri: result.assets[0].uri, name: `photo-${Date.now()}.jpg`, isImage: true } : null)
          },
        },
        {
          text: 'Choisir une image',
          onPress: async () => {
            const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: true })
            resolve(!result.canceled && result.assets[0] ? { uri: result.assets[0].uri, name: result.assets[0].fileName ?? `image-${Date.now()}.jpg`, isImage: true } : null)
          },
        },
        {
          text: 'Choisir un fichier PDF',
          onPress: async () => {
            const result = await DocumentPicker.getDocumentAsync({ type: ACCEPTED_MIME, copyToCacheDirectory: true })
            if (result.canceled || !result.assets[0]) return resolve(null)
            resolve({ uri: result.assets[0].uri, name: result.assets[0].name, isImage: result.assets[0].mimeType?.startsWith('image/') ?? false })
          },
        },
      ],
      { cancelable: true, onDismiss: () => resolve(null) },
    )
  })
}

export function DocumentUploader<T extends string>({ label, hint, documentType, value, onUpload, uploading }: DocumentUploaderProps<T>) {
  const [picking, setPicking] = useState(false)

  const handlePick = async () => {
    setPicking(true)
    const asset = await pickDocumentAsset()
    setPicking(false)
    if (asset) onUpload({ uri: asset.uri, name: asset.name, document_type: documentType, isImage: asset.isImage })
  }

  const busy = picking || uploading

  return (
    <TouchableOpacity
      onPress={handlePick}
      disabled={busy}
      activeOpacity={0.7}
      style={{
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: value ? '#82d8ff' : '#bec8ce',
        borderRadius: 14,
        padding: 16,
        alignItems: 'center',
        gap: 8,
        backgroundColor: value ? '#f0f9ff' : 'transparent',
        opacity: busy ? 0.7 : 1,
      }}
    >
      {uploading ? (
        <ActivityIndicator color="#82d8ff" />
      ) : value?.isImage ? (
        <Image source={{ uri: value.uri }} style={{ width: 64, height: 64, borderRadius: 10 }} resizeMode="cover" />
      ) : (
        <MaterialIcons name={value ? 'picture-as-pdf' : 'upload-file'} size={24} color={value ? '#82d8ff' : '#6f787e'} />
      )}
      <Text style={{ fontSize: 14, fontFamily: 'Manrope', fontWeight: '600', color: '#3f484d' }}>
        {label}
      </Text>
      {value ? (
        <>
          <Text style={{ fontSize: 12, color: '#82d8ff', fontFamily: 'Manrope', fontWeight: '600' }} numberOfLines={1}>
            {value.name}
          </Text>
          <Text style={{ fontSize: 11, color: '#6f787e', fontFamily: 'Manrope' }}>Appuyer pour remplacer</Text>
        </>
      ) : (
        <Text style={{ fontSize: 12, color: '#6f787e', fontFamily: 'Manrope', textAlign: 'center' }}>
          {hint ?? 'Photo, galerie ou PDF'}
        </Text>
      )}
    </TouchableOpacity>
  )
}
