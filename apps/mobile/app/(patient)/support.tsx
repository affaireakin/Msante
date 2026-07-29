import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'

type IconName = React.ComponentProps<typeof MaterialIcons>['name']

const EMERGENCY_CONTACTS = [
  { label: 'SAMU Sénégal', number: '15', icon: 'local-hospital' as IconName, color: '#ba1a1a', bg: '#ffdad6' },
  { label: 'SOS Amitié', number: '+221 33 823 8020', icon: 'support-agent' as IconName, color: '#82d8ff', bg: '#e5eeff' },
  { label: 'Police', number: '17', icon: 'local-police' as IconName, color: '#705d00', bg: '#fff8e1' },
]

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Comment prendre un rendez-vous ?',
    a: 'Depuis l\'accueil, appuyez sur "Trouver un praticien", choisissez un professionnel, sélectionnez un créneau disponible et procédez au paiement.',
  },
  {
    q: 'Quels moyens de paiement sont acceptés ?',
    a: 'Wave, Orange Money et carte bancaire sont acceptés. Le paiement est sécurisé et chiffré.',
  },
  {
    q: 'Comment annuler un rendez-vous ?',
    a: 'Depuis la section "Rendez-vous", appuyez sur le RDV concerné et sélectionnez "Annuler". L\'annulation est gratuite jusqu\'à 24h avant.',
  },
  {
    q: 'Mes données sont-elles confidentielles ?',
    a: 'Oui. Toutes vos données de santé sont chiffrées et accessibles uniquement par vous et votre praticien. M-Santé ne les partage jamais avec des tiers.',
  },
  {
    q: 'Comment fonctionne la téléconsultation ?',
    a: 'La consultation se fait via vidéo sécurisée directement dans l\'application. Assurez-vous d\'avoir une bonne connexion internet et un endroit calme.',
  },
  {
    q: 'Que faire si mon paiement a échoué ?',
    a: 'Vérifiez votre solde Wave/Orange Money et réessayez. En cas de problème persistant, contactez le support à support@msante.app.',
  },
]

const CONTACT_CHANNELS = [
  { label: 'Email support', value: 'support@msante.app', icon: 'email' as IconName, action: 'email' },
  { label: 'WhatsApp', value: '+221 78 000 00 00', icon: 'chat' as IconName, action: 'whatsapp' },
]

export default function SupportScreen() {
  const router = useRouter()
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const handleCall = (number: string) => {
    Linking.openURL(`tel:${number}`).catch(() =>
      Alert.alert('Impossible d\'ouvrir le téléphone')
    )
  }

  const handleContact = (channel: typeof CONTACT_CHANNELS[0]) => {
    if (channel.action === 'email') {
      Linking.openURL(`mailto:${channel.value}`).catch(() =>
        Alert.alert('Impossible d\'ouvrir la messagerie')
      )
    } else {
      Linking.openURL(`https://wa.me/${channel.value.replace(/\s+/g, '')}`).catch(() =>
        Alert.alert('Impossible d\'ouvrir WhatsApp')
      )
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 28 }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope' }}>
            Aide & Support
          </Text>
          <Text style={{ fontSize: 14, color: '#6f787e', fontFamily: 'Manrope' }}>
            Urgences, FAQ et contact
          </Text>
        </View>

        {/* Emergency banner */}
        <View style={{ backgroundColor: '#ffdad6', borderRadius: 16, padding: 16, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <MaterialIcons name="emergency" size={20} color="#ba1a1a" />
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#ba1a1a', fontFamily: 'Manrope', textTransform: 'uppercase', letterSpacing: 1 }}>
              En cas d'urgence
            </Text>
          </View>
          {EMERGENCY_CONTACTS.map(c => (
            <TouchableOpacity
              key={c.label}
              onPress={() => handleCall(c.number)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 12,
                backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 12, padding: 12,
              }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcons name={c.icon} size={20} color={c.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope' }}>{c.label}</Text>
                <Text style={{ fontSize: 14, fontWeight: '800', color: c.color, fontFamily: 'Manrope' }}>{c.number}</Text>
              </View>
              <MaterialIcons name="call" size={18} color={c.color} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Messages praticiens */}
        <TouchableOpacity
          onPress={() => router.push('/(patient)/messages')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: 'rgba(255,255,255,0.70)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.80)', padding: 16 }}
        >
          <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}>
            <MaterialIcons name="chat-bubble-outline" size={24} color="#82d8ff" />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope' }}>Messagerie sécurisée</Text>
            <Text style={{ fontSize: 12, color: '#6f787e', fontFamily: 'Manrope' }}>Échangez avec vos praticiens</Text>
          </View>
          <MaterialIcons name="arrow-forward-ios" size={16} color="#82d8ff" />
        </TouchableOpacity>

        {/* Litiges */}
        <TouchableOpacity
          onPress={() => router.push('/(patient)/disputes')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: 'rgba(255,255,255,0.70)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.80)', padding: 16 }}
        >
          <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: '#fff8e1', alignItems: 'center', justifyContent: 'center' }}>
            <MaterialIcons name="gavel" size={24} color="#705d00" />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope' }}>Litiges & réclamations</Text>
            <Text style={{ fontSize: 12, color: '#6f787e', fontFamily: 'Manrope' }}>Signalez un problème avec une consultation</Text>
          </View>
          <MaterialIcons name="arrow-forward-ios" size={16} color="#705d00" />
        </TouchableOpacity>

        {/* FAQ */}
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: '#82d8ff', fontFamily: 'Manrope', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
            Questions fréquentes
          </Text>
          {FAQ.map((item, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => setOpenFaq(openFaq === i ? null : i)}
              style={{
                backgroundColor: 'rgba(255,255,255,0.70)',
                borderRadius: 14,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.80)',
                overflow: 'hidden',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}>
                <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: '#0b1c30', fontFamily: 'Manrope' }}>
                  {item.q}
                </Text>
                <MaterialIcons
                  name={openFaq === i ? 'expand-less' : 'expand-more'}
                  size={20}
                  color="#6f787e"
                />
              </View>
              {openFaq === i && (
                <View style={{ paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: '#e5eeff' }}>
                  <Text style={{ fontSize: 14, color: '#3f484d', fontFamily: 'Manrope', lineHeight: 22, paddingTop: 12 }}>
                    {item.a}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Contact support */}
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: '#82d8ff', fontFamily: 'Manrope', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
            Contacter le support
          </Text>
          {CONTACT_CHANNELS.map(c => (
            <TouchableOpacity
              key={c.label}
              onPress={() => handleContact(c)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 12,
                backgroundColor: 'rgba(255,255,255,0.70)', borderRadius: 14,
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.80)', padding: 14,
              }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcons name={c.icon} size={20} color="#82d8ff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: '#6f787e', fontFamily: 'Manrope' }}>{c.label}</Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#0b1c30', fontFamily: 'Manrope' }}>{c.value}</Text>
              </View>
              <MaterialIcons name="arrow-forward-ios" size={14} color="#bec8ce" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Disclaimer */}
        <View style={{ backgroundColor: 'rgba(229,238,255,0.50)', borderRadius: 12, padding: 14, gap: 6 }}>
          <Text style={{ fontSize: 11, color: '#3f484d', fontFamily: 'Manrope', lineHeight: 18, textAlign: 'center' }}>
            M-Santé est un outil de soutien et ne remplace pas un professionnel de santé.
            En cas de détresse sévère, appelez immédiatement le{' '}
            <Text style={{ fontWeight: '800', color: '#ba1a1a' }}>15</Text>.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}
