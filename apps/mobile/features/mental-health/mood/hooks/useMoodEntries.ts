import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { useMoodStore } from '../../store/moodStore'
import { enqueueMood } from '../../store/offlineQueue'
import type { MoodEntry } from '@/types/mentalHealth'
import NetInfo from '@react-native-community/netinfo'

export function useMoodEntries(patientId: string) {
  return useQuery({
    queryKey: ['mood_entries', patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mood_entries')
        .select('*')
        .eq('patient_id', patientId)
        .order('entry_date', { ascending: false })
        .limit(30)
      if (error) throw error
      return (data ?? []) as MoodEntry[]
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!patientId,
  })
}

export function useAddMoodEntry() {
  const qc = useQueryClient()
  const { addLocal } = useMoodStore()

  return useMutation({
    mutationFn: async (entry: {
      patientId: string
      score: number
      emotions: string[]
      note?: string
    }) => {
      const entryDate = new Date().toISOString().split('T')[0]
      const createdAt = new Date().toISOString()

      await addLocal({ ...entry, entryDate, createdAt })

      const netState = await NetInfo.fetch()
      if (!netState.isConnected) {
        await enqueueMood({ tempId: `q_${Date.now()}`, ...entry, entryDate, createdAt })
        return
      }

      const { error } = await supabase.from('mood_entries').insert({
        patient_id: entry.patientId,
        score: entry.score,
        emotions: entry.emotions,
        note: entry.note,
        entry_date: entryDate,
      })
      if (error) {
        await enqueueMood({ tempId: `q_${Date.now()}`, ...entry, entryDate, createdAt })
      }
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['mood_entries', v.patientId] }),
  })
}
