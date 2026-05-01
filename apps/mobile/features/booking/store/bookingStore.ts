import { create } from 'zustand'
import type { SessionType, PaymentProvider } from '@/types/booking'

interface TimeSlot {
  date: string
  startTime: string
  endTime: string
}

interface BookingState {
  practitionerId: string | null
  practitionerName: string | null
  selectedSlot: TimeSlot | null
  sessionType: SessionType
  paymentProvider: PaymentProvider | null
  amount: number | null
  currency: string
  appointmentId: string | null

  setPractitioner: (id: string, name: string) => void
  setSlot: (slot: TimeSlot) => void
  setSessionType: (type: SessionType) => void
  setPaymentProvider: (provider: PaymentProvider) => void
  setAmount: (amount: number, currency: string) => void
  setAppointmentId: (id: string) => void
  reset: () => void
}

const initialState = {
  practitionerId: null,
  practitionerName: null,
  selectedSlot: null,
  sessionType: 'video' as SessionType,
  paymentProvider: null,
  amount: null,
  currency: 'XOF',
  appointmentId: null,
}

export const useBookingStore = create<BookingState>((set) => ({
  ...initialState,
  setPractitioner: (id, name) => set({ practitionerId: id, practitionerName: name }),
  setSlot: (slot) => set({ selectedSlot: slot }),
  setSessionType: (sessionType) => set({ sessionType }),
  setPaymentProvider: (paymentProvider) => set({ paymentProvider }),
  setAmount: (amount, currency) => set({ amount, currency }),
  setAppointmentId: (appointmentId) => set({ appointmentId }),
  reset: () => set(initialState),
}))
