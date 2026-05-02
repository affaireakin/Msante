import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { useJournalStore } from '../../store/journalStore'
import { enqueueJournal } from '../../store/offlineQueue'
import type { JournalEntry } from '@/types/mentalHealth'
import NetInfo from '@react-native-community/netinfo'

export function useJournalEntries(patientId: string) {
  return useQuery({
    queryKey: ['journal_entries', patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return (data ?? []) as JournalEntry[]
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!patientId,
  })
}

export function useCreateJournalEntry() {
  const qc = useQueryClient()
  const { addLocal, clearDraft } = useJournalStore()

  return useMutation({
    mutationFn: async (entry: {
      patientId: string
      title?: string
      content: string
      moodScore?: number
      emotions: string[]
    }): Promise<string> => {
      const createdAt = new Date().toISOString()
      const local = await addLocal({ ...entry, isPrivate: true, createdAt })

      const netState = await NetInfo.fetch()
      if (!netState.isConnected) {
        await enqueueJournal({ tempId: local.id, ...entry, createdAt })
        return local.id
      }

      const { data, error } = await supabase
        .from('journal_entries')
        .insert({
          patient_id: entry.patientId,
          title: entry.title,
          content: entry.content,
          mood_score: entry.moodScore,
          emotions: entry.emotions,
          is_private: true,
        })
        .select('id')
        .single()
      if (error) throw error
      clearDraft()
      return data.id
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['journal_entries', v.patientId] }),
  })
}
