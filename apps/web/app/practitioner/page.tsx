'use client'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface Appointment {
  id: string
  scheduled_at: string
  duration_min: number
  status: string
  type: string
  users: { full_name: string } | null
}

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return <span className="material-symbols-outlined" style={{ fontSize: `${size}px` }}>{name}</span>
}

const TYPE_ICONS: Record<string, string> = { video: 'videocam', audio: 'mic', chat: 'chat_bubble' }
const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-700',
  completed: 'bg-sky-100 text-sky-700',
  cancelled: 'bg-slate-100 text-slate-500',
  no_show: 'bg-red-100 text-red-700',
}
const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Confirmé', pending: 'En attente',
  completed: 'Terminé', cancelled: 'Annulé', no_show: 'Absent',
}

function useDashboard() {
  return useQuery({
    queryKey: ['practitioner-dashboard'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')

      const { data: pract, error: pErr } = await supabase
        .from('practitioners')
        .select('id, verification_status, is_verified, session_price, speciality')
        .eq('user_id', user.id)
        .single()

      if (pErr || !pract) throw new Error('Profil praticien introuvable. Connectez-vous avec un compte praticien.')

      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      // "Cette semaine" must mean the current calendar week (Mon–Sun), not a
      // rolling 7-day window — a rolling window pulled in next Monday's
      // appointment and counted it under "this week" whenever today wasn't
      // itself a Monday.
      const day = now.getDay()
      const daysUntilSunday = day === 0 ? 0 : 7 - day
      const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilSunday, 23, 59, 59, 999).toISOString()

      const { data: appointments } = await supabase
        .from('appointments')
        .select('id, scheduled_at, duration_min, status, type, users!patient_id(full_name)')
        .eq('practitioner_id', pract.id)
        .gte('scheduled_at', todayStart)
        .lte('scheduled_at', weekEnd)
        .not('status', 'in', '("cancelled","no_show")')
        .order('scheduled_at', { ascending: true })

      const { count: totalConfirmed } = await supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('practitioner_id', pract.id)
        .eq('status', 'confirmed')

      return {
        pract,
        appointments: (appointments ?? []) as unknown as Appointment[],
        totalConfirmed: totalConfirmed ?? 0,
      }
    },
  })
}

export default function PractitionerDashboard() {
  const { data, isLoading, error } = useDashboard()

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-white/40 animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">
        Erreur : {(error as Error).message}
      </div>
    )
  }

  const { appointments, totalConfirmed } = data!
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  const todayApts = appointments.filter(a => a.scheduled_at.startsWith(todayStr))
  const upcomingApts = appointments.filter(a => !a.scheduled_at.startsWith(todayStr))

  return (
    <div className="space-y-8 max-w-4xl">

      {/* KPI row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Aujourd'hui", value: todayApts.length, icon: 'today', color: '#82d8ff', bg: '#e5eeff' },
          { label: 'Cette semaine', value: appointments.length, icon: 'calendar_month', color: '#705d00', bg: '#fff8e1' },
          { label: 'Total confirmés', value: totalConfirmed, icon: 'check_circle', color: '#1d7a3a', bg: '#e8f5e9' },
        ].map(({ label, value, icon, color, bg }) => (
          <div
            key={label}
            className="rounded-2xl p-5 flex items-center gap-4"
            style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}
          >
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: bg }}>
              <Icon name={icon} size={22} />
            </div>
            <div>
              <p className="text-2xl font-black" style={{ color }}>{value}</p>
              <p className="text-xs text-[#6f787e] font-medium">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Aujourd'hui */}
      {todayApts.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-[#0b1c30] mb-3">Aujourd&apos;hui</h2>
          <div className="space-y-3">
            {todayApts.map(apt => {
              const dt = new Date(apt.scheduled_at)
              const time = dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
              return (
                <div
                  key={apt.id}
                  className="rounded-2xl p-4 flex items-center gap-4 border-l-4 border-[#82d8ff]"
                  style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}
                >
                  <div className="w-12 h-12 rounded-xl bg-[#e5eeff] flex flex-col items-center justify-center text-[#82d8ff] flex-shrink-0">
                    <span className="text-sm font-black leading-none">{time}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#0b1c30]">{apt.users?.full_name ?? 'Patient'}</p>
                    <p className="text-sm text-[#6f787e] flex items-center gap-1">
                      <Icon name={TYPE_ICONS[apt.type] ?? 'event'} size={14} />
                      {apt.duration_min} min · {apt.type}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${STATUS_COLORS[apt.status] ?? 'bg-slate-100 text-slate-600'}`}>
                    {STATUS_LABELS[apt.status] ?? apt.status}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Prochains RDV */}
      {upcomingApts.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-[#0b1c30] mb-3">Prochains rendez-vous</h2>
          <div className="space-y-3">
            {upcomingApts.map(apt => {
              const dt = new Date(apt.scheduled_at)
              const dateStr = dt.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
              const time = dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
              return (
                <div
                  key={apt.id}
                  className="rounded-2xl p-4 flex items-center gap-4"
                  style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}
                >
                  <div className="w-14 h-14 rounded-xl bg-[#e5eeff] flex flex-col items-center justify-center flex-shrink-0">
                    <span className="text-base font-black text-[#82d8ff] leading-none">{dt.getDate()}</span>
                    <span className="text-xs text-[#82d8ff] font-semibold uppercase">
                      {dt.toLocaleDateString('fr-FR', { month: 'short' })}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#0b1c30]">{apt.users?.full_name ?? 'Patient'}</p>
                    <p className="text-sm text-[#6f787e]">{dateStr} à {time} · {apt.duration_min} min</p>
                  </div>
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full flex-shrink-0 ${STATUS_COLORS[apt.status] ?? 'bg-slate-100 text-slate-600'}`}>
                    {STATUS_LABELS[apt.status] ?? apt.status}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {appointments.length === 0 && (
        <div
          className="rounded-2xl p-12 text-center"
          style={{ backgroundColor: 'rgba(255,255,255,0.60)', border: '1px solid rgba(255,255,255,0.80)' }}
        >
          <p className="text-4xl mb-3">📅</p>
          <p className="font-semibold text-[#0b1c30]">Aucun rendez-vous cette semaine</p>
          <p className="text-sm text-[#6f787e] mt-1">Assurez-vous que vos disponibilités sont bien configurées.</p>
          <Link
            href="/practitioner/availability"
            className="mt-4 inline-block px-5 py-2.5 bg-[#82d8ff] text-[#0b1c30] text-sm font-bold rounded-xl hover:shadow-lg hover:shadow-sky-500/20 transition-all"
          >
            Gérer mes disponibilités
          </Link>
        </div>
      )}

      {/* Shortcut */}
      <div className="flex gap-3">
        <Link
          href="/practitioner/appointments"
          className="flex-1 py-3 rounded-xl border border-slate-200/50 bg-white/60 text-sm font-semibold text-[#0b1c30] hover:bg-white transition-all text-center"
        >
          Tous les rendez-vous →
        </Link>
        <Link
          href="/practitioner/availability"
          className="flex-1 py-3 rounded-xl bg-[#82d8ff] text-[#0b1c30] text-sm font-semibold hover:shadow-lg hover:shadow-sky-500/20 transition-all text-center"
        >
          Gérer mes disponibilités
        </Link>
      </div>
    </div>
  )
}
