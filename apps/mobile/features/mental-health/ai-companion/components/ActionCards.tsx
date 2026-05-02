import { View, Text, TouchableOpacity, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'

interface Props {
  showCrisis?: boolean
}

export function ActionCards({ showCrisis = false }: Props) {
  const router = useRouter()

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-6 px-6">
      <View className="flex-row gap-4 py-2">
        <View
          className="bg-white/60 rounded-xl p-5 w-64 border border-white/50 gap-4"
          style={{ shadowColor: '#006685', shadowOpacity: 0.05, shadowRadius: 16, elevation: 2 }}
        >
          <View className="w-10 h-10 rounded-full bg-primary-container/30 items-center justify-center">
            <Text className="text-xl">🌬️</Text>
          </View>
          <View>
            <Text className="text-base font-semibold text-on-surface font-manrope leading-tight mb-1">Exercice respiratoire 5 min</Text>
            <Text className="text-xs text-outline font-manrope">Cohérence cardiaque guidée</Text>
          </View>
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: '/(patient)/mental-health/meditation/session',
                params: { technique: 'coherence', duration: '300', title: 'Cohérence cardiaque' },
              })
            }
            className="bg-primary py-2 rounded-lg items-center"
          >
            <Text className="text-white text-xs font-semibold font-manrope uppercase tracking-wider">Commencer</Text>
          </TouchableOpacity>
        </View>

        <View
          className="bg-white/60 rounded-xl p-5 w-64 border border-white/50 gap-4"
          style={{ shadowColor: '#006685', shadowOpacity: 0.05, shadowRadius: 16, elevation: 2 }}
        >
          <View className="w-10 h-10 rounded-full bg-surface-variant items-center justify-center">
            <Text className="text-xl">👨‍⚕️</Text>
          </View>
          <View>
            <Text className="text-base font-semibold text-on-surface font-manrope leading-tight mb-1">Parler à un spécialiste</Text>
            <Text className="text-xs text-outline font-manrope">+200 praticiens disponibles</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(patient)/find-practitioners')}
            className="border border-primary py-2 rounded-lg items-center"
          >
            <Text className="text-primary text-xs font-semibold font-manrope uppercase tracking-wider">Réserver</Text>
          </TouchableOpacity>
        </View>

        {showCrisis && (
          <View className="bg-error-container/10 rounded-xl p-5 w-64 border border-error-container gap-4">
            <View className="w-10 h-10 rounded-full bg-error-container items-center justify-center">
              <Text className="text-xl">🆘</Text>
            </View>
            <View>
              <Text className="text-base font-semibold text-on-surface font-manrope leading-tight mb-1">Ligne de crise 24h/24</Text>
              <Text className="text-xs text-outline font-manrope">SOS Amitié Sénégal</Text>
            </View>
            <TouchableOpacity className="bg-error py-2 rounded-lg items-center">
              <Text className="text-white text-xs font-semibold font-manrope uppercase tracking-wider">+221 33 823 8020</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  )
}
