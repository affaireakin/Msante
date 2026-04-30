import { View, Text, TouchableOpacity, SafeAreaView } from 'react-native'
import { useRouter } from 'expo-router'
import { PrimaryButton } from '@/components/ui'

export default function WelcomeScreen() {
  const router = useRouter()

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-6 justify-between pb-8 pt-16">
        {/* Logo */}
        <View className="items-center">
          <View className="flex-row items-center gap-3">
            <View className="w-12 h-12 bg-primary rounded-xl items-center justify-center">
              <Text className="text-white text-2xl">⚕</Text>
            </View>
            <View>
              <Text className="text-2xl font-black tracking-tight text-on-surface font-manrope">
                M-Santé
              </Text>
              <Text className="text-xs text-outline font-medium font-manrope">
                Health Sanctuary
              </Text>
            </View>
          </View>
        </View>

        {/* Tagline */}
        <View className="items-center gap-4">
          <Text className="text-3xl font-bold text-center text-on-surface font-manrope leading-tight">
            Votre santé mentale,{'\n'}notre priorité
          </Text>
          <Text className="text-base text-center text-on-surface-variant font-manrope leading-relaxed">
            Connectez-vous à des praticiens de confiance au Sénégal et en Afrique francophone.
          </Text>
        </View>

        {/* Actions */}
        <View className="gap-4">
          <PrimaryButton
            label="Je suis patient"
            onPress={() => router.push('/(auth)/signup-patient')}
          />
          <PrimaryButton
            label="Je suis praticien"
            onPress={() => router.push('/(auth)/signup-practitioner')}
            variant="outline"
          />
          <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
            <Text className="text-center text-sm text-on-surface-variant font-manrope">
              Déjà un compte ?{' '}
              <Text className="text-primary font-semibold">Se connecter</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  )
}
