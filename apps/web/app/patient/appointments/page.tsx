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
  completed: { bg: '#e5eeff', text: '#82d8ff', label: 'Terminé',    icon: 'task_alt' },
  cancelled: { bg: '#ffdad6', text: '#ba1a1a', label: 'Annulé',     icon: 'cancel' },
  no_show:   { bg: '#ffdad6', text: '#ba1a1a', label: 'Absent',     icon: 'person_off' },
}

const TYPE_ICONS: Record<string, string> = { video: 'videocam', audio: 'mic', chat: 'chat_bubble' }

interface PractDoc {
  id: string
  document_type: string
}

interface Appointment {
  id: string
  scheduled_at: string
  duration_min: number
  status: string
  type: string
  notes: string | null
  practitioners: { id: string; speciality: string; users: { full_name: string } | null } | null
  consultations: { id: string; practitioner_documents: PractDoc[] }[] | null
}

const DOC_TYPE_SHORT: Record<string, string> = {
  prescription: 'Ordonnance',
  report: 'Compte-rendu',
  appreciation: 'Appréciation',
  certificate: 'Certificat',
}

function useAppointments(filter: Filter) {
  return useQuery({
    queryKey: ['patient-appointments', filter],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')

      let q = supabase
        .from('appointments')
        .select('id, scheduled_at, duration_min, status, type, notes, practitioners!inner(id, speciality, users!user_id(full_name)), consultations(id, practitioner_documents(id, document_type))')
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
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-[#0b1c30]">Mes rendez-vous</h1>
          <p className="text-sm text-[#6f787e] mt-1">{data.length} rendez-vous</p>
        </div>
        <Link href="/patient/practitioners" className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 bg-[#82d8ff] text-[#0b1c30] text-sm font-bold rounded-xl hover:shadow-lg hover:shadow-[#82d8ff]/20 transition-all">
          <Icon name="add" style={{ fontSize: '18px' }} />
          <span className="hidden sm:inline">Nouveau RDV</span>
          <span className="sm:hidden">Nouveau</span>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className="flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all"
            style={{
              backgroundColor: filter === f.key ? '#82d8ff' : 'rgba(255,255,255,0.70)',
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
          <Link href="/patient/practitioners" className="mt-4 inline-block px-6 py-2.5 bg-[#82d8ff] text-[#0b1c30] text-sm font-bold rounded-xl hover:shadow-lg hover:shadow-[#82d8ff]/20 transition-all">
            Réserver maintenant
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map(apt => {
            const dt = new Date(apt.scheduled_at)
            const tz = { timeZone: 'Africa/Dakar' }
            const dateStr = dt.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', ...tz })
            const time = dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', ...tz })
            const isPast = dt < new Date()
            // Past confirmed/pending appointments are shown as "Terminé" (derived from date, DB untouched)
            const effStatus = (apt.status === 'confirmed' || apt.status === 'pending') && isPast ? 'completed' : apt.status
            const status = STATUS_CONFIG[effStatus] ?? STATUS_CONFIG.pending
            const practName = apt.practitioners?.users?.full_name ?? '—'
            const typeIcon = TYPE_ICONS[apt.type] ?? 'event'
            const docs = apt.consultations?.[0]?.practitioner_documents ?? []

            return (
              <div key={apt.id} className="rounded-2xl p-4 sm:p-5 flex items-start gap-3 sm:gap-4" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)', opacity: isPast && apt.status === 'pending' ? 0.7 : 1 }}>
                {/* Date box */}
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-[#e5eeff] flex flex-col items-center justify-center flex-shrink-0">
                  <span className="text-lg sm:text-xl font-black text-[#82d8ff] leading-none">{dt.getDate()}</span>
                  <span className="text-[10px] sm:text-xs text-[#82d8ff] font-semibold uppercase">
                    {dt.toLocaleDateString('fr-FR', { month: 'short', timeZone: 'Africa/Dakar' })}
                  </span>
                </div>

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-[#0b1c30] truncate">{practName}</p>
                      <p className="text-xs sm:text-sm text-[#6f787e] truncate">{apt.practitioners?.speciality}</p>
                    </div>
                    {/* Status badge — on the right, inline with name */}
                    <span className="flex-shrink-0 flex items-center gap-1 text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-1 rounded-full" style={{ backgroundColor: status.bg, color: status.text }}>
                      <Icon name={status.icon} style={{ fontSize: '12px' }} />
                      <span className="hidden xs:inline">{status.label}</span>
                    </span>
                  </div>

                  {/* Date + time + duration on separate lines for mobile */}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Icon name={typeIcon} style={{ fontSize: '13px', color: '#6f787e' }} />
                    <div className="text-xs text-[#6f787e] min-w-0">
                      <span className="block sm:inline capitalize">{dateStr}</span>
                      <span className="sm:before:content-['_·_']">{time} · {apt.duration_min} min</span>
                    </div>
                  </div>

                  {/* Documents */}
                  {docs.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {docs.map(doc => (
                        <Link
                          key={doc.id}
                          href={`/patient/document/${doc.id}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 text-xs font-bold text-[#82d8ff] bg-[#e5eeff] px-2 py-0.5 rounded-full hover:bg-[#d3e4fe] transition-colors"
                        >
                          <Icon name="description" style={{ fontSize: '12px' }} />
                          {DOC_TYPE_SHORT[doc.document_type] ?? 'Document'}
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Join link */}
                  {apt.status === 'confirmed' && !isPast && (
                    <Link href={`/patient/consultation/${apt.id}/waiting`} className="inline-flex items-center gap-1 mt-2 text-xs font-bold text-[#82d8ff] hover:underline">
                      <Icon name="video_call" style={{ fontSize: '14px' }} />
                      Rejoindre la consultation →
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
