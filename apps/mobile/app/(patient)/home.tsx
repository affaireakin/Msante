import { View, Text, TouchableOpacity, SafeAreaView } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { PrimaryButton } from '@/components/ui'
import { useAuthStore } from '@/features/auth/store/authStore'

export default function PatientHome() {
  const router = useRouter()
  const { profile } = useAuth()
  const { signOut } = useAuthStore()

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-6 pt-8 gap-6">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-sm text-on-surface-variant font-manrope">Bonjour,</Text>
            <Text className="text-2xl font-bold text-on-surface font-manrope">
              {profile?.full_name?.split(' ')[0] ?? 'Patient'} 👋
            </Text>
          </View>
          <TouchableOpacity onPress={signOut}>
            <Text className="text-sm text-outline font-manrope">Déconnexion</Text>
          </TouchableOpacity>
        </View>

        <View className="bg-primary rounded-2xl p-6 gap-2">
          <Text className="text-white/80 text-sm font-manrope">Besoin d'aide ?</Text>
          <Text className="text-white text-xl font-bold font-manrope">
            Trouvez votre praticien
          </Text>
          <Text className="text-white/70 text-sm font-manrope">
            +200 spécialistes disponibles
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(patient)/find-practitioners')}
            className="bg-white/20 rounded-xl py-3 items-center mt-2"
          >
            <Text className="text-white font-semibold font-manrope">Rechercher →</Text>
          </TouchableOpacity>
        </View>

        <View className="gap-3">
          <Text className="text-base font-semibold text-on-surface font-manrope">
            Actions rapides
          </Text>
          <PrimaryButton
            label="Trouver un praticien"
            onPress={() => router.push('/(patient)/find-practitioners')}
          />
        </View>
      </View>
    </SafeAreaView>
  )
}
