import { View, Text, TouchableOpacity, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { PrimaryButton } from '@/components/ui'

const FEATURES = [
  { icon: 'psychology' as const, label: 'IA Bien-être' },
  { icon: 'medical-services' as const, label: '500+ praticiens' },
  { icon: 'videocam' as const, label: 'Téléconsultation' },
]

export default function WelcomeScreen() {
  const router = useRouter()

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: 'space-between', paddingTop: 24, paddingBottom: 32 }}>

        {/* ── Logo ── */}
        <View style={{ alignItems: 'center', paddingTop: 16 }}>
          <Image
            source={require('@/assets/icon.png')}
            style={{ width: 90, height: 90, borderRadius: 22 }}
            resizeMode="cover"
          />
          <Text style={{ fontSize: 13, color: '#6f787e', fontFamily: 'Manrope', fontWeight: '600', marginTop: 8, letterSpacing: 0.5 }}>
            Health Sanctuary
          </Text>
        </View>

        {/* ── Hero ── */}
        <View style={{ alignItems: 'center', gap: 16 }}>
          {/* Badge */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 6,
            backgroundColor: '#e5eeff', borderRadius: 20,
            paddingHorizontal: 14, paddingVertical: 6,
            borderWidth: 1, borderColor: '#82d8ff',
          }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ade80' }} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#82d8ff', fontFamily: 'Manrope', letterSpacing: 0.5 }}>
              98% SATISFACTION PATIENT
            </Text>
          </View>

          <Text style={{
            fontSize: 36, fontWeight: '800', color: '#0b1c30',
            fontFamily: 'Manrope', textAlign: 'center', letterSpacing: -0.8, lineHeight: 44,
          }}>
            Votre santé mentale,{'\n'}notre priorité.
          </Text>

          <Text style={{
            fontSize: 15, color: '#6f787e', fontFamily: 'Manrope',
            textAlign: 'center', lineHeight: 24, paddingHorizontal: 8,
          }}>
            Connectez-vous à des praticiens certifiés au Sénégal et en Afrique francophone.
          </Text>

          {/* Feature pills */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            {FEATURES.map(f => (
              <View key={f.label} style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                backgroundColor: '#fff', borderRadius: 20,
                paddingHorizontal: 12, paddingVertical: 8,
                borderWidth: 1, borderColor: '#e5eeff',
                shadowColor: '#82d8ff', shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
              }}>
                <MaterialIcons name={f.icon} size={14} color="#82d8ff" />
                <Text style={{ fontSize: 11, fontWeight: '600', color: '#0b1c30', fontFamily: 'Manrope' }}>
                  {f.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── CTA ── */}
        <View style={{ gap: 12 }}>
          <PrimaryButton
            label="Je suis patient"
            onPress={() => router.push('/(auth)/signup-patient')}
          />
          <PrimaryButton
            label="Je suis praticien"
            onPress={() => router.push('/(auth)/practitioner-type')}
            variant="outline"
          />
          <TouchableOpacity onPress={() => router.push('/(auth)/signup-organization')} style={{ paddingVertical: 4 }}>
            <Text style={{ textAlign: 'center', fontSize: 13, color: '#6f787e', fontFamily: 'Manrope' }}>
              Je représente une organisation{' '}
              <Text style={{ color: '#82d8ff', fontWeight: '700' }}>Créer un compte</Text>
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/(auth)/login')} style={{ paddingVertical: 8 }}>
            <Text style={{ textAlign: 'center', fontSize: 14, color: '#6f787e', fontFamily: 'Manrope' }}>
              Déjà un compte ?{' '}
              <Text style={{ color: '#82d8ff', fontWeight: '700' }}>Se connecter</Text>
            </Text>
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  )
}
