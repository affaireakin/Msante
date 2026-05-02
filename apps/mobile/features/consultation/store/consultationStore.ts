import { create } from 'zustand'
import type { ChatMessage, ConsultationStatus } from '@/types/consultation'

interface ConsultationState {
  consultationId: string | null
  roomUrl: string | null
  patientToken: string | null
  status: ConsultationStatus
  startedAt: number | null
  chatMessages: ChatMessage[]
  aiSummary: string | null
  durationMin: number | null
  prescriptionUrl: string | null

  setConsultation: (data: { consultationId: string; roomUrl: string; patientToken: string }) => void
  setStatus: (status: ConsultationStatus) => void
  setStartedAt: (ts: number) => void
  addChatMessage: (msg: ChatMessage) => void
  setSummary: (aiSummary: string, durationMin: number) => void
  setPrescriptionUrl: (url: string) => void
  reset: () => void
}

const initial = {
  consultationId: null,
  roomUrl: null,
  patientToken: null,
  status: 'waiting' as ConsultationStatus,
  startedAt: null,
  chatMessages: [],
  aiSummary: null,
  durationMin: null,
  prescriptionUrl: null,
}

export const useConsultationStore = create<ConsultationState>((set) => ({
  ...initial,
  setConsultation: (data) => set({
    consultationId: data.consultationId,
    roomUrl: data.roomUrl,
    patientToken: data.patientToken,
  }),
  setStatus: (status) => set({ status }),
  setStartedAt: (startedAt) => set({ startedAt }),
  addChatMessage: (msg) => set((s) => ({ chatMessages: [...s.chatMessages, msg] })),
  setSummary: (aiSummary, durationMin) => set({ aiSummary, durationMin }),
  setPrescriptionUrl: (prescriptionUrl) => set({ prescriptionUrl }),
  reset: () => set(initial),
}))
