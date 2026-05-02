import { View, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function Support() {
  return (
    <SafeAreaView className="flex-1 bg-background items-center justify-center px-6">
      <Text style={{ fontSize: 40 }}>🆘</Text>
      <Text className="text-xl font-bold text-on-surface font-manrope mt-4 text-center">Support</Text>
      <Text className="text-sm text-outline font-manrope mt-2 text-center">
        Aide et ressources — à venir
      </Text>
      <Text className="text-sm text-primary font-manrope mt-6 font-semibold text-center">
        SOS Amitié Sénégal{'\n'}+221 33 823 8020
      </Text>
    </SafeAreaView>
  )
}
