'use client'
import { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type AptStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
type ViewMode = 'week' | 'list'

interface Appointment {
  id: string
  scheduled_at: string
  duration_min: number
  status: AptStatus
  type: 'video' | 'audio' | 'chat'
  users: { full_name: string } | null
}

// ─── Constantes ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<AptStatus, string> = {
  pending: 'En attente', confirmed: 'Confirmé', cancelled: 'Annulé',
  completed: 'Terminé', no_show: 'Absent',
}
const STATUS_COLORS: Record<AptStatus, { bg: string; text: string }> = {
  pending:   { bg: '#fef3c7', text: '#92400e' },
  confirmed: { bg: '#d1fae5', text: '#065f46' },
  cancelled: { bg: '#f1f5f9', text: '#64748b' },
  completed: { bg: '#dbeafe', text: '#1e40af' },
  no_show:   { bg: '#fee2e2', text: '#991b1b' },
}
const TYPE_META: Record<string, { icon: string; bg: string; border: string; text: string; label: string }> = {
  video: { icon: 'videocam',     bg: '#e5eeff', border: '#006685', text: '#006685', label: 'Vidéo' },
  audio: { icon: 'mic',          bg: '#f3e8ff', border: '#7c3aed', text: '#7c3aed', label: 'Audio' },
  chat:  { icon: 'chat_bubble',  bg: '#dcfce7', border: '#1d7a3a', text: '#1d7a3a', label: 'Chat'  },
}

const HOUR_START = 7
const HOUR_END   = 21
const HOUR_H     = 80   // px per hour
const DAYS_FR    = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

function Icon({ name, size = 18, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-symbols-outlined" style={{ fontSize: `${size}px`, color, lineHeight: 1 }}>{name}</span>
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getWeekStart(d: Date): Date {
  const r = new Date(d)
  const day = r.getDay()
  r.setDate(r.getDate() - (day === 0 ? 6 : day - 1))
  r.setHours(0, 0, 0, 0)
  return r
}

function getWeekDays(start: Date): Date[] {
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    return d
  })
}

function isSameDay(a: Date, b: Date) {
  return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Dakar' })
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Dakar' })
}

// ─── Hooks ─────────────────────────────────────────────────────────────────────

async function getPractitionerId() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non connecté')
  const { data } = await supabase.from('practitioners').select('id').eq('user_id', user.id).single()
  if (!data) throw new Error('Profil praticien introuvable')
  return data.id as string
}

function useWeekAppointments(weekStart: Date) {
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)
  return useQuery<Appointment[]>({
    queryKey: ['pract-apts-week', weekStart.toISOString()],
    staleTime: 60_000,
    queryFn: async () => {
      const practId = await getPractitionerId()
      const { data, error } = await supabase
        .from('appointments')
        .select('id, scheduled_at, duration_min, status, type, users!patient_id(full_name)')
        .eq('practitioner_id', practId)
        .gte('scheduled_at', weekStart.toISOString())
        .lte('scheduled_at', weekEnd.toISOString())
        .not('status', 'in', '("cancelled")')
        .order('scheduled_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as Appointment[]
    },
  })
}

function useListAppointments(filter: 'upcoming' | 'past') {
  return useQuery<Appointment[]>({
    queryKey: ['pract-apts-list', filter],
    staleTime: 60_000,
    queryFn: async () => {
      const practId = await getPractitionerId()
      const now = new Date().toISOString()
      let q = supabase
        .from('appointments')
        .select('id, scheduled_at, duration_min, status, type, users!patient_id(full_name)')
        .eq('practitioner_id', practId)
        .order('scheduled_at', { ascending: filter === 'upcoming' })
      if (filter === 'upcoming') {
        q = q.gte('scheduled_at', now).not('status', 'in', '("cancelled","no_show")')
      } else {
        q = q.lt('scheduled_at', now).limit(30)
      }
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as unknown as Appointment[]
    },
  })
}

// ─── Detail Panel ──────────────────────────────────────────────────────────────

function DetailPanel({ apt, onClose }: { apt: Appointment; onClose: () => void }) {
  const qc = useQueryClient()
  const dt = new Date(apt.scheduled_at)
  const meta = TYPE_META[apt.type] ?? TYPE_META.video
  const status = STATUS_COLORS[apt.status]

  const updateStatus = useMutation({
    mutationFn: async (s: AptStatus) => {
      const { error } = await supabase.from('appointments').update({ status: s }).eq('id', apt.id)
      if (error) throw error
      void supabase.functions.invoke('on-appointment-status-change', {
        body: { appointment_id: apt.id, new_status: s },
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pract-apts'] })
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" />
      <div
        className="relative w-full sm:w-80 h-full bg-white shadow-2xl flex flex-col overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold text-[#0b1c30]">Détail RDV</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
            <Icon name="close" size={18} color="#475569" />
          </button>
        </div>

        <div className="flex-1 p-5 space-y-5">
          {/* Patient */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm"
              style={{ background: meta.bg, color: meta.text }}>
              {(apt.users?.full_name ?? 'P').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
            </div>
            <div>
              <p className="font-semibold text-[#0b1c30]">{apt.users?.full_name ?? 'Patient'}</p>
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: status.bg, color: status.text }}>
                {STATUS_LABELS[apt.status]}
              </span>
            </div>
          </div>

          {/* Infos */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
              <Icon name="calendar_today" size={16} color="#006685" />
              <div>
                <p className="text-xs text-slate-400 font-medium">Date</p>
                <p className="text-sm font-semibold text-[#0b1c30] capitalize">{fmtDate(dt)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
              <Icon name="schedule" size={16} color="#006685" />
              <div>
                <p className="text-xs text-slate-400 font-medium">Heure</p>
                <p className="text-sm font-semibold text-[#0b1c30]">{fmtTime(dt)} · {apt.duration_min} min</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
              <Icon name={meta.icon} size={16} color={meta.text} />
              <div>
                <p className="text-xs text-slate-400 font-medium">Type</p>
                <p className="text-sm font-semibold" style={{ color: meta.text }}>{meta.label}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-2">
            {apt.status === 'confirmed' && (
              <Link href={`/practitioner/consultation/${apt.id}/waiting`}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: '#006685' }}>
                <Icon name="videocam" size={16} color="#fff" />
                Rejoindre la session
              </Link>
            )}
            {apt.status === 'pending' && (
              <button onClick={() => updateStatus.mutate('confirmed')} disabled={updateStatus.isPending}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60"
                style={{ background: '#1d7a3a' }}>
                <Icon name="check_circle" size={16} color="#fff" />
                Confirmer le RDV
              </button>
            )}
            {(apt.status === 'confirmed' || apt.status === 'pending') && (
              <>
                <button onClick={() => updateStatus.mutate('completed')} disabled={updateStatus.isPending}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-sky-700 bg-sky-50 border border-sky-200 disabled:opacity-60">
                  Marquer comme terminé
                </button>
                <button onClick={() => updateStatus.mutate('no_show')} disabled={updateStatus.isPending}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-red-600 bg-red-50 border border-red-200 disabled:opacity-60">
                  Patient absent
                </button>
                <button onClick={() => updateStatus.mutate('cancelled')} disabled={updateStatus.isPending}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-50 border border-slate-200 disabled:opacity-60">
                  Annuler le RDV
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── WeekCalendar ──────────────────────────────────────────────────────────────

function WeekCalendar({
  weekDays, appointments, onSelect,
}: {
  weekDays: Date[]
  appointments: Appointment[]
  onSelect: (apt: Appointment) => void
}) {
  const gridRef = useRef<HTMLDivElement>(null)
  const hours = useMemo(() => Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i), [])
  const today = new Date()

  // Scroll to current time on mount
  useEffect(() => {
    if (!gridRef.current) return
    const now = new Date()
    const scrollTop = ((now.getHours() + now.getMinutes() / 60 - HOUR_START - 1) * HOUR_H)
    gridRef.current.scrollTop = Math.max(0, scrollTop)
  }, [])

  // Current time indicator
  const now = new Date()
  const nowTop = ((now.getHours() + now.getMinutes() / 60 - HOUR_START) * HOUR_H)
  const isCurrentWeek = weekDays.some(d => isSameDay(d, today))

  return (
    <div className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-2xl overflow-hidden">
      {/* Day headers */}
      <div className="flex border-b border-slate-200/60 bg-slate-50/60">
        <div className="w-14 shrink-0 border-r border-slate-200/60" />
        {weekDays.map((day, i) => {
          const isToday = isSameDay(day, today)
          return (
            <div key={i} className="flex-1 py-3 text-center border-r border-slate-200/60 last:border-r-0">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{DAYS_FR[i]}</p>
              <div className={`w-8 h-8 mx-auto mt-1 rounded-full flex items-center justify-center ${isToday ? 'bg-[#006685]' : ''}`}>
                <p className={`text-sm font-bold ${isToday ? 'text-white' : 'text-[#0b1c30]'}`}>
                  {day.getDate()}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Scrollable grid */}
      <div ref={gridRef} className="overflow-y-auto" style={{ maxHeight: '600px' }}>
        <div className="flex relative">
          {/* Hours column */}
          <div className="w-14 shrink-0 border-r border-slate-200/60">
            {hours.map(h => (
              <div key={h} style={{ height: `${HOUR_H}px` }}
                className="border-b border-slate-100/60 flex items-start pt-1.5 pr-2 justify-end">
                <span className="text-[10px] font-semibold text-slate-400 leading-none">{h}:00</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((day, dayIdx) => {
            const dayApts = appointments.filter(apt => {
              const d = new Date(apt.scheduled_at)
              return isSameDay(d, day)
            })
            const isToday = isSameDay(day, today)

            return (
              <div key={dayIdx} className="flex-1 relative border-r border-slate-200/60 last:border-r-0"
                style={{ minHeight: `${(HOUR_END - HOUR_START) * HOUR_H}px` }}>
                {/* Hour lines */}
                {hours.map(h => (
                  <div key={h} style={{ top: `${(h - HOUR_START) * HOUR_H}px`, height: `${HOUR_H}px` }}
                    className="absolute left-0 right-0 border-b border-slate-100/60" />
                ))}

                {/* Half-hour lines */}
                {hours.map(h => (
                  <div key={`h${h}`} style={{ top: `${(h - HOUR_START) * HOUR_H + HOUR_H / 2}px` }}
                    className="absolute left-0 right-0 border-b border-dashed border-slate-100/40" />
                ))}

                {/* Today highlight */}
                {isToday && (
                  <div className="absolute inset-0 bg-sky-500/3 pointer-events-none" />
                )}

                {/* Current time line */}
                {isToday && isCurrentWeek && nowTop >= 0 && nowTop <= (HOUR_END - HOUR_START) * HOUR_H && (
                  <div className="absolute left-0 right-0 z-10 pointer-events-none flex items-center"
                    style={{ top: `${nowTop}px` }}>
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1.5 shrink-0" />
                    <div className="flex-1 h-px bg-red-400" />
                  </div>
                )}

                {/* Appointments */}
                {dayApts.map(apt => {
                  const dt = new Date(apt.scheduled_at)
                  const startH = dt.getHours() + dt.getMinutes() / 60
                  const topPx = (startH - HOUR_START) * HOUR_H
                  const heightPx = Math.max((apt.duration_min / 60) * HOUR_H, 28)
                  const meta = TYPE_META[apt.type] ?? TYPE_META.video

                  return (
                    <button key={apt.id} onClick={() => onSelect(apt)}
                      style={{
                        position: 'absolute', top: `${topPx + 2}px`, left: '3px', right: '3px',
                        height: `${heightPx - 4}px`, backgroundColor: meta.bg,
                        border: `1.5px solid ${meta.border}`, borderRadius: '8px',
                        padding: '4px 6px', overflow: 'hidden', cursor: 'pointer', textAlign: 'left',
                        zIndex: 5,
                      }}>
                      <p style={{ fontSize: '11px', fontWeight: 700, color: meta.text, lineHeight: 1.2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                        {apt.users?.full_name ?? 'Patient'}
                      </p>
                      {heightPx > 36 && (
                        <p style={{ fontSize: '10px', color: meta.text, opacity: 0.8, lineHeight: 1.2 }}>
                          {fmtTime(dt)} · {apt.duration_min}min
                        </p>
                      )}
                      {/* Status dot */}
                      <div style={{
                        position: 'absolute', top: '4px', right: '4px', width: '6px', height: '6px',
                        borderRadius: '50%', backgroundColor: STATUS_COLORS[apt.status].text,
                      }} />
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-3 border-t border-slate-100/60 bg-slate-50/40">
        {Object.entries(TYPE_META).map(([type, m]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: m.bg, border: `1.5px solid ${m.border}` }} />
            <span className="text-xs text-slate-500">{m.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-2">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <span className="text-xs text-slate-500">Maintenant</span>
        </div>
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AppointmentsPage() {
  const qc = useQueryClient()
  const [view, setView] = useState<ViewMode>('week')
  const [listFilter, setListFilter] = useState<'upcoming' | 'past'>('upcoming')
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  const [selected, setSelected] = useState<Appointment | null>(null)

  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart])

  const { data: weekApts = [], isLoading: weekLoading, error: weekError } = useWeekAppointments(weekStart)
  const { data: listApts = [], isLoading: listLoading, error: listError } = useListAppointments(listFilter)

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AptStatus }) => {
      const { error } = await supabase.from('appointments').update({ status }).eq('id', id)
      if (error) throw error
      void supabase.functions.invoke('on-appointment-status-change', {
        body: { appointment_id: id, new_status: status },
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pract-apts'] }),
  })

  const goToday = () => setWeekStart(getWeekStart(new Date()))
  const prevWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d) }
  const nextWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d) }

  const weekLabel = useMemo(() => {
    const end = new Date(weekStart); end.setDate(end.getDate() + 5)
    const opt = { day: 'numeric' as const, month: 'short' as const }
    return `${weekStart.toLocaleDateString('fr-FR', opt)} – ${end.toLocaleDateString('fr-FR', { ...opt, year: 'numeric' })}`
  }, [weekStart])

  const isCurrentWeek = isSameDay(weekStart, getWeekStart(new Date()))

  return (
    <div className="space-y-5 max-w-6xl">
      {selected && <DetailPanel apt={selected} onClose={() => setSelected(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1c30]">Rendez-vous</h1>
          <p className="text-sm text-[#6f787e] mt-0.5">Gérez vos consultations patients</p>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-3">
          <div className="flex gap-1 p-1 bg-[#e5eeff] rounded-xl">
            <button onClick={() => setView('week')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${view === 'week' ? 'bg-white text-[#006685] shadow-sm' : 'text-slate-500 hover:text-[#006685]'}`}>
              <Icon name="calendar_view_week" size={16} />
              Semaine
            </button>
            <button onClick={() => setView('list')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${view === 'list' ? 'bg-white text-[#006685] shadow-sm' : 'text-slate-500 hover:text-[#006685]'}`}>
              <Icon name="view_list" size={16} />
              Liste
            </button>
          </div>
        </div>
      </div>

      {/* ── VUE SEMAINE ── */}
      {view === 'week' && (
        <>
          {/* Week navigation */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={prevWeek} className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                <Icon name="chevron_left" size={18} color="#475569" />
              </button>
              <button onClick={nextWeek} className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                <Icon name="chevron_right" size={18} color="#475569" />
              </button>
              <span className="text-sm font-semibold text-[#0b1c30] ml-1">{weekLabel}</span>
            </div>
            <div className="flex items-center gap-2">
              {!isCurrentWeek && (
                <button onClick={goToday} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 text-[#006685] hover:bg-sky-50 transition-colors">
                  Aujourd'hui
                </button>
              )}
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
                {weekApts.length} RDV cette semaine
              </span>
            </div>
          </div>

          {weekError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
              {(weekError as Error).message}
            </div>
          )}

          {weekLoading ? (
            <div className="h-96 rounded-2xl bg-white/40 animate-pulse" />
          ) : (
            <WeekCalendar weekDays={weekDays} appointments={weekApts} onSelect={setSelected} />
          )}
        </>
      )}

      {/* ── VUE LISTE ── */}
      {view === 'list' && (
        <>
          <div className="flex gap-2 p-1 bg-[#e5eeff] rounded-xl w-fit">
            {(['upcoming', 'past'] as const).map(f => (
              <button key={f} onClick={() => setListFilter(f)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${listFilter === f ? 'bg-white text-[#006685] shadow-sm' : 'text-slate-500 hover:text-[#006685]'}`}>
                {f === 'upcoming' ? 'À venir' : 'Passés'}
              </button>
            ))}
          </div>

          {listError && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-700">
              {(listError as Error).message}
            </div>
          )}

          {listLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 rounded-2xl bg-white/40 animate-pulse" />)}
            </div>
          ) : listApts.length === 0 ? (
            <div className="rounded-2xl p-12 text-center bg-white/60 border border-white/80">
              <Icon name={listFilter === 'upcoming' ? 'calendar_today' : 'history'} size={40} color="#cbd5e1" />
              <p className="font-semibold text-[#0b1c30] mt-3">{listFilter === 'upcoming' ? 'Aucun rendez-vous à venir' : 'Aucun rendez-vous passé'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {listApts.map(apt => {
                const dt = new Date(apt.scheduled_at)
                const meta = TYPE_META[apt.type] ?? TYPE_META.video
                const sc = STATUS_COLORS[apt.status]
                return (
                  <div key={apt.id} className="rounded-2xl p-5 flex items-center gap-4 cursor-pointer hover:shadow-md transition-shadow bg-white/60 border border-white/80"
                    onClick={() => setSelected(apt)}>
                    <div className="w-14 h-14 rounded-xl flex flex-col items-center justify-center shrink-0"
                      style={{ background: meta.bg }}>
                      <span className="text-xl font-black leading-none" style={{ color: meta.text }}>
                        {dt.toLocaleDateString('fr-FR', { day: 'numeric', timeZone: 'Africa/Dakar' })}
                      </span>
                      <span className="text-[10px] font-bold uppercase" style={{ color: meta.text }}>
                        {dt.toLocaleDateString('fr-FR', { month: 'short', timeZone: 'Africa/Dakar' })}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-[#0b1c30]">{apt.users?.full_name ?? 'Patient'}</p>
                        <Icon name={meta.icon} size={14} color={meta.text} />
                      </div>
                      <p className="text-sm text-[#6f787e] capitalize">
                        {fmtDate(dt)} · {fmtTime(dt)} · {apt.duration_min} min
                      </p>
                    </div>
                    <span className="text-xs font-semibold px-3 py-1 rounded-full shrink-0"
                      style={{ background: sc.bg, color: sc.text }}>
                      {STATUS_LABELS[apt.status]}
                    </span>
                    {listFilter === 'upcoming' && apt.status === 'confirmed' && (
                      <Link href={`/practitioner/consultation/${apt.id}/waiting`}
                        onClick={e => e.stopPropagation()}
                        className="px-3 py-1.5 rounded-full text-xs font-bold text-white shrink-0"
                        style={{ background: '#006685' }}>
                        Rejoindre →
                      </Link>
                    )}
                    {listFilter === 'upcoming' && apt.status === 'pending' && (
                      <div className="flex gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                        <button onClick={() => updateStatus.mutate({ id: apt.id, status: 'confirmed' })}
                          disabled={updateStatus.isPending}
                          className="px-3 py-1.5 rounded-full text-xs font-bold text-white disabled:opacity-60"
                          style={{ background: '#1d7a3a' }}>
                          Confirmer
                        </button>
                        <button onClick={() => updateStatus.mutate({ id: apt.id, status: 'cancelled' })}
                          disabled={updateStatus.isPending}
                          className="px-3 py-1.5 rounded-full text-xs font-bold text-red-600 bg-red-50 border border-red-200 disabled:opacity-60">
                          Annuler
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
