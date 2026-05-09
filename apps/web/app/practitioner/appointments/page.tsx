'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

type AptStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'

interface Appointment {
  id: string
  scheduled_at: string
  duration_min: number
  status: AptStatus
  type: 'video' | 'audio' | 'chat'
  users: { full_name: string } | null
}

const STATUS_LABELS: Record<AptStatus, string> = {
  pending: 'En attente',
  confirmed: 'Confirmé',
  cancelled: 'Annulé',
  completed: 'Terminé',
  no_show: 'Absent',
}
const STATUS_COLORS: Record<AptStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-slate-100 text-slate-500',
  completed: 'bg-sky-100 text-sky-700',
  no_show: 'bg-red-100 text-red-700',
}
const TYPE_ICONS: Record<string, string> = { video: '📹', audio: '🎙️', chat: '💬' }

function useAppointments(filter: 'upcoming' | 'past') {
  return useQuery({
    queryKey: ['practitioner-appointments', filter],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')
      const { data: pract } = await supabase
        .from('practitioners').select('id').eq('user_id', user.id).single()
      if (!pract) throw new Error('Profil praticien introuvable')

      const now = new Date().toISOString()
      let query = supabase
        .from('appointments')
        .select('id, scheduled_at, duration_min, status, type, users!patient_id(full_name)')
        .eq('practitioner_id', pract.id)
        .order('scheduled_at', { ascending: filter === 'upcoming' })

      if (filter === 'upcoming') {
        query = query.gte('scheduled_at', now).not('status', 'in', '("cancelled","no_show")')
      } else {
        query = query.lt('scheduled_at', now).limit(20)
      }

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as unknown as Appointment[]
    },
    staleTime: 60_000,
  })
}

export default function AppointmentsPage() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<'upcoming' | 'past'>('upcoming')
  const { data: appointments, isLoading, error } = useAppointments(filter)

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AptStatus }) => {
      const { error } = await supabase.from('appointments').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['practitioner-appointments'] })
    },
  })

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1c30]">Rendez-vous</h1>
          <p className="text-sm text-[#6f787e] mt-1">Gérez vos consultations patients</p>
        </div>
        <div className="flex gap-2 p-1 bg-[#e5eeff] rounded-xl">
          {(['upcoming', 'past'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                filter === f ? 'bg-white text-[#006685] shadow-sm' : 'text-slate-500 hover:text-[#006685]'
              }`}
            >
              {f === 'upcoming' ? 'À venir' : 'Passés'}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-700">
          {(error as Error).message}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-white/40 animate-pulse" />
          ))}
        </div>
      ) : (appointments ?? []).length === 0 ? (
        <div
          className="rounded-2xl p-12 text-center"
          style={{ backgroundColor: 'rgba(255,255,255,0.60)', border: '1px solid rgba(255,255,255,0.80)' }}
        >
          <p className="text-4xl mb-3">{filter === 'upcoming' ? '📅' : '🗂️'}</p>
          <p className="font-semibold text-[#0b1c30]">
            {filter === 'upcoming' ? 'Aucun rendez-vous à venir' : 'Aucun rendez-vous passé'}
          </p>
          <p className="text-sm text-[#6f787e] mt-1">
            {filter === 'upcoming' ? 'Les nouvelles réservations apparaîtront ici.' : 'Votre historique de consultations.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {(appointments ?? []).map(apt => {
            const dt = new Date(apt.scheduled_at)
            const dateStr = dt.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
            const timeStr = dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

            return (
              <div
                key={apt.id}
                className="rounded-2xl p-5 flex items-center gap-5"
                style={{ backgroundColor: 'rgba(255,255,255,0.60)', border: '1px solid rgba(255,255,255,0.80)' }}
              >
                {/* Date block */}
                <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-[#e5eeff] flex flex-col items-center justify-center text-[#006685]">
                  <span className="text-xl font-black leading-none">{dt.getDate()}</span>
                  <span className="text-xs font-semibold uppercase">
                    {dt.toLocaleDateString('fr-FR', { month: 'short' })}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-[#0b1c30]">{apt.users?.full_name ?? 'Patient'}</p>
                    <span className="text-sm">{TYPE_ICONS[apt.type] ?? '📋'}</span>
                  </div>
                  <p className="text-sm text-[#6f787e]">{dateStr} · {timeStr} · {apt.duration_min} min</p>
                </div>

                {/* Status badge */}
                <span className={`text-xs font-semibold px-3 py-1 rounded-full flex-shrink-0 ${STATUS_COLORS[apt.status]}`}>
                  {STATUS_LABELS[apt.status]}
                </span>

                {/* Actions (upcoming confirmed only) */}
                {filter === 'upcoming' && apt.status === 'confirmed' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => updateStatus.mutate({ id: apt.id, status: 'completed' })}
                      disabled={updateStatus.isPending}
                      className="px-3 py-1.5 bg-sky-100 text-sky-700 text-xs font-semibold rounded-full hover:bg-sky-200 transition-colors disabled:opacity-50"
                    >
                      Terminé
                    </button>
                    <button
                      onClick={() => updateStatus.mutate({ id: apt.id, status: 'no_show' })}
                      disabled={updateStatus.isPending}
                      className="px-3 py-1.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full hover:bg-red-200 transition-colors disabled:opacity-50"
                    >
                      Absent
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
