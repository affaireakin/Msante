import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import * as DocumentPicker from 'expo-document-picker'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { supabase } from '@/services/supabase'
import { uploadLocalFile, mimeFromUri } from '@/services/uploadFile'
import { useResponsive } from '@/hooks/useResponsive'
import type { DocumentType, VerificationDocument } from '@/types/database'

// Mêmes 6 valeurs que le CHECK constraint Postgres (voir types/database.ts) —
// le `key` doit rester une de ces valeurs, `label` reste la description
// affichée à l'utilisateur (voir la même approche déjà utilisée côté
// onboarding et côté web practitioner/profile).
const HEALTHCARE_DOCS: { key: DocumentType; label: string; icon: React.ComponentProps<typeof MaterialIcons>['name'] }[] = [
  { key: 'diploma', label: 'Diplôme', icon: 'school' },
  { key: 'license', label: "Autorisation d'exercer", icon: 'verified' },
  { key: 'order_certificate', label: "Carte de l'Ordre professionnel", icon: 'workspace-premium' },
  { key: 'id_card', label: "Pièce d'identité officielle", icon: 'badge' },
]

const WELLNESS_DOCS: { key: DocumentType; label: string; icon: React.ComponentProps<typeof MaterialIcons>['name'] }[] = [
  { key: 'diploma', label: 'Certificat de formation', icon: 'school' },
  { key: 'professional_insurance', label: "Attestation d'assurance pro", icon: 'security' },
  { key: 'id_card', label: "Pièce d'identité officielle", icon: 'badge' },
]

const DOC_LABELS: Record<DocumentType, string> = {
  diploma: 'Diplôme',
  license: "Autorisation d'exercer",
  id_card: "Pièce d'identité",
  order_certificate: "Carte de l'Ordre professionnel",
  professional_insurance: 'Assurance professionnelle',
  other: 'Document complémentaire',
}

const STATUS_META: Record<VerificationDocument['status'], { label: string; bg: string; color: string; icon: React.ComponentProps<typeof MaterialIcons>['name'] }> = {
  pending: { label: 'En attente', bg: '#fef3c7', color: '#92400e', icon: 'hourglass-empty' },
  approved: { label: 'Validé', bg: '#d1fae5', color: '#1d7a3a', icon: 'check-circle' },
  rejected: { label: 'À corriger', bg: '#ffdad6', color: '#ba1a1a', icon: 'error-outline' },
}

// Le bucket réel des documents de vérification est 'documents' (privé depuis
// 20260722000002_private_documents_bucket.sql) — cet écran ciblait encore
// l'ancien bucket 'verification-documents' (pré-consolidation) avec
// getPublicUrl(), ce qui échouait à l'upload (bucket jamais peuplé côté
// pratique par le flux d'onboarding actuel) et aurait de toute façon produit
// des liens inutilisables sur un bucket privé. Même convention de path que
// web (apps/web/lib/signedDocumentUrl.ts) : {user_id}/type_timestamp.ext,
// file_url stocke le path nu, résolu en URL signée à l'ouverture.
async function resolveDocumentUrl(fileUrlOrPath: string): Promise<string | null> {
  const marker = '/documents/'
  const idx = fileUrlOrPath.indexOf(marker)
  const path = idx === -1 ? fileUrlOrPath : fileUrlOrPath.slice(idx + marker.length)
  const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 300)
  if (error || !data) return null
  return data.signedUrl
}

function usePractitionerType(practitionerId: string | undefined) {
  return useQuery<'healthcare' | 'wellness'>({
    queryKey: ['practitioner-type', practitionerId],
    enabled: !!practitionerId,
    queryFn: async () => {
      const { data, error } = await supabase.from('practitioners').select('practitioner_type').eq('id', practitionerId!).single()
      if (error) throw error
      return (data?.practitioner_type as 'healthcare' | 'wellness' | null) ?? 'healthcare'
    },
  })
}

function useVerificationDocuments(practitionerId: string | undefined) {
  return useQuery<VerificationDocument[]>({
    queryKey: ['verification-documents', practitionerId],
    enabled: !!practitionerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('verification_documents')
        .select('id, practitioner_id, document_type, file_url, status, reviewed_by, reviewed_at, created_at')
        .eq('practitioner_id', practitionerId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

export default function PractitionerDocumentsScreen() {
  const router = useRouter()
  const { fs, scale } = useResponsive()
  const { profile, practitioner } = useAuth()
  const qc = useQueryClient()
  const [uploading, setUploading] = useState<string | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)

  const { data: practitionerType } = usePractitionerType(practitioner?.id)
  const { data: docs = [], isLoading } = useVerificationDocuments(practitioner?.id)

  const slots = practitionerType === 'wellness' ? WELLNESS_DOCS : HEALTHCARE_DOCS

  async function uploadDoc(type: DocumentType, originalName?: string) {
    if (!practitioner?.id || !profile?.id) return
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true })
    if (result.canceled || !result.assets[0]) return
    const asset = result.assets[0]

    setUploading(type + (originalName ?? ''))
    try {
      const ext = asset.name.split('.').pop() ?? 'pdf'
      const baseName = asset.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 40)
      const filePath = type === 'other'
        ? `${profile.id}/other_${Date.now()}_${baseName}.${ext}`
        : `${profile.id}/${type}_${Date.now()}.${ext}`

      await uploadLocalFile('documents', filePath, asset.uri, mimeFromUri(asset.name, 'application/pdf'))

      const { error: insertError } = await supabase.from('verification_documents').insert({
        practitioner_id: practitioner.id,
        document_type: type,
        file_url: filePath,
        status: 'pending',
      })
      if (insertError) throw insertError

      // Best-effort, non-bloquant — même notification admin que côté web.
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          await supabase.functions.invoke('notify-document-change', { body: { document_type: type } })
        }
      } catch {
        // le document est déjà envoyé avec succès, on ignore l'échec de la notif
      }

      qc.invalidateQueries({ queryKey: ['verification-documents', practitioner.id] })
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : "Impossible d'envoyer le document.")
    } finally {
      setUploading(null)
    }
  }

  async function openDocument(doc: VerificationDocument) {
    setOpeningId(doc.id)
    try {
      const url = await resolveDocumentUrl(doc.file_url)
      if (!url) {
        Alert.alert('Erreur', "Impossible d'ouvrir ce document.")
        return
      }
      await Linking.openURL(url)
    } catch {
      Alert.alert('Erreur', "Impossible d'ouvrir ce document.")
    } finally {
      setOpeningId(null)
    }
  }

  function otherDocLabel(fileUrl: string): string {
    const match = fileUrl.match(/other_\d+_(.+)\.[^.]+$/)
    return match ? match[1].replace(/_/g, ' ') : DOC_LABELS.other
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(12), paddingHorizontal: scale(20), paddingVertical: scale(14), backgroundColor: 'rgba(255,255,255,0.80)', borderBottomWidth: 1, borderBottomColor: 'rgba(229,238,255,0.6)' }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <MaterialIcons name="arrow-back" size={24} color="#0b1c30" />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontFamily: 'Manrope', fontSize: fs.lg, fontWeight: '800', color: '#0b1c30' }}>Mes documents</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: scale(20), gap: scale(16) }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, color: '#6f787e' }}>
          Ajoutez ou remplacez vos documents. Chaque soumission passe en révision.
        </Text>

        {isLoading ? (
          <ActivityIndicator color="#82d8ff" style={{ marginTop: scale(20) }} />
        ) : (
          <>
            {docs.length > 0 && (
              <View style={{ gap: scale(8) }}>
                {docs.map(doc => {
                  const meta = STATUS_META[doc.status] ?? STATUS_META.pending
                  return (
                    <View key={doc.id} style={{ flexDirection: 'row', alignItems: 'center', gap: scale(10), backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: scale(14), borderWidth: 1, borderColor: '#e5eeff', padding: scale(12) }}>
                      <MaterialIcons name="description" size={scale(18)} color="#82d8ff" />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '700', color: '#0b1c30' }} numberOfLines={1}>
                          {doc.document_type === 'other' ? otherDocLabel(doc.file_url) : (DOC_LABELS[doc.document_type] ?? doc.document_type)}
                        </Text>
                        <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#6f787e' }}>
                          {new Date(doc.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(4), paddingHorizontal: scale(8), paddingVertical: scale(4), borderRadius: 999, backgroundColor: meta.bg }}>
                        <MaterialIcons name={meta.icon} size={scale(12)} color={meta.color} />
                        <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: meta.color }}>{meta.label}</Text>
                      </View>
                      <TouchableOpacity onPress={() => openDocument(doc)} disabled={openingId === doc.id}>
                        {openingId === doc.id
                          ? <ActivityIndicator size="small" color="#6f787e" />
                          : <MaterialIcons name="open-in-new" size={scale(16)} color="#6f787e" />}
                      </TouchableOpacity>
                    </View>
                  )
                })}
              </View>
            )}

            <View style={{ gap: scale(10) }}>
              {slots.map(slot => (
                <TouchableOpacity
                  key={slot.key}
                  onPress={() => uploadDoc(slot.key)}
                  disabled={uploading === slot.key}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: scale(12), padding: scale(14), borderRadius: scale(14), borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#bec8ce' }}
                >
                  <View style={{ width: scale(38), height: scale(38), borderRadius: scale(12), backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}>
                    {uploading === slot.key
                      ? <ActivityIndicator size="small" color="#82d8ff" />
                      : <MaterialIcons name={slot.icon} size={scale(18)} color="#82d8ff" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '700', color: '#0b1c30' }}>{slot.label}</Text>
                    <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#6f787e' }}>PDF, JPG, PNG — max 10 Mo</Text>
                  </View>
                  <MaterialIcons name="file-upload" size={scale(18)} color="#6f787e" />
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                onPress={() => uploadDoc('other')}
                disabled={!!uploading}
                style={{ flexDirection: 'row', alignItems: 'center', gap: scale(12), padding: scale(14), borderRadius: scale(14), borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#82d8ff', backgroundColor: 'rgba(0,102,133,0.03)' }}
              >
                <View style={{ width: scale(38), height: scale(38), borderRadius: scale(12), backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}>
                  {uploading === 'other'
                    ? <ActivityIndicator size="small" color="#82d8ff" />
                    : <MaterialIcons name="add" size={scale(18)} color="#82d8ff" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '700', color: '#0b1c30' }}>Ajouter un document</Text>
                  <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#6f787e' }}>Tout justificatif complémentaire, sans limite</Text>
                </View>
              </TouchableOpacity>
            </View>
          </>
        )}

        <View style={{ backgroundColor: '#fef3c7', borderRadius: scale(12), padding: scale(12), flexDirection: 'row', gap: scale(8) }}>
          <MaterialIcons name="info-outline" size={scale(14)} color="#92400e" />
          <Text style={{ flex: 1, fontFamily: 'Manrope', fontSize: fs.xs, color: '#92400e' }}>
            Chaque nouveau document soumis repasse en revue. Délai de vérification : 24 à 48h.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
