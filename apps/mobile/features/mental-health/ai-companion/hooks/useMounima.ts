import { useState, useCallback } from 'react'
import { supabase } from '@/services/supabase'
import type { AmiMessage } from '@/types/mentalHealth'
import { CRISIS_KEYWORDS_REGEX } from '../constants/systemPrompt'

export function useMounima() {
  const [messages, setMessages] = useState<AmiMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showCrisis, setShowCrisis] = useState(false)

  const sendMessage = useCallback(async (text: string) => {
    const userMsg: AmiMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }

    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)

    if (CRISIS_KEYWORDS_REGEX.test(text)) {
      setShowCrisis(true)
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }))

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/mounima-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ messages: history }),
        }
      )

      if (!res.ok) throw new Error('Chat request failed')
      const { text: replyText, isCrisis } = await res.json()

      if (isCrisis) setShowCrisis(true)

      const mounimaMsg: AmiMessage = {
        id: `a_${Date.now()}`,
        role: 'assistant',
        content: replyText,
        timestamp: Date.now(),
        showCrisis: isCrisis,
      }
      setMessages(prev => [...prev, mounimaMsg])
    } catch {
      const errMsg: AmiMessage = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: 'Je suis temporairement indisponible. Réessayez dans quelques instants. 💙',
        timestamp: Date.now(),
      }
      setMessages(prev => [...prev, errMsg])
    } finally {
      setIsLoading(false)
    }
  }, [messages])

  return {
    messages,
    isLoading,
    showCrisis,
    sendMessage,
    reset: () => { setMessages([]); setShowCrisis(false) },
  }
}

// Backward-compatibility alias
export { useMounima as useAmiFriend }
