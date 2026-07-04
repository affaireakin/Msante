import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { supabase } from '@/services/supabase'
import { useConsultationStore } from '@/features/consultation/store/consultationStore'
import { useAuthStore } from '@/features/auth/store/authStore'

const STAR_COUNT = 5

export default function ConsultationSummary() {
  const router = useRouter()
  const { aiSummary, durationMin, prescriptionUrl, consultationId, reset } = useConsultationStore()
  const { user } = useAuthStore()

  const [moodScore, setMoodScore] = useState<number>(0)
  const [moodSaved, setMoodSaved] = useState(false)
  const [isSavingMood, setIsSavingMood] = useState(false)
  const [moodError, setMoodError] = useState<string | null>(null)

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
      // ignore
    }
  }

  /** Save star rating (1-5) as mood entry scaled to 1-10 */
  const handleMoodSelect = async (star: number) => {
    if (moodSaved || !user) return
    setMoodScore(star)
    setIsSavingMood(true)
    setMoodError(null)
    try {
      // Scale 1-5 stars → 2-10 (even multiples) for mood_entries score
      const scaledScore = star * 2
      const { error } = await supabase.from('mood_entries').insert({
        patient_id: user.id,
        score: scaledScore,
        note: 'Post-consultation',
        entry_date: new Date().toISOString().slice(0, 10),
      })
      if (error) throw error
      setMoodSaved(true)
    } catch (e) {
      setMoodError(e instanceof Error ? e.message : 'Erreur lors de l\'enregistrement')
    } finally {
      setIsSavingMood(false)
    }
  }

  const handleRebook = () => {
    reset()
    router.push('/(patient)/find-practitioners')
  }

  const handleHome = () => {
    reset()
    router.replace('/(patient)/home')
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }}>

        {/* Success icon */}
        <View style={{ alignItems: 'center', paddingVertical: 24, gap: 12 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(29,122,58,0.1)' }}>
            <MaterialIcons name="check-circle" size={44} color="#1d7a3a" />
          </View>
          <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#0b1c30', fontFamily: 'Manrope', textAlign: 'center' }}>
            Consultation terminée
          </Text>
          <Text style={{ fontSize: 14, color: '#6f787e', fontFamily: 'Manrope', textAlign: 'center' }}>
            Merci pour votre confiance
          </Text>
        </View>

        {/* Session stats */}
        <View style={{ gap: 12, borderRadius: 12, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', backgroundColor: 'rgba(255,255,255,0.80)' }}>
          <Text style={{ fontSize: 12, color: '#82d8ff', fontFamily: 'Manrope', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 'bold', marginBottom: 4 }}>
            Résumé de la session
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MaterialIcons name="schedule" size={14} color="#6f787e" />
              <Text style={{ fontSize: 14, color: '#6f787e', fontFamily: 'Manrope' }}>Durée</Text>
            </View>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#0b1c30', fontFamily: 'Manrope' }}>
              {durationMin != null ? `${durationMin} min` : '—'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MaterialIcons name="videocam" size={14} color="#6f787e" />
              <Text style={{ fontSize: 14, color: '#6f787e', fontFamily: 'Manrope' }}>Type</Text>
            </View>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#0b1c30', fontFamily: 'Manrope' }}>
              Vidéo
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
          <View style={{ gap: 12, borderRadius: 12, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', backgroundColor: 'rgba(255,255,255,0.80)' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <MaterialIcons name="psychology" size={18} color="#82d8ff" />
              <Text style={{ fontSize: 12, color: '#82d8ff', fontFamily: 'Manrope', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 'bold' }}>
                Résumé IA
              </Text>
            </View>
            <Text style={{ fontSize: 14, color: '#0b1c30', fontFamily: 'Manrope', lineHeight: 22 }}>
              {aiSummary}
            </Text>
            <Text style={{ fontSize: 10, color: '#6f787e', fontFamily: 'Manrope', fontStyle: 'italic', marginTop: 4 }}>
              Ce résumé ne remplace pas les conseils de votre médecin.
            </Text>
          </View>
        ) : (
          <View style={{ alignItems: 'center', paddingVertical: 16, gap: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', backgroundColor: 'rgba(255,255,255,0.80)' }}>
            <ActivityIndicator color="#82d8ff" />
            <Text style={{ fontSize: 14, color: '#6f787e', fontFamily: 'Manrope' }}>Génération du résumé…</Text>
          </View>
        )}

        {/* Post-session mood check-in */}
        <View style={{ gap: 12, borderRadius: 12, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', backgroundColor: 'rgba(255,255,255,0.80)' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <MaterialIcons name="mood" size={18} color="#82d8ff" />
            <Text style={{ fontSize: 12, color: '#82d8ff', fontFamily: 'Manrope', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 'bold' }}>
              Comment vous sentez-vous ?
            </Text>
          </View>
          <Text style={{ fontSize: 13, color: '#6f787e', fontFamily: 'Manrope' }}>
            Évaluez votre humeur après cette séance
          </Text>

          {/* 5-star rating */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, paddingVertical: 8 }}>
            {Array.from({ length: STAR_COUNT }, (_, i) => i + 1).map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => handleMoodSelect(star)}
                disabled={moodSaved || isSavingMood}
                style={{ opacity: moodSaved || isSavingMood ? 0.7 : 1 }}
              >
                <MaterialIcons
                  name={star <= moodScore ? 'star' : 'star-border'}
                  size={36}
                  color={star <= moodScore ? '#ffde5c' : '#bec8ce'}
                />
              </TouchableOpacity>
            ))}
          </View>

          {isSavingMood ? (
            <ActivityIndicator color="#82d8ff" size="small" />
          ) : moodSaved ? (
            <Text style={{ textAlign: 'center', fontSize: 13, color: '#1d7a3a', fontFamily: 'Manrope', fontWeight: '600' }}>
              ✓ Humeur enregistrée
            </Text>
          ) : null}

          {moodError ? (
            <Text style={{ color: '#ba1a1a', fontSize: 12, fontFamily: 'Manrope', textAlign: 'center' }}>
              {moodError}
            </Text>
          ) : null}
        </View>

        {/* Prescription */}
        {prescriptionUrl ? (
          <View style={{ gap: 12, borderRadius: 12, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', backgroundColor: 'rgba(255,255,255,0.80)' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <MaterialIcons name="description" size={18} color="#82d8ff" />
              <Text style={{ fontSize: 12, color: '#82d8ff', fontFamily: 'Manrope', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 'bold' }}>
                Ordonnance
              </Text>
            </View>
            <Text style={{ fontSize: 14, color: '#6f787e', fontFamily: 'Manrope' }}>
              Votre praticien a joint une ordonnance.
            </Text>
            <TouchableOpacity
              onPress={handleDownloadPrescription}
              style={{ backgroundColor: '#82d8ff', borderRadius: 8, paddingVertical: 10, alignItems: 'center' }}
            >
              <Text style={{ color: '#0b1c30', fontSize: 14, fontWeight: '700', fontFamily: 'Manrope' }}>
                Télécharger le PDF
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Actions */}
        <View style={{ gap: 12, marginTop: 8 }}>
          <TouchableOpacity
            onPress={handleRebook}
            style={{ width: '100%', borderWidth: 1, borderColor: '#82d8ff', borderRadius: 9999, paddingVertical: 14, alignItems: 'center' }}
          >
            <Text style={{ color: '#82d8ff', fontWeight: '600', fontFamily: 'Manrope' }}>
              Reprendre rendez-vous
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleHome}
            style={{ width: '100%', backgroundColor: '#82d8ff', borderRadius: 9999, paddingVertical: 14, alignItems: 'center' }}
          >
            <Text style={{ color: '#0b1c30', fontWeight: '800', fontFamily: 'Manrope' }}>
              Retour à l'accueil
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}
