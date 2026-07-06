import { create } from 'zustand'
import type { ChatMessage, ConsultationStatus } from '@/types/consultation'

interface ConsultationState {
  consultationId: string | null
  roomUrl: string | null
  patientToken: string | null
  practitionerToken: string | null
  status: ConsultationStatus
  startedAt: number | null
  chatMessages: ChatMessage[]
  aiSummary: string | null
  durationMin: number | null
  prescriptionUrl: string | null

  setConsultation: (data: { consultationId: string; roomUrl: string; patientToken: string }) => void
  setPractitionerConsultation: (data: { consultationId: string; roomUrl: string; practitionerToken: string }) => void
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
  practitionerToken: null,
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
  setPractitionerConsultation: (data) => set({
    consultationId: data.consultationId,
    roomUrl: data.roomUrl,
    practitionerToken: data.practitionerToken,
  }),
  setStatus: (status) => set({ status }),
  setStartedAt: (startedAt) => set({ startedAt }),
  // Dedupe by id: with useConsultationRoom now mounted in both the waiting
  // screen and the session screen simultaneously (Expo Router keeps the
  // waiting screen alive underneath after a push), the same broadcast can be
  // delivered twice via two separate channel subscriptions.
  addChatMessage: (msg) => set((s) => (
    s.chatMessages.some((m) => m.id === msg.id) ? s : { chatMessages: [...s.chatMessages, msg] }
  )),
  setSummary: (aiSummary, durationMin) => set({ aiSummary, durationMin }),
  setPrescriptionUrl: (prescriptionUrl) => set({ prescriptionUrl }),
  reset: () => set(initial),
}))
