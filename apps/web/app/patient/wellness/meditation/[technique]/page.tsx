'use client'
import { use, useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span className="material-symbols-outlined" style={{ fontSize: '20px', ...style }}>{name}</span>
}

// ── Techniques ────────────────────────────────────────────────────────────────

interface Phase { label: string; dur: number; scale: number }

const TECHNIQUE_CONFIG: Record<string, {
  title: string
  totalSec: number
  phases: Phase[]
  color: string
  bg: string
  ringColor: string
}> = {
  coherence: {
    title: 'Cohérence cardiaque',
    totalSec: 300,
    phases: [
      { label: 'Inspirez', dur: 5, scale: 1.4 },
      { label: 'Expirez', dur: 5, scale: 0.7 },
    ],
    color: '#006685',
    bg: '#e5eeff',
    ringColor: 'rgba(0,102,133,0.25)',
  },
  box: {
    title: 'Box Breathing',
    totalSec: 480,
    phases: [
      { label: 'Inspirez', dur: 4, scale: 1.4 },
      { label: 'Retenez', dur: 4, scale: 1.4 },
      { label: 'Expirez', dur: 4, scale: 0.7 },
      { label: 'Retenez', dur: 4, scale: 0.7 },
    ],
    color: '#1d7a3a',
    bg: '#e8f5e9',
    ringColor: 'rgba(29,122,58,0.25)',
  },
  '478': {
    title: 'Relaxation profonde',
    totalSec: 1200,
    phases: [
      { label: 'Inspirez', dur: 4, scale: 1.4 },
      { label: 'Retenez', dur: 7, scale: 1.4 },
      { label: 'Expirez', dur: 8, scale: 0.7 },
    ],
    color: '#705d00',
    bg: '#fff8e1',
    ringColor: 'rgba(112,93,0,0.20)',
  },
}

// ── Breathing Ring ────────────────────────────────────────────────────────────

function BreathingRing({
  isActive, currentPhase, config,
}: {
  isActive: boolean
  currentPhase: Phase | null
  config: typeof TECHNIQUE_CONFIG[string]
}) {
  const scale = isActive && currentPhase ? currentPhase.scale : 1.0
  const transitionDur = isActive && currentPhase ? currentPhase.dur : 0.6

  return (
    <div className="relative flex items-center justify-center" style={{ width: 200, height: 200 }}>
      {/* Outer glow ring */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle, ${config.ringColor} 0%, transparent 70%)`,
          transform: `scale(${scale})`,
          transition: `transform ${transitionDur}s ease-in-out`,
          opacity: isActive ? 1 : 0.3,
        }}
      />
      {/* Main ring */}
      <div
        style={{
          width: 140,
          height: 140,
          borderRadius: '50%',
          border: `3px solid ${config.color}`,
          backgroundColor: config.bg,
          transform: `scale(${scale})`,
          transition: `transform ${transitionDur}s ease-in-out`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: isActive ? `0 0 40px ${config.ringColor}` : 'none',
        }}
      >
        <Icon name="self_improvement" style={{ fontSize: '48px', color: config.color, opacity: 0.7 }} />
      </div>
    </div>
  )
}

// ── Session Page ──────────────────────────────────────────────────────────────

export default function MeditationSessionPage({ params }: { params: Promise<{ technique: string }> }) {
  const { technique } = use(params)
  const config = TECHNIQUE_CONFIG[technique] ?? TECHNIQUE_CONFIG.coherence

  const [isActive, setIsActive] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [phaseIdx, setPhaseIdx] = useState(0)
  const [phaseElapsed, setPhaseElapsed] = useState(0)
  const [isComplete, setIsComplete] = useState(false)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const elapsedRef = useRef(0)
  const phaseIdxRef = useRef(0)
  const phaseElapsedRef = useRef(0)

  const currentPhase = config.phases[phaseIdx] ?? null
  const remaining = Math.max(0, config.totalSec - elapsed)
  const mins = Math.floor(remaining / 60).toString().padStart(2, '0')
  const secs = (remaining % 60).toString().padStart(2, '0')
  const progress = elapsed / config.totalSec

  const tick = useCallback(() => {
    elapsedRef.current += 1
    phaseElapsedRef.current += 1

    const phase = config.phases[phaseIdxRef.current]
    if (phase && phaseElapsedRef.current >= phase.dur) {
      phaseElapsedRef.current = 0
      phaseIdxRef.current = (phaseIdxRef.current + 1) % config.phases.length
      setPhaseIdx(phaseIdxRef.current)
    }

    if (elapsedRef.current >= config.totalSec) {
      clearInterval(intervalRef.current!)
      setIsActive(false)
      setIsComplete(true)
    }

    setElapsed(elapsedRef.current)
    setPhaseElapsed(phaseElapsedRef.current)
  }, [config])

  const start = () => {
    setIsActive(true)
    intervalRef.current = setInterval(tick, 1000)
  }

  const pause = () => {
    setIsActive(false)
    if (intervalRef.current) clearInterval(intervalRef.current)
  }

  const reset = () => {
    pause()
    elapsedRef.current = 0
    phaseIdxRef.current = 0
    phaseElapsedRef.current = 0
    setElapsed(0)
    setPhaseIdx(0)
    setPhaseElapsed(0)
    setIsComplete(false)
  }

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current) }, [])

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/patient/wellness/meditation"
          onClick={reset}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/70 border border-slate-200/50 text-[#6f787e] hover:bg-white transition-colors"
        >
          <Icon name="arrow_back" />
        </Link>
        <h1 className="text-base font-bold text-[#0b1c30]">{config.title}</h1>
        <button onClick={reset} className="text-xs text-[#6f787e] hover:text-[#0b1c30] transition-colors px-2 py-1">
          Réinitialiser
        </button>
      </div>

      {/* Session card */}
      <div className="rounded-2xl p-8 flex flex-col items-center gap-8" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{ width: `${progress * 100}%`, backgroundColor: config.color }}
          />
        </div>

        {/* Ring */}
        <BreathingRing isActive={isActive} currentPhase={currentPhase} config={config} />

        {/* Labels */}
        <div className="text-center space-y-2">
          {isComplete ? (
            <>
              <div className="flex items-center justify-center gap-2">
                <Icon name="celebration" style={{ fontSize: '24px', color: config.color }} />
                <p className="text-xl font-black text-[#0b1c30]">Session terminée !</p>
              </div>
              <p className="text-sm text-[#6f787e]">Excellente pratique. Prenez un moment pour revenir doucement.</p>
            </>
          ) : (
            <>
              <p className="text-2xl font-black" style={{ color: config.color }}>
                {isActive && currentPhase ? currentPhase.label : '—'}
              </p>
              <p className="text-4xl font-black text-[#0b1c30] tabular-nums">{mins}:{secs}</p>
              {isActive && currentPhase && (
                <p className="text-sm text-[#6f787e]">
                  Phase : {phaseElapsed + 1}s / {currentPhase.dur}s
                </p>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        {isComplete ? (
          <div className="flex gap-3 w-full">
            <button
              onClick={reset}
              className="flex-1 py-3 rounded-xl border border-slate-200/50 bg-white/60 text-sm font-semibold text-[#0b1c30] hover:bg-white transition-all"
            >
              Recommencer
            </button>
            <Link
              href="/patient/wellness/meditation"
              className="flex-1 py-3 rounded-xl text-white text-sm font-semibold text-center transition-all hover:shadow-lg"
              style={{ backgroundColor: config.color }}
            >
              Autre technique
            </Link>
          </div>
        ) : (
          <button
            onClick={isActive ? pause : start}
            className="flex items-center gap-3 px-10 py-4 rounded-2xl text-sm font-bold uppercase tracking-widest transition-all"
            style={{
              backgroundColor: isActive ? 'rgba(111,120,126,0.12)' : config.color,
              color: isActive ? '#0b1c30' : '#fff',
              border: isActive ? '1.5px solid #bec8ce' : 'none',
              boxShadow: isActive ? 'none' : `0 8px 24px ${config.ringColor}`,
            }}
          >
            <Icon name={isActive ? 'pause' : 'play_arrow'} style={{ fontSize: '22px', color: isActive ? '#0b1c30' : '#fff' }} />
            {isActive ? 'Pause' : elapsed === 0 ? 'Commencer' : 'Reprendre'}
          </button>
        )}
      </div>

      {/* Phases guide */}
      <div className="rounded-2xl p-5 space-y-3" style={{ backgroundColor: 'rgba(255,255,255,0.50)', border: '1px solid rgba(255,255,255,0.80)' }}>
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: config.color }}>Cycle respiratoire</p>
        <div className="flex items-center gap-2 flex-wrap">
          {config.phases.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={{
                  backgroundColor: isActive && phaseIdx === i ? config.bg : 'rgba(255,255,255,0.60)',
                  color: isActive && phaseIdx === i ? config.color : '#6f787e',
                  border: `1px solid ${isActive && phaseIdx === i ? config.color + '40' : '#bec8ce40'}`,
                  fontWeight: isActive && phaseIdx === i ? '700' : '500',
                }}
              >
                {p.label} {p.dur}s
              </div>
              {i < config.phases.length - 1 && (
                <Icon name="arrow_forward" style={{ fontSize: '14px', color: '#bec8ce' }} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
