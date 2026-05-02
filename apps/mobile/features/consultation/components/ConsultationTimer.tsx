import { useEffect, useState } from 'react'
import { Text } from 'react-native'

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

interface Props {
  startedAt: number | null  // timestamp ms
  style?: object
}

export function ConsultationTimer({ startedAt, style }: Props) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!startedAt) return
    const initial = Math.floor((Date.now() - startedAt) / 1000)
    setElapsed(initial)
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [startedAt])

  // white → amber at 45min → red at 60min
  const color = elapsed >= 3600 ? '#ba1a1a' : elapsed >= 2700 ? '#e4c546' : '#ffffff'

  return (
    <Text style={[{
      fontFamily: 'Manrope',
      fontSize: 16,
      fontWeight: '700',
      color,
      letterSpacing: 1,
    }, style]}>
      {formatDuration(elapsed)}
    </Text>
  )
}
