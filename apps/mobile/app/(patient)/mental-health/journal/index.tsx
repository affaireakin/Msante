import { View, Text, FlatList, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useJournalEntries } from '@/features/mental-health/journal/hooks/useJournalEntries'
import { JournalCard } from '@/features/mental-health/journal/components/JournalCard'
import { useAuth } from '@/features/auth/hooks/useAuth'

export default function JournalList() {
  const router = useRouter()
  const { profile } = useAuth()
  const { data: entries = [] } = useJournalEntries(profile?.id ?? '')

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      <View style={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text style={{ fontSize: 12, color: '#006685', fontFamily: 'Manrope', textTransform: 'uppercase', letterSpacing: 1.2 }}>Wellness Space</Text>
          <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#0b1c30', fontFamily: 'Manrope' }}>Mon Journal</Text>
        </View>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ fontSize: 14, color: '#6f787e', fontFamily: 'Manrope' }}>Retour</Text>
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
          <View style={{ alignItems: 'center', paddingVertical: 64, gap: 12 }}>
            <MaterialIcons name="book" size={40} color="#bec8ce" />
            <Text style={{ fontSize: 14, color: '#6f787e', fontFamily: 'Manrope', textAlign: 'center' }}>
              Votre journal est vide.{'\n'}Commencez à écrire.
            </Text>
          </View>
        }
      />
      <TouchableOpacity
        onPress={() => router.push('/(patient)/mental-health/journal/new')}
        style={{
          position: 'absolute',
          bottom: 32,
          right: 24,
          width: 56,
          height: 56,
          backgroundColor: '#006685',
          borderRadius: 28,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#006685',
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.3,
          shadowRadius: 30,
          elevation: 8,
        }}
      >
        <MaterialIcons name="add" size={28} color="#ffffff" />
      </TouchableOpacity>
    </SafeAreaView>
  )
}
