import { useConsultationStore } from '../consultationStore'

describe('consultationStore', () => {
  beforeEach(() => useConsultationStore.getState().reset())

  it('starts with empty state', () => {
    const s = useConsultationStore.getState()
    expect(s.consultationId).toBeNull()
    expect(s.status).toBe('waiting')
    expect(s.chatMessages).toEqual([])
  })

  it('setConsultation stores room info', () => {
    useConsultationStore.getState().setConsultation({
      consultationId: 'c1',
      roomUrl: 'https://msante.daily.co/room',
      patientToken: 'tok_xxx',
    })
    expect(useConsultationStore.getState().consultationId).toBe('c1')
    expect(useConsultationStore.getState().roomUrl).toBe('https://msante.daily.co/room')
  })

  it('addChatMessage appends message', () => {
    useConsultationStore.getState().addChatMessage({
      id: 'm1', role: 'patient', content: 'Hello', timestamp: 1000,
    })
    expect(useConsultationStore.getState().chatMessages).toHaveLength(1)
  })
})
