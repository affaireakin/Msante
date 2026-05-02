import { useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
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
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-6 pt-6 pb-3 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-primary text-2xl">←</Text>
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-on-surface font-manrope flex-1" numberOfLines={1}>
          {entry?.title ?? 'Entrée journal'}
        </Text>
      </View>
      <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingBottom: 40, gap: 16 }}>
        <View
          className="bg-white/60 rounded-3xl p-6 border border-white/50"
          style={{ shadowColor: '#006685', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.05, shadowRadius: 30, elevation: 3 }}
        >
          <Text className="text-sm text-outline font-manrope mb-4">
            {entry
              ? new Date(entry.createdAt).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
              : ''}
          </Text>
          <Text className="text-base text-on-surface font-manrope leading-relaxed">{entry?.content}</Text>
        </View>
        {entry?.aiSentiment && (
          <AIInsightCard
            sentiment={entry.aiSentiment}
            themes={entry.aiThemes ?? []}
            suggestion={entry.aiSuggestion ?? ''}
          />
        )}
        {analyze.isPending && (
          <View className="bg-primary-fixed/20 rounded-2xl p-4 items-center">
            <Text className="text-sm text-primary font-manrope">✨ Ami analyse votre entrée...</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
