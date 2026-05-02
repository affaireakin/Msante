import { formatDuration } from '../ConsultationTimer'

describe('formatDuration', () => {
  it('formats 0 seconds', () => {
    expect(formatDuration(0)).toBe('00:00')
  })
  it('formats 65 seconds', () => {
    expect(formatDuration(65)).toBe('01:05')
  })
  it('formats 3661 seconds', () => {
    expect(formatDuration(3661)).toBe('61:01')
  })
})
