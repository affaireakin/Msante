import { View, Text, TouchableOpacity, ImageBackground } from 'react-native'
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{
              width: 52, height: 52, borderRadius: 16,
              backgroundColor: '#006685',
              alignItems: 'center', justifyContent: 'center',
              shadowColor: '#006685', shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
            }}>
              <MaterialIcons name="medical-services" size={28} color="#fff" />
            </View>
            <View>
              <Text style={{ fontSize: 26, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope', letterSpacing: -0.5 }}>
                M-Santé
              </Text>
              <Text style={{ fontSize: 12, color: '#6f787e', fontFamily: 'Manrope', fontWeight: '500' }}>
                Health Sanctuary
              </Text>
            </View>
          </View>
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
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#006685', fontFamily: 'Manrope', letterSpacing: 0.5 }}>
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
                shadowColor: '#006685', shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
              }}>
                <MaterialIcons name={f.icon} size={14} color="#006685" />
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
            onPress={() => router.push('/(auth)/signup-practitioner')}
            variant="outline"
          />
          <TouchableOpacity onPress={() => router.push('/(auth)/login')} style={{ paddingVertical: 8 }}>
            <Text style={{ textAlign: 'center', fontSize: 14, color: '#6f787e', fontFamily: 'Manrope' }}>
              Déjà un compte ?{' '}
              <Text style={{ color: '#006685', fontWeight: '700' }}>Se connecter</Text>
            </Text>
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  )
}
