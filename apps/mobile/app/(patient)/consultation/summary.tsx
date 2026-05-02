import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
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
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }}>
        {/* Icône succès */}
        <View className="items-center py-6 gap-3">
          <View className="w-20 h-20 rounded-full items-center justify-center" style={{ backgroundColor: 'rgba(29,122,58,0.1)' }}>
            <Text style={{ fontSize: 40 }}>✅</Text>
          </View>
          <Text className="text-2xl font-bold text-on-surface font-manrope text-center">Consultation terminée</Text>
          <Text className="text-sm text-outline font-manrope text-center">Merci pour votre confiance</Text>
        </View>

        {/* Card infos session */}
        <View
          className="gap-3 rounded-xl p-5 border border-white/50"
          style={{ backgroundColor: 'rgba(255,255,255,0.60)', backdropFilter: 'blur(16px)' }}
        >
          <Text className="text-xs text-primary font-manrope uppercase tracking-widest font-bold mb-1">Résumé de la session</Text>
          <View className="flex-row justify-between items-center">
            <Text className="text-sm text-outline font-manrope">⏱ Durée</Text>
            <Text className="text-sm font-semibold text-on-surface font-manrope">{durationMin ?? '—'} min</Text>
          </View>
          <View className="flex-row justify-between items-center">
            <Text className="text-sm text-outline font-manrope">📅 Date</Text>
            <Text className="text-sm font-semibold text-on-surface font-manrope">
              {new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </Text>
          </View>
        </View>

        {/* Card IA résumé */}
        {aiSummary ? (
          <View
            className="gap-3 rounded-xl p-5 border border-white/50"
            style={{ backgroundColor: 'rgba(255,255,255,0.60)' }}
          >
            <View className="flex-row items-center gap-2 mb-1">
              <Text style={{ fontSize: 16 }}>🤖</Text>
              <Text className="text-xs text-primary font-manrope uppercase tracking-widest font-bold">Résumé IA</Text>
            </View>
            <Text className="text-sm text-on-surface font-manrope leading-relaxed">{aiSummary}</Text>
            <Text className="text-[10px] text-outline font-manrope italic mt-1">
              Ce résumé ne remplace pas les conseils de votre médecin.
            </Text>
          </View>
        ) : (
          <View
            className="items-center py-4 gap-2 rounded-xl border border-white/50"
            style={{ backgroundColor: 'rgba(255,255,255,0.60)' }}
          >
            <ActivityIndicator color="#006685" />
            <Text className="text-sm text-outline font-manrope">Génération du résumé…</Text>
          </View>
        )}

        {/* Card ordonnance */}
        {prescriptionUrl && (
          <View
            className="gap-3 rounded-xl p-5 border border-white/50"
            style={{ backgroundColor: 'rgba(255,255,255,0.60)' }}
          >
            <View className="flex-row items-center gap-2 mb-1">
              <Text style={{ fontSize: 16 }}>📋</Text>
              <Text className="text-xs text-primary font-manrope uppercase tracking-widest font-bold">Ordonnance</Text>
            </View>
            <Text className="text-sm text-outline font-manrope">Votre praticien a joint une ordonnance.</Text>
            <TouchableOpacity
              onPress={handleDownloadPrescription}
              className="bg-primary rounded-lg py-2.5 items-center"
            >
              <Text className="text-white text-sm font-semibold font-manrope">Télécharger le PDF</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Actions */}
        <View className="gap-3 mt-2">
          <TouchableOpacity
            onPress={handleRebook}
            className="w-full border border-primary rounded-full py-3.5 items-center"
          >
            <Text className="text-primary font-semibold font-manrope">Reprendre rendez-vous</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleHome}
            className="w-full bg-primary rounded-full py-3.5 items-center"
          >
            <Text className="text-white font-semibold font-manrope">Retour à l'accueil</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
