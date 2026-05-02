import { View, Text, FlatList, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useJournalEntries } from '@/features/mental-health/journal/hooks/useJournalEntries'
import { JournalCard } from '@/features/mental-health/journal/components/JournalCard'
import { useAuth } from '@/features/auth/hooks/useAuth'

export default function JournalList() {
  const router = useRouter()
  const { profile } = useAuth()
  const { data: entries = [] } = useJournalEntries(profile?.id ?? '')

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-6 pt-8 pb-4 flex-row items-center justify-between">
        <View>
          <Text className="text-xs text-primary font-manrope uppercase tracking-wider">Wellness Space</Text>
          <Text className="text-2xl font-bold text-on-surface font-manrope">Mon Journal</Text>
        </View>
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-sm text-outline font-manrope">Retour</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={entries}
        keyExtractor={e => e.id}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100, gap: 8 }}
        renderItem={({ item }) => (
          <JournalCard
            entry={item}
            onPress={() => router.push(`/(patient)/mental-health/journal/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <View className="items-center py-16 gap-3">
            <Text className="text-4xl">📓</Text>
            <Text className="text-sm text-outline font-manrope text-center">
              Votre journal est vide.{'\n'}Commencez à écrire.
            </Text>
          </View>
        }
      />
      <TouchableOpacity
        onPress={() => router.push('/(patient)/mental-health/journal/new')}
        className="absolute bottom-8 right-6 w-14 h-14 bg-primary rounded-full items-center justify-center"
        style={{ shadowColor: '#006685', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 30, elevation: 8 }}
      >
        <Text className="text-white text-2xl font-bold">+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}
