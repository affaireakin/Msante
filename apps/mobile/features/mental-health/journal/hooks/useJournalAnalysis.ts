import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'

interface AnalysisResult {
  sentiment: string
  themes: string[]
  suggestion: string
}

export function useJournalAnalysis() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({
      journalId,
      content,
      moodScore,
      patientId,
    }: {
      journalId: string
      content: string
      moodScore?: number
      patientId: string
    }): Promise<AnalysisResult> => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ami-analysis`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ journalId, content, moodScore }),
        }
      )
      if (!res.ok) throw new Error('Analysis failed')
      return res.json() as Promise<AnalysisResult>
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['journal_entries', v.patientId] }),
  })
}
