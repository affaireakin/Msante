import { View, Text, TouchableOpacity, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'

const PROFILES: {
  value: 'patient' | 'practitioner' | 'organization'
  label: string
  desc: string
  icon: React.ComponentProps<typeof MaterialIcons>['name']
  route: string
}[] = [
  { value: 'patient',      label: 'Patient',      desc: '', icon: 'person',            route: '/(auth)/signup-patient' },
  { value: 'practitioner', label: 'Praticien',     desc: '', icon: 'medical-services',  route: '/(auth)/practitioner-type' },
  { value: 'organization', label: 'Organisation',  desc: '(Cabinet, clinique, hôpitaux)', icon: 'business', route: '/(auth)/signup-organization' },
]

export default function SignupProfileScreen() {
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
            <Text style={{ fontSize: 14, color: '#82d8ff', fontFamily: 'Manrope', fontWeight: '600' }}>
              Retour
            </Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 28, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope', letterSpacing: -0.5, marginBottom: 6 }}>
            Inscription
          </Text>
          <Text style={{ fontSize: 14, color: '#6f787e', fontFamily: 'Manrope' }}>
            Quel est votre profil ?
          </Text>
        </View>

        {/* Profile cards */}
        <View style={{ gap: 12 }}>
          {PROFILES.map(p => (
            <TouchableOpacity
              key={p.value}
              onPress={() => router.push(p.route as never)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                padding: 16,
                borderRadius: 16,
                borderWidth: 1.5,
                borderColor: '#e5eeff',
                backgroundColor: 'rgba(255,255,255,0.70)',
              }}
            >
              <View style={{
                width: 44, height: 44, borderRadius: 14,
                backgroundColor: 'rgba(130,216,255,0.15)',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <MaterialIcons name={p.icon} size={22} color="#82d8ff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope' }}>
                  {p.label}
                </Text>
                {!!p.desc && (
                  <Text style={{ fontSize: 12, color: '#6f787e', fontFamily: 'Manrope', marginTop: 2, lineHeight: 17 }}>
                    {p.desc}
                  </Text>
                )}
              </View>
              <MaterialIcons name="chevron-right" size={22} color="#bec8ce" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Lien connexion */}
        <TouchableOpacity
          onPress={() => router.push('/(auth)/login')}
          style={{ paddingVertical: 20 }}
        >
          <Text style={{ textAlign: 'center', fontSize: 14, color: '#6f787e', fontFamily: 'Manrope' }}>
            Déjà un compte ?{' '}
            <Text style={{ color: '#82d8ff', fontWeight: '700' }}>Se connecter</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}
