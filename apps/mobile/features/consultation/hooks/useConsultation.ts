import { useEffect, useCallback } from 'react'
import { supabase } from '@/services/supabase'
import { useConsultationStore } from '../store/consultationStore'
import type { ChatMessage, ConsultationStatus } from '@/types/consultation'

export function useConsultationRoom(consultationId: string | null) {
  const { setStatus, setStartedAt, addChatMessage } = useConsultationStore()

  useEffect(() => {
    if (!consultationId) return

    const channel = supabase
      .channel(`consultation:${consultationId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'consultations',
        filter: `id=eq.${consultationId}`,
      }, (payload) => {
        const c = payload.new as { status: ConsultationStatus; started_at: string | null }
        setStatus(c.status)
        if (c.status === 'active' && c.started_at) {
          setStartedAt(new Date(c.started_at).getTime())
        }
      })
      .on('broadcast', { event: 'chat_message' }, ({ payload }) => {
        addChatMessage(payload as ChatMessage)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [consultationId, setStatus, setStartedAt, addChatMessage])
}

export function useSendChatMessage(consultationId: string | null) {
  const addChatMessage = useConsultationStore((s) => s.addChatMessage)

  const send = useCallback(async (content: string, role: 'patient' | 'practitioner') => {
    if (!consultationId) return
    const msg: ChatMessage = {
      id: `${role}_${Date.now()}`,
      role,
      content,
      timestamp: Date.now(),
    }
    addChatMessage(msg)

    await supabase
      .channel(`consultation:${consultationId}`)
      .send({ type: 'broadcast', event: 'chat_message', payload: msg })
  }, [consultationId, addChatMessage])

  return send
}

export function useEndConsultation() {
  const { consultationId, chatMessages, setSummary } = useConsultationStore()

  const endSession = useCallback(async (notes?: string) => {
    if (!consultationId) return null
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    const res = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/end-consultation`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ consultationId, chatHistory: chatMessages, notes }),
      }
    )
    if (!res.ok) throw new Error('End consultation failed')
    const { aiSummary, durationMin } = await res.json()
    setSummary(aiSummary, durationMin)
    return { aiSummary, durationMin }
  }, [consultationId, chatMessages, setSummary])

  return { endSession }
}
