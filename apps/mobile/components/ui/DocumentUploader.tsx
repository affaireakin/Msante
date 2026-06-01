import { Text, TouchableOpacity } from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import type { DocumentType } from '@/types/database'

interface UploadedDoc {
  uri: string
  name: string
  document_type: DocumentType
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
      style={{
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: value ? '#006685' : '#bec8ce',
        borderRadius: 14,
        padding: 16,
        alignItems: 'center',
        gap: 8,
        backgroundColor: value ? '#f0f9ff' : 'transparent',
      }}
    >
      <MaterialIcons
        name={value ? 'check-circle' : 'upload-file'}
        size={24}
        color={value ? '#006685' : '#6f787e'}
      />
      <Text style={{ fontSize: 14, fontFamily: 'Manrope', fontWeight: '600', color: '#3f484d' }}>
        {label}
      </Text>
      {value ? (
        <Text style={{ fontSize: 12, color: '#006685', fontFamily: 'Manrope', fontWeight: '600' }} numberOfLines={1}>
          {value.name}
        </Text>
      ) : (
        <Text style={{ fontSize: 12, color: '#6f787e', fontFamily: 'Manrope' }}>
          Appuyer pour sélectionner · PDF ou image
        </Text>
      )}
    </TouchableOpacity>
  )
}
