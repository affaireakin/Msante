import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { supabase } from '@/services/supabase'
import { useConsultationStore } from '@/features/consultation/store/consultationStore'

export default function ConsultationSummary() {
  const router = useRouter()
  const { aiSummary, durationMin, prescriptionUrl, consultationId, reset } = useConsultationStore()

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

  const handleRebook = () => {
    reset()
    router.back()
  }

  const handleHome = () => {
    reset()
    router.replace('/(patient)/home')
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }}>
        {/* Icône succès */}
        <View style={{ alignItems: 'center', paddingVertical: 24, gap: 12 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(29,122,58,0.1)' }}>
            <MaterialIcons name="check-circle" size={44} color="#1d7a3a" />
          </View>
          <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#0b1c30', fontFamily: 'Manrope', textAlign: 'center' }}>Consultation terminée</Text>
          <Text style={{ fontSize: 14, color: '#6f787e', fontFamily: 'Manrope', textAlign: 'center' }}>Merci pour votre confiance</Text>
        </View>

        {/* Card infos session */}
        <View style={{ gap: 12, borderRadius: 12, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', backgroundColor: 'rgba(255,255,255,0.60)' }}>
          <Text style={{ fontSize: 12, color: '#006685', fontFamily: 'Manrope', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 'bold', marginBottom: 4 }}>Résumé de la session</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MaterialIcons name="schedule" size={14} color="#6f787e" />
              <Text style={{ fontSize: 14, color: '#6f787e', fontFamily: 'Manrope' }}>Durée</Text>
            </View>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#0b1c30', fontFamily: 'Manrope' }}>{durationMin ?? '—'} min</Text>
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

        {/* Card IA résumé */}
        {aiSummary ? (
          <View style={{ gap: 12, borderRadius: 12, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', backgroundColor: 'rgba(255,255,255,0.60)' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <MaterialIcons name="psychology" size={18} color="#006685" />
              <Text style={{ fontSize: 12, color: '#006685', fontFamily: 'Manrope', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 'bold' }}>Résumé IA</Text>
            </View>
            <Text style={{ fontSize: 14, color: '#0b1c30', fontFamily: 'Manrope', lineHeight: 22 }}>{aiSummary}</Text>
            <Text style={{ fontSize: 10, color: '#6f787e', fontFamily: 'Manrope', fontStyle: 'italic', marginTop: 4 }}>
              Ce résumé ne remplace pas les conseils de votre médecin.
            </Text>
          </View>
        ) : (
          <View style={{ alignItems: 'center', paddingVertical: 16, gap: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', backgroundColor: 'rgba(255,255,255,0.60)' }}>
            <ActivityIndicator color="#006685" />
            <Text style={{ fontSize: 14, color: '#6f787e', fontFamily: 'Manrope' }}>Génération du résumé…</Text>
          </View>
        )}

        {/* Card ordonnance */}
        {prescriptionUrl && (
          <View style={{ gap: 12, borderRadius: 12, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', backgroundColor: 'rgba(255,255,255,0.60)' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <MaterialIcons name="description" size={18} color="#006685" />
              <Text style={{ fontSize: 12, color: '#006685', fontFamily: 'Manrope', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 'bold' }}>Ordonnance</Text>
            </View>
            <Text style={{ fontSize: 14, color: '#6f787e', fontFamily: 'Manrope' }}>Votre praticien a joint une ordonnance.</Text>
            <TouchableOpacity
              onPress={handleDownloadPrescription}
              style={{ backgroundColor: '#006685', borderRadius: 8, paddingVertical: 10, alignItems: 'center' }}
            >
              <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '600', fontFamily: 'Manrope' }}>Télécharger le PDF</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Actions */}
        <View style={{ gap: 12, marginTop: 8 }}>
          <TouchableOpacity
            onPress={handleRebook}
            style={{ width: '100%', borderWidth: 1, borderColor: '#006685', borderRadius: 9999, paddingVertical: 14, alignItems: 'center' }}
          >
            <Text style={{ color: '#006685', fontWeight: '600', fontFamily: 'Manrope' }}>Reprendre rendez-vous</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleHome}
            style={{ width: '100%', backgroundColor: '#006685', borderRadius: 9999, paddingVertical: 14, alignItems: 'center' }}
          >
            <Text style={{ color: '#ffffff', fontWeight: '600', fontFamily: 'Manrope' }}>Retour à l'accueil</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
