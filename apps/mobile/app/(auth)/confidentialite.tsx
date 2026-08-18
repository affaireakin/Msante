import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'

const SECTIONS = [
  {
    title: 'Données collectées',
    body: "M-Santé collecte les données nécessaires à la fourniture du service : informations de profil, données de rendez-vous, et pour les patients, des données de santé sensibles (humeur, journal, antécédents) traitées avec un niveau de confidentialité renforcé.",
  },
  {
    title: 'Utilisation des données',
    body: "Vos données ne sont jamais vendues ni transmises à des tiers à des fins commerciales. Elles sont utilisées uniquement pour vous fournir le service et, avec votre consentement explicite, partagées avec le praticien que vous consultez.",
  },
  {
    title: 'Vos droits',
    body: "Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, de portabilité et de suppression de vos données. Contactez privacy@m-sante.com pour exercer ces droits.",
  },
]

export default function ConfidentialiteScreen() {
  const router = useRouter()

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ marginTop: 40, marginBottom: 28 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20, alignSelf: 'flex-start' }}
          >
            <MaterialIcons name="arrow-back" size={20} color="#82d8ff" />
            <Text style={{ fontSize: 14, color: '#82d8ff', fontFamily: 'Manrope', fontWeight: '600' }}>Retour</Text>
          </TouchableOpacity>

          <Text style={{ fontSize: 24, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope', letterSpacing: -0.5, marginBottom: 4 }}>
            Politique de confidentialité
          </Text>
          <Text style={{ fontSize: 13, color: '#6f787e', fontFamily: 'Manrope' }}>
            Traitement de vos données personnelles
          </Text>
        </View>

        {SECTIONS.map(section => (
          <View key={section.title} style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#82d8ff', fontFamily: 'Manrope', marginBottom: 6 }}>
              {section.title}
            </Text>
            <Text style={{ fontSize: 13, color: '#3f484d', fontFamily: 'Manrope', lineHeight: 22 }}>
              {section.body}
            </Text>
          </View>
        ))}

        <View style={{ height: 1, backgroundColor: '#e5eeff', marginBottom: 20 }} />
        <Text style={{ fontSize: 12, color: '#6f787e', fontFamily: 'Manrope', textAlign: 'center', lineHeight: 18 }}>
          © 2026 M-Santé / AUTOMATISE · Tous droits réservés
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}
