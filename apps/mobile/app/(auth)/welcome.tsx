import { View, Text, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { PrimaryButton } from '@/components/ui'

export default function WelcomeScreen() {
  const router = useRouter()

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: 'space-between', paddingTop: 24, paddingBottom: 32 }}>

        {/* ── Logo ── */}
        <View style={{ alignItems: 'center', paddingTop: 40 }}>
          {/* icon.png est l'icône de lancement Android — fond carré bleu
              opaque intégré à l'image (attendu pour un icône d'app), mais
              rendait ici un carré bleu autour du logo ("couleur bleue qui le
              recouvre"). logo-mark.png est le M seul, fond transparent. */}
          <Image
            source={require('@/assets/logo-mark.png')}
            style={{ width: 96, height: 96 }}
            resizeMode="contain"
          />
          <Text style={{ fontSize: 13, color: '#6f787e', fontFamily: 'Manrope', fontWeight: '600', marginTop: 10, letterSpacing: 0.5 }}>
            MIND · CARE · CONNECT
          </Text>
        </View>

        {/* ── Hero ── */}
        <View style={{ alignItems: 'center', gap: 12 }}>
          <Text style={{
            fontSize: 32, fontWeight: '800', color: '#0b1c30',
            fontFamily: 'Manrope', textAlign: 'center', letterSpacing: -0.8, lineHeight: 40,
          }}>
            Votre santé mentale,{'\n'}notre priorité.
          </Text>
          <Text style={{
            fontSize: 15, color: '#6f787e', fontFamily: 'Manrope',
            textAlign: 'center', lineHeight: 24, paddingHorizontal: 8,
          }}>
            Connectez-vous à des praticiens certifiés au Sénégal et en Afrique francophone.
          </Text>
        </View>

        {/* ── CTA ── */}
        <View style={{ gap: 12 }}>
          <PrimaryButton
            label="Inscription"
            onPress={() => router.push('/(auth)/signup-profile')}
          />
          <PrimaryButton
            label="Connexion"
            onPress={() => router.push('/(auth)/login')}
            variant="outline"
          />
        </View>

      </View>
    </SafeAreaView>
  )
}
