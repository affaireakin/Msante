import { View, Text, TouchableOpacity } from 'react-native'
import * as DocumentPicker from 'expo-document-picker'

interface UploadedDoc {
  uri: string
  name: string
  document_type: 'diploma' | 'license' | 'id_card' | 'other'
}

interface DocumentUploaderProps {
  label: string
  documentType: UploadedDoc['document_type']
  value?: UploadedDoc
  onUpload: (doc: UploadedDoc) => void
}

export function DocumentUploader({ label, documentType, value, onUpload }: DocumentUploaderProps) {
  const handlePick = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    })
    if (!result.canceled && result.assets[0]) {
      onUpload({
        uri: result.assets[0].uri,
        name: result.assets[0].name,
        document_type: documentType,
      })
    }
  }

  return (
    <TouchableOpacity
      onPress={handlePick}
      activeOpacity={0.7}
      className="border border-dashed border-outline-variant rounded-xl p-4 items-center gap-2"
    >
      <Text className="text-sm font-manrope font-medium text-on-surface-variant">{label}</Text>
      {value ? (
        <Text className="text-sm text-primary font-manrope" numberOfLines={1}>{value.name}</Text>
      ) : (
        <Text className="text-xs text-outline font-manrope">Appuyer pour sélectionner (PDF ou image)</Text>
      )}
    </TouchableOpacity>
  )
}
