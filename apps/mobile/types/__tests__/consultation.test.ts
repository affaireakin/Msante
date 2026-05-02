import type { Consultation, ChatMessage, ConsultationStatus } from '../consultation'

describe('Consultation types', () => {
  it('ChatMessage has correct shape', () => {
    const msg: ChatMessage = {
      id: '1',
      role: 'patient',
      content: 'Hello',
      timestamp: Date.now(),
    }
    expect(msg.role).toBe('patient')
  })

  it('ConsultationStatus union is valid', () => {
    const statuses: ConsultationStatus[] = ['waiting', 'active', 'ended']
    expect(statuses).toHaveLength(3)
  })
})
