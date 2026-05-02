import { useState, useEffect, useRef } from 'react'

export type BreathPhase = 'inhale' | 'hold' | 'exhale' | 'hold2'

interface PhaseConfig {
  phase: BreathPhase
  duration: number
  label: string
}

const TECHNIQUES: Record<string, PhaseConfig[]> = {
  coherence: [
    { phase: 'inhale', duration: 5, label: 'Inspirez' },
    { phase: 'exhale', duration: 5, label: 'Expirez' },
  ],
  box: [
    { phase: 'inhale', duration: 4, label: 'Inspirez' },
    { phase: 'hold', duration: 4, label: 'Retenez' },
    { phase: 'exhale', duration: 4, label: 'Expirez' },
    { phase: 'hold2', duration: 4, label: 'Retenez' },
  ],
  '478': [
    { phase: 'inhale', duration: 4, label: 'Inspirez' },
    { phase: 'hold', duration: 7, label: 'Retenez' },
    { phase: 'exhale', duration: 8, label: 'Expirez' },
  ],
}

export function useMeditationTimer(technique: string, totalSeconds: number) {
  const [isActive, setIsActive] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [phaseElapsed, setPhaseElapsed] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const phases = TECHNIQUES[technique] ?? TECHNIQUES.coherence

  useEffect(() => {
    if (isActive) {
      intervalRef.current = setInterval(() => {
        setElapsed(e => {
          if (e + 1 >= totalSeconds) {
            setIsActive(false)
            return totalSeconds
          }
          return e + 1
        })
        setPhaseElapsed(pe => {
          const currentPhase = phases[phaseIndex]
          if (pe + 1 >= currentPhase.duration) {
            setPhaseIndex(i => (i + 1) % phases.length)
            return 0
          }
          return pe + 1
        })
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [isActive, phaseIndex, totalSeconds])

  const currentPhase = phases[phaseIndex]
  const progress = elapsed / totalSeconds
  const isComplete = elapsed >= totalSeconds

  return {
    isActive,
    elapsed,
    progress,
    isComplete,
    currentLabel: currentPhase.label,
    phaseProgress: phaseElapsed / currentPhase.duration,
    start: () => { setElapsed(0); setPhaseIndex(0); setPhaseElapsed(0); setIsActive(true) },
    stop: () => setIsActive(false),
    reset: () => { setIsActive(false); setElapsed(0); setPhaseIndex(0); setPhaseElapsed(0) },
  }
}
