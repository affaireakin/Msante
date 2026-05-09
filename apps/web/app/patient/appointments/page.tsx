'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span className="material-symbols-outlined" style={style}>{name}</span>
}

type Filter = 'all' | 'upcoming' | 'completed' | 'cancelled'

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string; icon: string }> = {
  confirmed: { bg: '#e8f5e9', text: '#1d7a3a', label: 'Confirmé',  icon: 'check_circle' },
  pending:   { bg: '#fff8e1', text: '#705d00', label: 'En attente', icon: 'schedule' },
  completed: { bg: '#e5eeff', text: '#006685', label: 'Terminé',    icon: 'task_alt' },
  cancelled: { bg: '#ffdad6', text: '#ba1a1a', label: 'Annulé',     icon: 'cancel' },
  no_show:   { bg: '#ffdad6', text: '#ba1a1a', label: 'Absent',     icon: 'person_off' },
}

const TYPE_ICONS: Record<string, string> = { video: 'videocam', audio: 'mic', chat: 'chat_bubble' }

interface Appointment {
  id: string
  scheduled_at: string
  duration_min: number
  status: string
  type: string
  notes: string | null
  practitioners: { id: string; speciality: string; users: { full_name: string } | null } | null
}

function useAppointments(filter: Filter) {
  return useQuery({
    queryKey: ['patient-appointments', filter],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')

      let q = supabase
        .from('appointments')
        .select('id, scheduled_at, duration_min, status, type, notes, practitioners!inner(id, speciality, users!inner(full_name))')
        .eq('patient_id', user.id)
        .order('scheduled_at', { ascending: false })

      if (filter === 'upcoming') {
        q = q.gte('scheduled_at', new Date().toISOString()).in('status', ['pending', 'confirmed'])
      } else if (filter === 'completed') {
        q = q.eq('status', 'completed')
      } else if (filter === 'cancelled') {
        q = q.in('status', ['cancelled', 'no_show'])
      }

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as unknown as Appointment[]
    },
  })
}

export default function AppointmentsPage() {
  const [filter, setFilter] = useState<Filter>('all')
  const { data = [], isLoading } = useAppointments(filter)

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: 'Tous' },
    { key: 'upcoming', label: 'À venir' },
    { key: 'completed', label: 'Terminés' },
    { key: 'cancelled', label: 'Annulés' },
  ]

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#0b1c30]">Mes rendez-vous</h1>
          <p className="text-sm text-[#6f787e] mt-1">{data.length} rendez-vous</p>
        </div>
        <Link href="/patient/practitioners" className="flex items-center gap-2 px-5 py-2.5 bg-[#006685] text-white text-sm font-bold rounded-xl hover:shadow-lg hover:shadow-[#006685]/20 transition-all">
          <Icon name="add" style={{ fontSize: '18px' }} />
          Nouveau RDV
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className="px-4 py-2 rounded-full text-xs font-bold transition-all"
            style={{
              backgroundColor: filter === f.key ? '#006685' : 'rgba(255,255,255,0.70)',
              color: filter === f.key ? '#fff' : '#6f787e',
              border: filter === f.key ? 'none' : '1px solid rgba(190,200,206,0.50)',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-24 rounded-2xl bg-white/40 animate-pulse" />)}
        </div>
      ) : data.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.60)', border: '1px solid rgba(255,255,255,0.80)' }}>
          <Icon name="calendar_today" style={{ fontSize: '48px', color: '#bec8ce' }} />
          <p className="font-semibold text-[#0b1c30] mt-3">Aucun rendez-vous</p>
          <Link href="/patient/practitioners" className="mt-4 inline-block px-6 py-2.5 bg-[#006685] text-white text-sm font-bold rounded-xl hover:shadow-lg hover:shadow-[#006685]/20 transition-all">
            Réserver maintenant
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map(apt => {
            const dt = new Date(apt.scheduled_at)
            const dateStr = dt.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
            const time = dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
            const status = STATUS_CONFIG[apt.status] ?? STATUS_CONFIG.pending
            const practName = apt.practitioners?.users?.full_name ?? '—'
            const typeIcon = TYPE_ICONS[apt.type] ?? 'event'
            const isPast = dt < new Date()

            return (
              <div key={apt.id} className="rounded-2xl p-5 flex items-center gap-4" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)', opacity: isPast && apt.status === 'pending' ? 0.7 : 1 }}>
                <div className="w-16 h-16 rounded-xl bg-[#e5eeff] flex flex-col items-center justify-center flex-shrink-0">
                  <span className="text-xl font-black text-[#006685] leading-none">{dt.getDate()}</span>
                  <span className="text-xs text-[#006685] font-semibold uppercase">
                    {dt.toLocaleDateString('fr-FR', { month: 'short' })}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[#0b1c30]">{practName}</p>
                  <p className="text-sm text-[#6f787e]">{apt.practitioners?.speciality}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Icon name={typeIcon} style={{ fontSize: '14px', color: '#6f787e' }} />
                    <span className="text-xs text-[#6f787e]">{dateStr} · {time} · {apt.duration_min} min</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full" style={{ backgroundColor: status.bg, color: status.text }}>
                    <Icon name={status.icon} style={{ fontSize: '13px' }} />
                    {status.label}
                  </span>
                  {apt.status === 'confirmed' && !isPast && (
                    <Link href={`/practitioner/consultation/${apt.id}/waiting`} className="text-xs font-bold text-[#006685] hover:underline">
                      Rejoindre →
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
