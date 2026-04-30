import { View, Text } from 'react-native'
import { usePractitionerAccess } from '@/features/auth/hooks/usePractitionerAccess'

export default function PractitionerHome() {
  const { isPending, isApproved } = usePractitionerAccess()
  return (
    <View className="flex-1 bg-background items-center justify-center gap-2">
      <Text className="text-on-surface font-manrope text-lg">Espace Praticien</Text>
      {isPending && (
        <Text className="text-sm text-outline font-manrope">
          Vérification en cours — accès limité
        </Text>
      )}
      {isApproved && (
        <Text className="text-sm text-primary font-manrope">
          Compte vérifié ✓
        </Text>
      )}
    </View>
  )
}
