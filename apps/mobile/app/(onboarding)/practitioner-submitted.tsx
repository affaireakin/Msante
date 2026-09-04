import { View, Text, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'

// Même carte/ton que la confirmation web (onboarding/practitioner step 4 et
// onboarding/organization) — affichée une seule fois après la soumission,
// remplace l'ancien comportement où l'app redirigeait silencieusement vers
// le tableau de bord sans aucun accusé de réception.
export default function PractitionerSubmittedScreen() {
  const router = useRouter()

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <MaterialIcons name="check-circle" size={40} color="#82d8ff" />
        </View>
        <Text style={{ fontFamily: 'Manrope', fontSize: 22, fontWeight: '800', color: '#0b1c30', textAlign: 'center', marginBottom: 10 }}>
          Documents reçus
        </Text>
        <Text style={{ fontFamily: 'Manrope', fontSize: 14, color: '#6f787e', textAlign: 'center', lineHeight: 21, marginBottom: 32 }}>
          Nous avons bien reçu vos documents. Merci pour votre envoi. Nous allons les analyser et reviendrons vers vous dans les meilleurs délais.{'\n\n'}Vous serez informé(e) dès que l&apos;analyse sera terminée.
        </Text>
        <TouchableOpacity
          onPress={() => router.replace('/(practitioner)/')}
          style={{ width: '100%', paddingVertical: 16, borderRadius: 999, alignItems: 'center', backgroundColor: '#82d8ff' }}
        >
          <Text style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: '800', color: '#0b1c30' }}>Accéder à mon espace</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}
