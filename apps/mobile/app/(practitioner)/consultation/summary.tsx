import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { supabase } from '@/services/supabase'
import { useConsultationStore } from '@/features/consultation/store/consultationStore'

export default function PractitionerConsultationSummary() {
  const router = useRouter()
  const { aiSummary, durationMin, prescriptionUrl, consultationId, reset } = useConsultationStore()
  const [notesDraft, setNotesDraft] = useState('')
  const [notesSaved, setNotesSaved] = useState(false)
  const [isSavingNotes, setIsSavingNotes] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const handleDownloadPrescription = async () => {
    if (!consultationId) return
    try {
      const { data } = await supabase.storage
        .from('prescriptions')
        .createSignedUrl(`${consultationId}/${consultationId}.pdf`, 3600)
      if (data?.signedUrl) {
        await WebBrowser.openBrowserAsync(data.signedUrl)
      }
    } catch {
      // ignore download errors — user can retry
    }
  }

  /** Auto-save on blur — only if there's content */
  const handleNoteBlur = async () => {
    if (!consultationId || !notesDraft.trim()) return
    setIsSavingNotes(true)
    setSaveError(null)
    try {
      const { error } = await supabase
        .from('consultations')
        .update({ practitioner_notes: notesDraft.trim() })
        .eq('id', consultationId)
      if (error) throw error
      setNotesSaved(true)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Erreur lors de la sauvegarde')
    } finally {
      setIsSavingNotes(false)
    }
  }

  /** Manual save button — same logic as blur */
  const handleSaveNotes = async () => {
    if (!consultationId || !notesDraft.trim() || isSavingNotes) return
    setIsSavingNotes(true)
    setSaveError(null)
    try {
      const { error } = await supabase
        .from('consultations')
        .update({ practitioner_notes: notesDraft.trim() })
        .eq('id', consultationId)
      if (error) throw error
      setNotesSaved(true)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Erreur lors de la sauvegarde')
    } finally {
      setIsSavingNotes(false)
    }
  }

  const handleAgenda = () => {
    reset()
    router.replace('/(practitioner)/')
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }}>

        {/* Success header */}
        <View style={{ alignItems: 'center', paddingVertical: 24, gap: 12 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(29,122,58,0.1)' }}>
            <MaterialIcons name="check-circle" size={44} color="#1d7a3a" />
          </View>
          <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#0b1c30', fontFamily: 'Manrope', textAlign: 'center' }}>
            Consultation terminée
          </Text>
          <Text style={{ fontSize: 14, color: '#6f787e', fontFamily: 'Manrope', textAlign: 'center' }}>
            Session enregistrée avec succès
          </Text>
        </View>

        {/* Session info */}
        <View style={{ gap: 12, borderRadius: 12, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', backgroundColor: 'rgba(255,255,255,0.60)' }}>
          <Text style={{ fontSize: 12, color: '#82d8ff', fontFamily: 'Manrope', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 'bold', marginBottom: 4 }}>
            Résumé de la session
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MaterialIcons name="schedule" size={14} color="#6f787e" />
              <Text style={{ fontSize: 14, color: '#6f787e', fontFamily: 'Manrope' }}>Durée</Text>
            </View>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#0b1c30', fontFamily: 'Manrope' }}>
              {durationMin ?? '—'} min
            </Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MaterialIcons name="event" size={14} color="#6f787e" />
              <Text style={{ fontSize: 14, color: '#6f787e', fontFamily: 'Manrope' }}>Date</Text>
            </View>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#0b1c30', fontFamily: 'Manrope' }}>
              {new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </Text>
          </View>
        </View>

        {/* AI summary */}
        {aiSummary ? (
          <View style={{ gap: 12, borderRadius: 12, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', backgroundColor: 'rgba(255,255,255,0.60)' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <MaterialIcons name="psychology" size={18} color="#82d8ff" />
              <Text style={{ fontSize: 12, color: '#82d8ff', fontFamily: 'Manrope', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 'bold' }}>
                Résumé IA
              </Text>
            </View>
            <Text style={{ fontSize: 14, color: '#0b1c30', fontFamily: 'Manrope', lineHeight: 22 }}>
              {aiSummary}
            </Text>
          </View>
        ) : (
          <View style={{ alignItems: 'center', paddingVertical: 16, gap: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', backgroundColor: 'rgba(255,255,255,0.60)' }}>
            <ActivityIndicator color="#82d8ff" />
            <Text style={{ fontSize: 14, color: '#6f787e', fontFamily: 'Manrope' }}>Génération du résumé…</Text>
          </View>
        )}

        {/* Practitioner notes — auto-save on blur */}
        <View style={{ gap: 12, borderRadius: 12, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', backgroundColor: 'rgba(255,255,255,0.60)' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <MaterialIcons name="edit-note" size={18} color="#82d8ff" />
            <Text style={{ fontSize: 12, color: '#82d8ff', fontFamily: 'Manrope', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 'bold' }}>
              Notes cliniques (privées)
            </Text>
          </View>
          <TextInput
            value={notesDraft}
            onChangeText={(t) => { setNotesDraft(t); setNotesSaved(false); setSaveError(null) }}
            onBlur={handleNoteBlur}
            placeholder="Observations, diagnostic, suivi recommandé…"
            placeholderTextColor="#6f787e"
            multiline
            style={{
              backgroundColor: 'rgba(229,238,255,0.5)',
              borderRadius: 10,
              padding: 12,
              fontSize: 14,
              fontFamily: 'Manrope',
              color: '#0b1c30',
              minHeight: 100,
              textAlignVertical: 'top',
              borderWidth: 1,
              borderColor: saveError ? '#ba1a1a' : 'rgba(190,200,206,0.4)',
            }}
          />
          {/* Save error */}
          {saveError ? (
            <Text style={{ color: '#ba1a1a', fontSize: 12, fontFamily: 'Manrope' }}>
              {saveError}
            </Text>
          ) : null}
          <TouchableOpacity
            onPress={handleSaveNotes}
            disabled={!notesDraft.trim() || isSavingNotes || notesSaved}
            style={{
              borderRadius: 8,
              paddingVertical: 10,
              alignItems: 'center',
              backgroundColor: notesSaved ? 'rgba(29,122,58,0.1)' : 'rgba(0,102,133,0.08)',
              borderWidth: 1,
              borderColor: notesSaved ? '#bbf7d0' : 'rgba(0,102,133,0.2)',
              opacity: !notesDraft.trim() || isSavingNotes ? 0.5 : 1,
            }}
          >
            {isSavingNotes ? (
              <ActivityIndicator color="#82d8ff" size="small" />
            ) : (
              <Text style={{ fontSize: 13, fontFamily: 'Manrope', fontWeight: '600', color: notesSaved ? '#166534' : '#82d8ff' }}>
                {notesSaved ? '✓ Notes enregistrées' : 'Enregistrer les notes'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Prescription download */}
        {prescriptionUrl ? (
          <View style={{ gap: 12, borderRadius: 12, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', backgroundColor: 'rgba(255,255,255,0.60)' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <MaterialIcons name="description" size={18} color="#82d8ff" />
              <Text style={{ fontSize: 12, color: '#82d8ff', fontFamily: 'Manrope', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 'bold' }}>
                Ordonnance
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleDownloadPrescription}
              style={{ backgroundColor: '#82d8ff', borderRadius: 8, paddingVertical: 10, alignItems: 'center' }}
            >
              <Text style={{ color: '#0b1c30', fontSize: 14, fontWeight: '800', fontFamily: 'Manrope' }}>
                Télécharger le PDF
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* CTA */}
        <TouchableOpacity
          onPress={handleAgenda}
          style={{ width: '100%', backgroundColor: '#82d8ff', borderRadius: 9999, paddingVertical: 14, alignItems: 'center', marginTop: 8 }}
        >
          <Text style={{ color: '#0b1c30', fontWeight: '800', fontFamily: 'Manrope', fontSize: 15 }}>
            Retour à l'agenda
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  )
}
