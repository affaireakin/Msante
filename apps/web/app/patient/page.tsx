'use client'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span className="material-symbols-outlined" style={style}>{name}</span>
}

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  confirmed: { bg: '#e8f5e9', text: '#1d7a3a', label: 'Confirmé' },
  pending:   { bg: '#fff8e1', text: '#705d00', label: 'En attente' },
  completed: { bg: '#e5eeff', text: '#006685', label: 'Terminé' },
  cancelled: { bg: '#ffdad6', text: '#ba1a1a', label: 'Annulé' },
}

const TYPE_ICONS: Record<string, string> = { video: 'videocam', audio: 'mic', chat: 'chat_bubble' }

function useDashboard() {
  return useQuery({
    queryKey: ['patient-dashboard'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')

      const { data: profile } = await supabase
        .from('users').select('full_name').eq('id', user.id).single()

      const { data: appointments } = await supabase
        .from('appointments')
        .select('id, scheduled_at, duration_min, status, type, practitioners!inner(speciality, users!inner(full_name))')
        .eq('patient_id', user.id)
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(5) as { data: any[] | null }

      const { count: totalAppts } = await supabase
        .from('appointments').select('id', { count: 'exact', head: true })
        .eq('patient_id', user.id).not('status', 'in', '("cancelled")')

      const { count: completedAppts } = await supabase
        .from('appointments').select('id', { count: 'exact', head: true })
        .eq('patient_id', user.id).eq('status', 'completed')

      return {
        name: profile?.full_name ?? '',
        appointments: appointments ?? [],
        totalAppts: totalAppts ?? 0,
        completedAppts: completedAppts ?? 0,
      }
    },
  })
}

export default function PatientDashboard() {
  const { data, isLoading, error } = useDashboard()

  if (isLoading) return (
    <div className="space-y-4">
      {[1,2,3].map(i => <div key={i} className="h-24 rounded-2xl bg-white/40 animate-pulse" />)}
    </div>
  )

  if (error) return (
    <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">
      Erreur : {(error as Error).message}
    </div>
  )

  const firstName = data!.name.split(' ')[0] || 'vous'
  const { appointments, totalAppts, completedAppts } = data!

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-[#0b1c30]">Bonjour, {firstName} 👋</h1>
        <p className="text-sm text-[#6f787e] mt-1">Votre tableau de bord santé</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Prochains RDV', value: appointments.length, icon: 'calendar_today', color: '#006685', bg: '#e5eeff' },
          { label: 'Total consultations', value: totalAppts, icon: 'medical_services', color: '#705d00', bg: '#fff8e1' },
          { label: 'Sessions terminées', value: completedAppts, icon: 'check_circle', color: '#1d7a3a', bg: '#e8f5e9' },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-2xl p-5 flex items-center gap-4" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: kpi.bg }}>
              <Icon name={kpi.icon} style={{ color: kpi.color, fontSize: '22px' }} />
            </div>
            <div>
              <p className="text-2xl font-black" style={{ color: kpi.color }}>{kpi.value}</p>
              <p className="text-xs text-[#6f787e] font-medium">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Upcoming appointments */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#0b1c30]">Prochains rendez-vous</h2>
          <Link href="/patient/appointments" className="text-xs font-bold text-[#006685] hover:underline uppercase tracking-wide">
            Voir tout
          </Link>
        </div>

        {appointments.length === 0 ? (
          <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.60)', border: '1px solid rgba(255,255,255,0.80)' }}>
            <Icon name="calendar_today" style={{ fontSize: '48px', color: '#bec8ce' }} />
            <p className="font-semibold text-[#0b1c30] mt-3">Aucun rendez-vous à venir</p>
            <p className="text-sm text-[#6f787e] mt-1">Trouvez un praticien et réservez votre première session</p>
            <Link href="/patient/practitioners" className="mt-4 inline-block px-6 py-2.5 bg-[#006685] text-white text-sm font-bold rounded-xl hover:shadow-lg hover:shadow-[#006685]/20 transition-all">
              Trouver un praticien
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {appointments.map((apt: any) => {
              const dt = new Date(apt.scheduled_at)
              const dateStr = dt.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
              const time = dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
              const status = STATUS_COLORS[apt.status] ?? STATUS_COLORS.pending
              const practName = apt.practitioners?.users?.full_name ?? '—'
              const typeIcon = TYPE_ICONS[apt.type] ?? 'event'
              return (
                <div key={apt.id} className="rounded-2xl p-4 flex items-center gap-4" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
                  <div className="w-14 h-14 rounded-xl bg-[#e5eeff] flex flex-col items-center justify-center flex-shrink-0">
                    <span className="text-base font-black text-[#006685] leading-none">{dt.getDate()}</span>
                    <span className="text-xs text-[#006685] font-semibold uppercase">
                      {dt.toLocaleDateString('fr-FR', { month: 'short' })}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#0b1c30]">{practName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Icon name={typeIcon} style={{ fontSize: '14px', color: '#6f787e' }} />
                      <p className="text-sm text-[#6f787e]">{dateStr} à {time} · {apt.duration_min} min</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 rounded-full flex-shrink-0" style={{ backgroundColor: status.bg, color: status.text }}>
                    {status.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-lg font-bold text-[#0b1c30] mb-4">Actions rapides</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { href: '/patient/practitioners', icon: 'search', label: 'Trouver un praticien', color: '#006685', bg: '#e5eeff' },
            { href: '/patient/appointments', icon: 'calendar_today', label: 'Mes rendez-vous', color: '#705d00', bg: '#fff8e1' },
            { href: '/patient/wellness', icon: 'self_improvement', label: 'Bien-être', color: '#1d7a3a', bg: '#e8f5e9' },
            { href: '/patient/book', icon: 'add_circle', label: 'Nouveau RDV', color: '#006685', bg: '#e5eeff' },
          ].map(action => (
            <Link key={action.href} href={action.href} className="rounded-2xl p-5 flex flex-col items-center gap-3 text-center hover:-translate-y-1 hover:shadow-lg transition-all" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: action.bg }}>
                <Icon name={action.icon} style={{ color: action.color, fontSize: '22px' }} />
              </div>
              <span className="text-sm font-semibold text-[#0b1c30]">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
