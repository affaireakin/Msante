'use client'
import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type AptStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'
type Filter = 'today' | 'upcoming' | 'past'

interface Appointment {
  id: string
  scheduled_at: string
  duration_min: number
  status: AptStatus
  type: 'video' | 'audio' | 'presentiel'
  patient: { full_name: string } | null
  practitioner: { speciality: string; users: { full_name: string } | null } | null
}

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
const TYPE_LABELS: Record<string, string> = { video: 'Vidéo', audio: 'Audio', presentiel: 'Présentiel' }

function Icon({ name, size = 18, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-symbols-outlined" style={{ fontSize: `${size}px`, color, lineHeight: 1 }}>{name}</span>
}

function fmtDateTime(iso: string) {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Dakar' }),
    time: d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Dakar' }),
  }
}

function useContext_() {
  return useQuery({
    queryKey: ['secretary-context'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return { name: '', context: '' }
      const { data: profile } = await supabase.from('users').select('full_name, organization_id').eq('id', user.id).single()
      if (profile?.organization_id) {
        const { data: org } = await supabase.from('organizations').select('name').eq('id', profile.organization_id).single()
        return { name: profile?.full_name ?? '', context: org?.name ?? '' }
      }
      const { data: link } = await supabase
        .from('practitioner_secretaries')
        .select('practitioner:practitioner_id(speciality, users!practitioners_user_id_fkey(full_name))')
        .eq('user_id', user.id)
        .eq('status', 'active')
      const names = (link ?? [])
        .map(l => (l.practitioner as unknown as { users: { full_name: string } | null })?.users?.full_name)
        .filter(Boolean)
      return { name: profile?.full_name ?? '', context: names.join(', ') }
    },
  })
}

function useAppointments(filter: Filter) {
  return useQuery<Appointment[]>({
    queryKey: ['secretary-appointments', filter],
    staleTime: 30_000,
    queryFn: async () => {
      const now = new Date()
      let q = supabase
        .from('appointments')
        .select(`
          id, scheduled_at, duration_min, status, type,
          patient:patient_id(full_name),
          practitioner:practitioner_id(speciality, users!practitioners_user_id_fkey(full_name))
        `)
        .order('scheduled_at', { ascending: filter !== 'past' })

      if (filter === 'today') {
        const start = new Date(now); start.setHours(0, 0, 0, 0)
        const end = new Date(now); end.setHours(23, 59, 59, 999)
        q = q.gte('scheduled_at', start.toISOString()).lte('scheduled_at', end.toISOString()).not('status', 'in', '("cancelled")')
      } else if (filter === 'upcoming') {
        q = q.gte('scheduled_at', now.toISOString()).not('status', 'in', '("cancelled","no_show","completed")')
      } else {
        q = q.lt('scheduled_at', now.toISOString()).limit(50)
      }

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as unknown as Appointment[]
    },
  })
}

function AppointmentRow({ apt }: { apt: Appointment }) {
  const qc = useQueryClient()
  const [rescheduling, setRescheduling] = useState(false)
  const [newTime, setNewTime] = useState(() => apt.scheduled_at.slice(0, 16))
  const { date, time } = fmtDateTime(apt.scheduled_at)
  const statusStyle = STATUS_COLORS[apt.status]

  const updateStatus = useMutation({
    mutationFn: async (status: AptStatus) => {
      const { error } = await supabase.from('appointments').update({ status }).eq('id', apt.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['secretary-appointments'] }),
  })

  const reschedule = useMutation({
    mutationFn: async (iso: string) => {
      const { error } = await supabase.from('appointments').update({ scheduled_at: new Date(iso).toISOString() }).eq('id', apt.id)
      if (error) throw error
    },
    onSuccess: () => { setRescheduling(false); qc.invalidateQueries({ queryKey: ['secretary-appointments'] }) },
  })

  return (
    <div className="rounded-2xl p-5 bg-white/70 border border-white/80 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-[#0b1c30]">{apt.patient?.full_name ?? 'Patient'}</p>
          <p className="text-xs text-[#6f787e] mt-0.5">
            {apt.practitioner?.users?.full_name ? `Dr. ${apt.practitioner.users.full_name}` : ''}
            {apt.practitioner?.speciality ? ` · ${apt.practitioner.speciality}` : ''}
          </p>
        </div>
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0" style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}>
          {STATUS_LABELS[apt.status]}
        </span>
      </div>

      <div className="flex items-center gap-4 text-sm text-[#3f484d]">
        <span className="flex items-center gap-1.5"><Icon name="calendar_today" size={14} color="#6f787e" />{date}</span>
        <span className="flex items-center gap-1.5"><Icon name="schedule" size={14} color="#6f787e" />{time}</span>
        <span className="flex items-center gap-1.5"><Icon name="videocam" size={14} color="#6f787e" />{TYPE_LABELS[apt.type]}</span>
      </div>

      {rescheduling ? (
        <div className="flex items-center gap-2 pt-1">
          <input
            type="datetime-local"
            value={newTime}
            onChange={e => setNewTime(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm flex-1"
          />
          <button onClick={() => reschedule.mutate(newTime)} disabled={reschedule.isPending}
            className="px-3 py-2 rounded-lg bg-[#82d8ff] text-[#0b1c30] text-sm font-bold">Valider</button>
          <button onClick={() => setRescheduling(false)} className="px-3 py-2 rounded-lg text-sm text-[#6f787e]">Annuler</button>
        </div>
      ) : (apt.status === 'pending' || apt.status === 'confirmed') && (
        <div className="flex items-center gap-2 pt-1 border-t border-slate-100 mt-1 pt-3">
          {apt.status === 'pending' && (
            <button onClick={() => updateStatus.mutate('confirmed')} disabled={updateStatus.isPending}
              className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100">Confirmer</button>
          )}
          <button onClick={() => setRescheduling(true)}
            className="px-3 py-1.5 rounded-lg bg-[#e5eeff] text-[#005e7a] text-xs font-bold hover:bg-[#d3e4fe]">Reporter</button>
          <button onClick={() => updateStatus.mutate('cancelled')} disabled={updateStatus.isPending}
            className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-bold hover:bg-red-100">Annuler le RDV</button>
        </div>
      )}
    </div>
  )
}

type AccessState = 'active' | 'pending' | 'rejected' | 'revoked'

export default function SecretaryPage() {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>('today')
  const [checking, setChecking] = useState(true)
  const [accessState, setAccessState] = useState<AccessState>('active')
  const ctx = useContext_()
  const { data: appointments, isLoading, error } = useAppointments(filter)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/auth/login'); return }
      const { data: profile } = await supabase.from('users').select('role, organization_id').eq('id', user.id).single()
      if (profile?.role !== 'secretary') { router.push('/auth/login'); return }

      // Org-attached secretaries go through the org's own RBAC/invite
      // approval — only personal (practitioner-invited) secretaries need
      // this admin-approval gate.
      if (!profile.organization_id) {
        const { data: links } = await supabase.from('practitioner_secretaries').select('status').eq('user_id', user.id)
        const hasActive = (links ?? []).some(l => l.status === 'active')
        if (!hasActive) {
          const hasPending = (links ?? []).some(l => l.status === 'pending')
          setAccessState(hasPending ? 'pending' : (links?.length ? 'rejected' : 'pending'))
        }
      }
      setChecking(false)
    })
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  if (checking) return (
    <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#82d8ff] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (accessState !== 'active') return (
    <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center space-y-4 bg-white/70 rounded-2xl p-8 border border-white/80">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${accessState === 'pending' ? 'bg-amber-100' : 'bg-red-100'}`}>
          <span className={`material-symbols-outlined text-3xl ${accessState === 'pending' ? 'text-amber-500' : 'text-red-500'}`}>
            {accessState === 'pending' ? 'hourglass_top' : 'block'}
          </span>
        </div>
        <h2 className="text-lg font-bold text-[#0b1c30]">
          {accessState === 'pending' ? 'Compte en attente de validation' : 'Accès refusé'}
        </h2>
        <p className="text-sm text-[#6f787e]">
          {accessState === 'pending'
            ? 'Un administrateur doit valider votre accès secrétaire avant que vous puissiez consulter les rendez-vous.'
            : 'Votre demande d\'accès secrétaire a été refusée ou révoquée par un administrateur.'}
        </p>
        <button onClick={handleLogout} className="text-sm text-[#6f787e] underline hover:text-[#0b1c30]">Se déconnecter</button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f8f9ff]">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#82d8ff]">Espace secrétaire</p>
            <h1 className="text-2xl font-black text-[#0b1c30] mt-1">Bonjour {ctx.data?.name ?? ''}</h1>
            {ctx.data?.context && <p className="text-sm text-[#6f787e] mt-0.5">{ctx.data.context}</p>}
          </div>
          <button onClick={handleLogout} className="text-sm font-semibold text-[#6f787e] hover:text-[#0b1c30]">Se déconnecter</button>
        </div>

        <div className="flex gap-2 mb-6">
          {([['today', "Aujourd'hui"], ['upcoming', 'À venir'], ['past', 'Passés']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                filter === key ? 'bg-[#82d8ff] text-[#0b1c30]' : 'bg-white/60 text-[#6f787e] border border-white/80'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 rounded-2xl bg-white/40 animate-pulse" />)}</div>
        ) : error ? (
          <div className="rounded-2xl px-5 py-4 bg-red-50 border border-red-100 text-sm text-red-700">Erreur de chargement : {(error as Error).message}</div>
        ) : (appointments ?? []).length === 0 ? (
          <div className="rounded-2xl p-12 text-center bg-white/60 border border-white/80">
            <Icon name="event_available" size={40} color="#bec8ce" />
            <p className="font-semibold text-[#0b1c30] mt-3">Aucun rendez-vous</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(appointments ?? []).map(apt => <AppointmentRow key={apt.id} apt={apt} />)}
          </div>
        )}
      </div>
    </div>
  )
}
