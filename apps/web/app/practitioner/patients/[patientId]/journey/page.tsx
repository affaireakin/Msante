'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { supabase } from '@/lib/supabase'

// ─── helpers ────────────────────────────────────────────────────────────────

function Icon({ name, size = 18, color }: { name: string; size?: number; color?: string }) {
  return (
    <span
      className="material-symbols-outlined"
      style={{ fontSize: `${size}px`, color, lineHeight: 1, userSelect: 'none' }}
    >
      {name}
    </span>
  )
}

function scoreColor(score: number): string {
  if (score >= 7) return '#1d7a3a'
  if (score >= 4) return '#705d00'
  return '#ba1a1a'
}

function scoreBg(score: number): string {
  if (score >= 7) return '#dcfce7'
  if (score >= 4) return '#fef9c3'
  return '#ffdad6'
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtShort(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}


// ─── data types ─────────────────────────────────────────────────────────────

interface PatientInfo {
  full_name: string
  created_at: string
}

interface MoodEntry {
  score: number
  entry_date: string
  note: string | null
  emotions: string[]
}

interface Appointment {
  id: string
  scheduled_at: string
  status: string
  created_at: string
}

interface JournalFirst {
  id: string
  created_at: string
}

interface MeditationFirst {
  id: string
  completed_at: string
}

interface JourneyData {
  patient: PatientInfo
  moodEntries: MoodEntry[]
  appointments: Appointment[]
  journalFirst: JournalFirst | null
  meditationFirst: MeditationFirst | null
  sevenDaysAgo: string
}

// ─── data hook ──────────────────────────────────────────────────────────────

function useJourneyData(patientId: string) {
  return useQuery<JourneyData>({
    queryKey: ['wellness-journey', patientId],
    enabled: !!patientId,
    queryFn: async () => {
      const now = new Date()
      const thirtyDaysAgo = new Date(now)
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const THIRTY_DAYS_AGO = thirtyDaysAgo.toISOString().slice(0, 10)

      const sevenDaysAgo = new Date(now)
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const SEVEN_DAYS_AGO = sevenDaysAgo.toISOString()

      const [
        { data: patientData, error: pErr },
        { data: moodData, error: mErr },
        { data: aptsData, error: aErr },
        { data: journalData },
        { data: meditationData },
      ] = await Promise.all([
        supabase.from('users').select('full_name, created_at').eq('id', patientId).single(),
        supabase
          .from('mood_entries')
          .select('score, entry_date, note, emotions')
          .eq('patient_id', patientId)
          .gte('entry_date', THIRTY_DAYS_AGO)
          .order('entry_date', { ascending: true }),
        supabase
          .from('appointments')
          .select('id, scheduled_at, status, created_at')
          .eq('patient_id', patientId)
          .order('scheduled_at', { ascending: true })
          .limit(200),
        supabase
          .from('journal_entries')
          .select('id, created_at')
          .eq('patient_id', patientId)
          .order('created_at', { ascending: true })
          .limit(1),
        supabase
          .from('meditation_sessions')
          .select('id, completed_at')
          .eq('patient_id', patientId)
          .order('completed_at', { ascending: true })
          .limit(1),
      ])

      if (pErr) throw pErr
      if (mErr) throw mErr
      if (aErr) throw aErr

      return {
        patient: patientData as PatientInfo,
        moodEntries: (moodData ?? []) as MoodEntry[],
        appointments: (aptsData ?? []) as Appointment[],
        journalFirst: journalData?.[0] ? (journalData[0] as JournalFirst) : null,
        meditationFirst: meditationData?.[0] ? (meditationData[0] as MeditationFirst) : null,
        sevenDaysAgo: SEVEN_DAYS_AGO,
      }
    },
    staleTime: 5 * 60 * 1000,
  })
}

// ─── derived metrics ─────────────────────────────────────────────────────────

function computeMetrics(data: JourneyData) {
  const { moodEntries, appointments } = data

  // Adhérence: days with mood entry / 30
  const uniqueDays = new Set(moodEntries.map(e => e.entry_date)).size
  const adherence = Math.round((uniqueDays / 30) * 100)

  // Avg mood
  const avgMood =
    moodEntries.length > 0
      ? Math.round((moodEntries.reduce((s, e) => s + e.score, 0) / moodEntries.length) * 10) / 10
      : 0

  // Sessions complétées
  const completed = appointments.filter(a => a.status === 'completed').length

  // Streak: consecutive days ending today
  const today = new Date().toISOString().slice(0, 10)
  const entryDates = new Set(moodEntries.map(e => e.entry_date))
  let streak = 0
  const cursor = new Date()
  while (true) {
    const key = cursor.toISOString().slice(0, 10)
    if (entryDates.has(key)) {
      streak++
      cursor.setDate(cursor.getDate() - 1)
    } else {
      break
    }
    if (streak > 365) break // safety
  }
  // If today not yet logged, start from yesterday
  if (!entryDates.has(today) && streak === 0) {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const cur2 = yesterday
    while (true) {
      const key = cur2.toISOString().slice(0, 10)
      if (entryDates.has(key)) {
        streak++
        cur2.setDate(cur2.getDate() - 1)
      } else {
        break
      }
      if (streak > 365) break
    }
  }

  // Health score: adherence rate (40%) + mood score normalized (40%) + session engagement capped at 100% (20%)
  // This is a non-clinical indicator for practitioner overview only — not a medical assessment.
  const healthScore = Math.min(
    100,
    Math.round(adherence * 0.4 + (avgMood / 10) * 100 * 0.4 + Math.min(completed * 10, 100) * 0.2)
  )

  return { adherence, avgMood, completed, streak, healthScore }
}

function computeUrgent(data: JourneyData, sevenDaysAgo: string): string | null {
  const latestMood =
    data.moodEntries.length > 0 ? data.moodEntries[data.moodEntries.length - 1] : null
  if (latestMood && latestMood.score < 4) {
    return `Score d'humeur critique (${latestMood.score}/10) — Suivi recommandé`
  }
  const recentNoShow = data.appointments.find(
    a => a.status === 'no_show' && new Date(a.scheduled_at) >= new Date(sevenDaysAgo)
  )
  if (recentNoShow) {
    return `Absence non signalée le ${fmtShort(recentNoShow.scheduled_at)} — Contacter le patient`
  }
  return null
}

// ─── milestones ──────────────────────────────────────────────────────────────

interface Milestone {
  icon: string
  label: string
  date: string | null
  achieved: boolean
}

function computeMilestones(data: JourneyData): Milestone[] {
  const { appointments, journalFirst, meditationFirst, moodEntries } = data

  const firstConfirmed = appointments.find(a =>
    ['confirmed', 'completed'].includes(a.status)
  )
  const lastCompleted = [...appointments].reverse().find(a => a.status === 'completed')

  // Streak ≥ 7
  const entryDates = [...new Set(moodEntries.map(e => e.entry_date))].sort()
  let maxStreak = 0
  let streakStart: string | null = null
  let runStart = entryDates[0] ?? null
  let run = 1
  for (let i = 1; i < entryDates.length; i++) {
    const prev = new Date(entryDates[i - 1])
    const curr = new Date(entryDates[i])
    const diff = (curr.getTime() - prev.getTime()) / 86400000
    if (diff === 1) {
      run++
    } else {
      if (run > maxStreak) { maxStreak = run; streakStart = runStart }
      run = 1
      runStart = entryDates[i]
    }
  }
  if (run > maxStreak) { maxStreak = run; streakStart = runStart }

  return [
    {
      icon: 'event_available',
      label: 'Premier rendez-vous confirmé',
      date: firstConfirmed?.scheduled_at ?? null,
      achieved: !!firstConfirmed,
    },
    {
      icon: 'book',
      label: 'Première entrée journal',
      date: journalFirst?.created_at ?? null,
      achieved: !!journalFirst,
    },
    {
      icon: 'self_improvement',
      label: 'Première séance méditation',
      date: meditationFirst?.completed_at ?? null,
      achieved: !!meditationFirst,
    },
    {
      icon: 'local_fire_department',
      label: 'Streak humeur 7 jours consécutifs',
      date: maxStreak >= 7 && streakStart ? streakStart : null,
      achieved: maxStreak >= 7,
    },
    {
      icon: 'check_circle',
      label: 'Dernière consultation complétée',
      date: lastCompleted?.scheduled_at ?? null,
      achieved: !!lastCompleted,
    },
  ]
}

// ─── skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-white/40 rounded-xl ${className ?? ''}`} />
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function WellnessJourneyPage() {
  const { patientId } = useParams<{ patientId: string }>()
  const router = useRouter()

  const { data, isLoading, error } = useJourneyData(patientId)

  // ── loading ──
  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl" style={{ fontFamily: 'Manrope, sans-serif' }}>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-20" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-60" />
        <Skeleton className="h-48" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="max-w-5xl p-8 text-center rounded-2xl" style={{ fontFamily: 'Manrope, sans-serif', backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
        <Icon name="error_outline" size={40} color="#ba1a1a" />
        <p className="text-[#ba1a1a] font-bold mt-3">Impossible de charger les données</p>
        <p className="text-sm text-[#6f787e] mt-1">{error instanceof Error ? error.message : 'Erreur inconnue'}</p>
        <button
          onClick={() => router.back()}
          className="mt-4 px-4 py-2 rounded-full text-sm font-bold bg-[#006685] text-white hover:bg-[#005070] transition-colors"
        >
          Retour
        </button>
      </div>
    )
  }

  const metrics = computeMetrics(data)
  const urgentReason = computeUrgent(data, data.sevenDaysAgo)
  const milestones = computeMilestones(data)

  // chart data
  const chartData = data.moodEntries.map(e => ({
    date: fmtShort(e.entry_date),
    score: e.score,
  }))

  // recent activity (last 5, newest first)
  const recentMood = [...data.moodEntries].reverse().slice(0, 5)

  return (
    <div className="space-y-6 max-w-5xl" style={{ fontFamily: 'Manrope, sans-serif' }}>

      {/* ── 1. HEADER ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-full hover:bg-white/60 transition-colors"
          aria-label="Retour"
        >
          <Icon name="arrow_back" size={20} color="#0b1c30" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-black text-[#0b1c30] tracking-tight">
              Parcours bien-être
            </h1>
            <span className="text-2xl font-black text-[#006685]">— {data.patient.full_name}</span>
          </div>
          <p className="text-sm text-[#6f787e] mt-0.5 flex items-center gap-1">
            <Icon name="calendar_today" size={13} color="#6f787e" />
            Suivi depuis le {fmt(data.patient.created_at)}
          </p>
        </div>

        {/* Health score badge */}
        <div
          className="flex flex-col items-center justify-center w-20 h-20 rounded-2xl flex-shrink-0"
          style={{
            backgroundColor: 'rgba(255,255,255,0.70)',
            border: '1px solid rgba(255,255,255,0.80)',
            boxShadow: '0 10px 30px -10px rgba(0,102,133,0.08)',
          }}
        >
          <span
            className="text-2xl font-black"
            style={{ color: scoreColor(metrics.healthScore / 10) }}
          >
            {metrics.healthScore}%
          </span>
          <span className="text-xs text-[#6f787e] font-medium">santé</span>
        </div>
      </div>

      {/* ── 2. URGENT BANNER ─────────────────────────────────────────────── */}
      {urgentReason && (
        <div
          className="flex items-start gap-3 rounded-2xl px-5 py-4"
          style={{
            backgroundColor: '#ffdad6',
            border: '1px solid rgba(186,26,26,0.20)',
          }}
          role="alert"
        >
          <Icon name="warning" size={20} color="#ba1a1a" />
          <div>
            <p className="text-sm font-black text-[#ba1a1a] uppercase tracking-wide">
              Action requise aujourd'hui
            </p>
            <p className="text-sm text-[#ba1a1a] mt-0.5">{urgentReason}</p>
          </div>
        </div>
      )}

      {/* ── 3. KPI ROW ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            icon: 'calendar_month',
            label: 'Adhérence bien-être',
            value: `${metrics.adherence}%`,
            sub: '30 derniers jours',
            accent: '#006685',
            bg: '#e5eeff',
          },
          {
            icon: 'sentiment_satisfied',
            label: 'Score mood moyen',
            value: `${metrics.avgMood}/10`,
            sub: '30 derniers jours',
            accent: scoreColor(metrics.avgMood),
            bg: scoreBg(metrics.avgMood),
          },
          {
            icon: 'video_call',
            label: 'Sessions complétées',
            value: String(metrics.completed),
            sub: 'Toutes périodes',
            accent: '#006685',
            bg: '#e5eeff',
          },
          {
            icon: 'local_fire_department',
            label: 'Streak actuel',
            value: `${metrics.streak}j`,
            sub: 'Jours consécutifs',
            accent: metrics.streak >= 7 ? '#1d7a3a' : metrics.streak >= 3 ? '#705d00' : '#6f787e',
            bg: metrics.streak >= 7 ? '#dcfce7' : metrics.streak >= 3 ? '#fef9c3' : '#f1f5f9',
          },
        ].map(card => (
          <div
            key={card.label}
            className="rounded-2xl p-5 space-y-3"
            style={{
              backgroundColor: 'rgba(255,255,255,0.70)',
              border: '1px solid rgba(255,255,255,0.80)',
              boxShadow: '0 10px 30px -10px rgba(0,102,133,0.05)',
            }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: card.bg }}
            >
              <Icon name={card.icon} size={20} color={card.accent} />
            </div>
            <div>
              <p className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">{card.label}</p>
              <p className="text-2xl font-black mt-0.5" style={{ color: card.accent }}>
                {card.value}
              </p>
              <p className="text-xs text-[#6f787e] mt-0.5">{card.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── 4. MOOD TREND CHART ──────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-6"
        style={{
          backgroundColor: 'rgba(255,255,255,0.70)',
          border: '1px solid rgba(255,255,255,0.80)',
          boxShadow: '0 10px 30px -10px rgba(0,102,133,0.05)',
        }}
      >
        <div className="flex items-center gap-2 mb-5">
          <Icon name="show_chart" size={18} color="#006685" />
          <h2 className="text-base font-bold text-[#0b1c30]">Tendance humeur — 30 derniers jours</h2>
        </div>

        {chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-[#6f787e]">
            <Icon name="sentiment_neutral" size={36} color="#bec8ce" />
            <p className="text-sm">Aucune donnée d'humeur sur cette période</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,102,133,0.08)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#6f787e', fontFamily: 'Manrope' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[1, 10]}
                ticks={[1, 3, 5, 7, 10]}
                tick={{ fontSize: 11, fill: '#6f787e', fontFamily: 'Manrope' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255,255,255,0.95)',
                  border: '1px solid rgba(0,102,133,0.15)',
                  borderRadius: '12px',
                  fontFamily: 'Manrope',
                  fontSize: '12px',
                  color: '#0b1c30',
                  boxShadow: '0 4px 16px rgba(0,102,133,0.10)',
                }}
                formatter={(value) => [`${value ?? ''}/10`, 'Score humeur']}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#006685"
                strokeWidth={2.5}
                dot={{ fill: '#006685', strokeWidth: 0, r: 3 }}
                activeDot={{ r: 6, fill: '#006685', stroke: '#fff', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── 5. MILESTONES TIMELINE ──────────────────────────────────────── */}
      <div
        className="rounded-2xl p-6"
        style={{
          backgroundColor: 'rgba(255,255,255,0.70)',
          border: '1px solid rgba(255,255,255,0.80)',
          boxShadow: '0 10px 30px -10px rgba(0,102,133,0.05)',
        }}
      >
        <div className="flex items-center gap-2 mb-5">
          <Icon name="timeline" size={18} color="#006685" />
          <h2 className="text-base font-bold text-[#0b1c30]">Jalons du parcours</h2>
        </div>

        <div className="relative">
          {/* vertical line */}
          <div
            className="absolute left-4 top-3 bottom-3 w-px"
            style={{ backgroundColor: '#e5eeff' }}
          />

          <div className="space-y-5">
            {milestones.map((m) => (
              <div key={m.label} className="flex items-start gap-4 relative">
                {/* dot */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10"
                  style={{
                    backgroundColor: m.achieved ? '#dcfce7' : '#f1f5f9',
                    border: `2px solid ${m.achieved ? '#1d7a3a' : '#bec8ce'}`,
                  }}
                >
                  <Icon name={m.icon} size={15} color={m.achieved ? '#1d7a3a' : '#bec8ce'} />
                </div>

                <div className="flex-1 pt-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p
                      className="text-sm font-semibold"
                      style={{ color: m.achieved ? '#0b1c30' : '#bec8ce' }}
                    >
                      {m.label}
                    </p>
                    {m.achieved && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#dcfce7] text-[#1d7a3a]">
                        Atteint
                      </span>
                    )}
                  </div>
                  {m.date ? (
                    <p className="text-xs text-[#6f787e] mt-0.5">{fmt(m.date)}</p>
                  ) : (
                    <p className="text-xs text-[#bec8ce] mt-0.5">Non encore atteint</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 6. RECENT ACTIVITY ──────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-6"
        style={{
          backgroundColor: 'rgba(255,255,255,0.70)',
          border: '1px solid rgba(255,255,255,0.80)',
          boxShadow: '0 10px 30px -10px rgba(0,102,133,0.05)',
        }}
      >
        <div className="flex items-center gap-2 mb-5">
          <Icon name="history" size={18} color="#006685" />
          <h2 className="text-base font-bold text-[#0b1c30]">Activité récente — humeur</h2>
        </div>

        {recentMood.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-[#6f787e]">
            <Icon name="mood" size={36} color="#bec8ce" />
            <p className="text-sm">Aucune entrée d'humeur récente</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentMood.map((entry) => (
              <div
                key={entry.entry_date}
                className="flex items-start gap-4 py-3 px-4 rounded-xl"
                style={{ backgroundColor: 'rgba(229,238,255,0.30)' }}
              >
                {/* score badge */}
                <span
                  className="inline-flex items-center justify-center w-10 h-10 rounded-full text-sm font-black flex-shrink-0"
                  style={{
                    backgroundColor: scoreBg(entry.score),
                    color: scoreColor(entry.score),
                  }}
                >
                  {entry.score}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs font-bold text-[#6f787e]">{fmtShort(entry.entry_date)}</p>
                    {entry.emotions.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {entry.emotions.slice(0, 3).map(em => (
                          <span
                            key={em}
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: '#e5eeff', color: '#006685' }}
                          >
                            {em}
                          </span>
                        ))}
                        {entry.emotions.length > 3 && (
                          <span className="text-xs text-[#6f787e]">+{entry.emotions.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                  {entry.note ? (
                    <p className="text-sm text-[#0b1c30] mt-0.5 line-clamp-2">{entry.note}</p>
                  ) : (
                    <p className="text-xs text-[#bec8ce] mt-0.5">Aucune note</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 7. QUICK ACTIONS ────────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-6"
        style={{
          backgroundColor: 'rgba(255,255,255,0.70)',
          border: '1px solid rgba(255,255,255,0.80)',
          boxShadow: '0 10px 30px -10px rgba(0,102,133,0.05)',
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Icon name="bolt" size={18} color="#006685" />
          <h2 className="text-base font-bold text-[#0b1c30]">Actions rapides</h2>
        </div>

        <div className="flex flex-wrap gap-3">
          <a
            href="/practitioner/appointments"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold text-white transition-colors hover:bg-[#005070]"
            style={{ backgroundColor: '#006685' }}
          >
            <Icon name="event_add" size={16} color="#fff" />
            Planifier un RDV
          </a>

          <button
            type="button"
            disabled
            title="Fonctionnalité à venir"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-colors"
            style={{
              backgroundColor: 'transparent',
              border: '1.5px solid #006685',
              color: '#006685',
              opacity: 0.5,
              cursor: 'not-allowed',
            }}
          >
            <Icon name="mail" size={16} color="#006685" />
            Envoyer un message
          </button>
        </div>
      </div>

    </div>
  )
}
