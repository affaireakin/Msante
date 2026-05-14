import { useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { supabase } from '@/services/supabase'
import { AIInsightCard } from '@/features/mental-health/journal/components/AIInsightCard'
import { useJournalAnalysis } from '@/features/mental-health/journal/hooks/useJournalAnalysis'
import { useAuth } from '@/features/auth/hooks/useAuth'
import type { JournalEntry } from '@/types/mentalHealth'

export default function JournalDetail() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { profile } = useAuth()
  const analyze = useJournalAnalysis()

  const { data: entry } = useQuery({
    queryKey: ['journal_entry', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as JournalEntry
    },
    enabled: !!id && !id.startsWith('local_'),
  })

  useEffect(() => {
    if (entry && !entry.aiSentiment && profile?.id) {
      analyze.mutate({
        journalId: entry.id,
        content: entry.content,
        moodScore: entry.moodScore,
        patientId: profile.id,
      })
    }
  }, [entry?.id])

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#006685" />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '600', color: '#0b1c30', fontFamily: 'Manrope', flex: 1 }} numberOfLines={1}>
          {entry?.title ?? 'Entrée journal'}
        </Text>
      </View>
      <ScrollView style={{ flex: 1, paddingHorizontal: 24 }} contentContainerStyle={{ paddingBottom: 40, gap: 16 }}>
        <View style={{
          backgroundColor: 'rgba(255,255,255,0.6)',
          borderRadius: 24,
          padding: 24,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.5)',
          shadowColor: '#006685',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.05,
          shadowRadius: 30,
          elevation: 3,
        }}>
          <Text style={{ fontSize: 14, color: '#6f787e', fontFamily: 'Manrope', marginBottom: 16 }}>
            {entry
              ? new Date(entry.createdAt).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
              : ''}
          </Text>
          <Text style={{ fontSize: 16, color: '#0b1c30', fontFamily: 'Manrope', lineHeight: 26 }}>{entry?.content}</Text>
        </View>
        {entry?.aiSentiment && (
          <AIInsightCard
            sentiment={entry.aiSentiment}
            themes={entry.aiThemes ?? []}
            suggestion={entry.aiSuggestion ?? ''}
          />
        )}
        {analyze.isPending && (
          <View style={{ backgroundColor: 'rgba(190,233,255,0.2)', borderRadius: 16, padding: 16, alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
            <MaterialIcons name="auto-awesome" size={16} color="#006685" />
            <Text style={{ fontSize: 14, color: '#006685', fontFamily: 'Manrope' }}>Mounima analyse votre entrée...</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
