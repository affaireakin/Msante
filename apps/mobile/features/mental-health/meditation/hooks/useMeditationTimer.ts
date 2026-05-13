import { useState, useEffect, useRef, useCallback } from 'react'

export type BreathPhase = 'inhale' | 'hold' | 'exhale' | 'hold2'

export interface PhaseConfig {
  phase: BreathPhase
  duration: number  // seconds
  label: string
}

export const TECHNIQUES: Record<string, PhaseConfig[]> = {
  coherence: [
    { phase: 'inhale', duration: 5, label: 'Inspirez' },
    { phase: 'exhale', duration: 5, label: 'Expirez' },
  ],
  box: [
    { phase: 'inhale', duration: 4, label: 'Inspirez' },
    { phase: 'hold',   duration: 4, label: 'Retenez' },
    { phase: 'exhale', duration: 4, label: 'Expirez' },
    { phase: 'hold2',  duration: 4, label: 'Retenez' },
  ],
  '478': [
    { phase: 'inhale', duration: 4, label: 'Inspirez' },
    { phase: 'hold',   duration: 7, label: 'Retenez' },
    { phase: 'exhale', duration: 8, label: 'Expirez' },
  ],
  triangle: [
    { phase: 'inhale', duration: 4, label: 'Inspirez' },
    { phase: 'hold',   duration: 4, label: 'Retenez' },
    { phase: 'exhale', duration: 4, label: 'Expirez' },
  ],
}

interface TimerState {
  isActive:     boolean
  elapsed:      number
  phaseIndex:   number
  phaseElapsed: number
  isComplete:   boolean
}

const INITIAL: TimerState = {
  isActive: false, elapsed: 0, phaseIndex: 0, phaseElapsed: 0, isComplete: false,
}

export function useMeditationTimer(technique: string, totalSeconds: number) {
  const phases = TECHNIQUES[technique] ?? TECHNIQUES.coherence
  const [s, setS] = useState<TimerState>(INITIAL)

  // Use a ref to read state inside the interval without stale closure
  const sRef = useRef(s)
  sRef.current = s
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!s.isActive) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }

    intervalRef.current = setInterval(() => {
      const { elapsed, phaseIndex, phaseElapsed } = sRef.current
      const newElapsed = elapsed + 1

      if (newElapsed >= totalSeconds) {
        clearInterval(intervalRef.current!)
        setS(prev => ({ ...prev, isActive: false, elapsed: totalSeconds, isComplete: true }))
        return
      }

      const cur = phases[phaseIndex]
      const newPhaseElapsed = phaseElapsed + 1

      if (newPhaseElapsed >= cur.duration) {
        setS(prev => ({
          ...prev,
          elapsed: newElapsed,
          phaseIndex: (phaseIndex + 1) % phases.length,
          phaseElapsed: 0,
        }))
      } else {
        setS(prev => ({ ...prev, elapsed: newElapsed, phaseElapsed: newPhaseElapsed }))
      }
    }, 1000)

    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [s.isActive, totalSeconds])  // only re-subscribe when isActive changes

  const currentPhase = phases[s.phaseIndex]
  const phaseTimeLeft = currentPhase.duration - s.phaseElapsed

  const start = useCallback(() => {
    setS({ isActive: true, elapsed: 0, phaseIndex: 0, phaseElapsed: 0, isComplete: false })
  }, [])

  const resume = useCallback(() => {
    setS(prev => ({ ...prev, isActive: true }))
  }, [])

  const pause = useCallback(() => {
    setS(prev => ({ ...prev, isActive: false }))
  }, [])

  const reset = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setS(INITIAL)
  }, [])

  return {
    isActive:     s.isActive,
    isComplete:   s.isComplete,
    elapsed:      s.elapsed,
    progress:     s.elapsed / totalSeconds,
    // Current phase info
    currentPhase: currentPhase.phase,
    currentLabel: currentPhase.label,
    phaseDuration: currentPhase.duration,
    phaseProgress: s.phaseElapsed / currentPhase.duration,
    phaseTimeLeft,
    // Controls
    start, resume, pause, reset,
  }
}
