import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'

const SECTIONS = [
  {
    title: '1. Objet',
    body: "Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et l'utilisation de la plateforme M-Santé, application de mise en relation entre patients et professionnels de santé ou praticiens bien-être, ainsi que ses outils de suivi du bien-être émotionnel.",
  },
  {
    title: '2. Acceptation des CGU',
    body: "En créant un compte sur M-Santé, vous acceptez sans réserve les présentes CGU. Si vous n'acceptez pas ces conditions, vous ne pouvez pas utiliser la plateforme.",
  },
  {
    title: '3. Description du service',
    body: "M-Santé propose : la mise en relation avec des praticiens certifiés, la téléconsultation vidéo/audio chiffrée, le suivi de l'humeur et le journal émotionnel, l'assistant bien-être Mounima (non médical), et la gestion des rendez-vous et paiements.\n\nM-Santé ne fournit pas de diagnostic médical et ne remplace en aucun cas un professionnel de santé.",
  },
  {
    title: '4. Données personnelles',
    body: "Vos données sont collectées et traitées conformément au RGPD et à la loi sénégalaise sur la protection des données personnelles. Les données médicales et émotionnelles sont chiffrées et accessibles uniquement par vous et les praticiens que vous consultez.",
  },
  {
    title: '5. Responsabilités',
    body: "M-Santé agit en tant qu'intermédiaire et ne peut être tenu responsable des actes ou omissions des praticiens. Chaque praticien est seul responsable de la qualité et du contenu de ses consultations.",
  },
  {
    title: '6. Propriété intellectuelle',
    body: "Tous les éléments de la plateforme (design, code, contenus) sont la propriété exclusive de M-Santé / AUTOMATISE. Toute reproduction non autorisée est interdite.",
  },
  {
    title: '7. Résiliation',
    body: "Vous pouvez supprimer votre compte à tout moment depuis les paramètres. M-Santé se réserve le droit de suspendre ou de résilier un compte en cas de violation des présentes CGU.",
  },
  {
    title: '8. Contact',
    body: "Pour toute question relative aux CGU : support@m-sante.com",
  },
]

export default function CguScreen() {
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
            <MaterialIcons name="arrow-back" size={20} color="#006685" />
            <Text style={{ fontSize: 14, color: '#006685', fontFamily: 'Manrope', fontWeight: '600' }}>Retour</Text>
          </TouchableOpacity>

          <Text style={{ fontSize: 24, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope', letterSpacing: -0.5, marginBottom: 4 }}>
            Conditions Générales d'Utilisation
          </Text>
          <Text style={{ fontSize: 13, color: '#6f787e', fontFamily: 'Manrope' }}>
            Dernière mise à jour : Juin 2026
          </Text>
        </View>

        {SECTIONS.map(section => (
          <View key={section.title} style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#006685', fontFamily: 'Manrope', marginBottom: 6 }}>
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
