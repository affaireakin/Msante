import { act } from 'react'
import { renderHook } from '@testing-library/react-hooks'
import { useBookingStore } from '../bookingStore'

describe('bookingStore', () => {
  beforeEach(() => act(() => useBookingStore.getState().reset()))

  it('starts empty', () => {
    const { result } = renderHook(() => useBookingStore())
    expect(result.current.practitionerId).toBeNull()
    expect(result.current.selectedSlot).toBeNull()
    expect(result.current.paymentProvider).toBeNull()
  })

  it('setSlot updates slot and practitioner', () => {
    const { result } = renderHook(() => useBookingStore())
    act(() => {
      result.current.setPractitioner('p-1', 'Dr. Diallo')
      result.current.setSlot({ date: '2026-05-01', startTime: '09:00', endTime: '10:00' })
    })
    expect(result.current.practitionerId).toBe('p-1')
    expect(result.current.selectedSlot?.date).toBe('2026-05-01')
  })

  it('reset clears all state', () => {
    const { result } = renderHook(() => useBookingStore())
    act(() => {
      result.current.setPractitioner('p-1', 'Dr. Diallo')
      result.current.reset()
    })
    expect(result.current.practitionerId).toBeNull()
  })
})
