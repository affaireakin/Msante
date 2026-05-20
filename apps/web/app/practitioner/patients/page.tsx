'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

interface AppointmentWithUser {
  patient_id: string
  scheduled_at: string
  users: {
    id: string
    full_name: string
    phone: string | null
    country: string | null
    created_at: string
  } | null
}

function Icon({ name, size = 18, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-symbols-outlined" style={{ fontSize: `${size}px`, color }}>{name}</span>
}

interface Patient {
  id: string
  full_name: string
  phone: string | null
  country: string | null
  created_at: string
  lastAppt: string | null
  totalAppts: number
  medicalProfile: { blood_type: string | null; allergies: string[] } | null
  // enriched fields
  moodAvg: number | null
  lastSessionDate: string | null   // ISO string of last completed appointment
  nextApptDate: string | null      // ISO string of next upcoming confirmed/pending appointment
}

interface MoodRow {
  patient_id: string
  score: number
}

interface ApptRow {
  patient_id: string
  scheduled_at: string
  status?: string
}

/** Color coding for mood badge */
function moodStyle(score: number): { bg: string; text: string } {
  if (score >= 7) return { bg: '#e8f5e9', text: '#1d7a3a' }
  if (score >= 4) return { bg: '#fff8e1', text: '#705d00' }
  return { bg: '#ffdad6', text: '#ba1a1a' }
}

function usePatients() {
  return useQuery<Patient[], Error>({
    queryKey: ['practitioner-patients'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')

      const { data: pract } = await supabase
        .from('practitioners').select('id').eq('user_id', user.id).single()
      if (!pract) throw new Error('Profil praticien introuvable')

      const practitionerId: string = pract.id

      const { data: apts, error } = await supabase
        .from('appointments')
        .select('patient_id, scheduled_at, users!patient_id(id, full_name, phone, country, created_at)')
        .eq('practitioner_id', practitionerId)
        .not('status', 'in', '("cancelled")')
        .order('scheduled_at', { ascending: false })

      if (error) throw error

      const patientMap: Record<string, { user: { id: string; full_name: string; phone: string | null; country: string | null; created_at: string }; apts: string[] }> = {}
      for (const a of (apts ?? []) as unknown as AppointmentWithUser[]) {
        const u = a.users
        if (!u) continue
        if (!patientMap[u.id]) patientMap[u.id] = { user: u, apts: [] }
        patientMap[u.id].apts.push(a.scheduled_at)
      }

      const patientIds = Object.keys(patientMap)

      if (!patientIds.length) {
        return []
      }

      // Parallel batch queries
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const nowIso = new Date().toISOString()

      const [medResult, moodResult, lastSessionResult, nextApptResult] = await Promise.all([
        patientIds.length
          ? supabase.from('patient_medical_profiles')
              .select('patient_id, blood_type, allergies')
              .in('patient_id', patientIds)
          : Promise.resolve({ data: [] as Array<{ patient_id: string; blood_type: string | null; allergies: string[] }>, error: null }),

        supabase.from('mood_entries')
          .select('patient_id, score')
          .in('patient_id', patientIds)
          .gte('entry_date', sevenDaysAgo),

        supabase.from('appointments')
          .select('patient_id, scheduled_at')
          .in('patient_id', patientIds)
          .eq('practitioner_id', practitionerId)
          .eq('status', 'completed')
          .order('scheduled_at', { ascending: false })
          .limit(patientIds.length * 3),

        supabase.from('appointments')
          .select('patient_id, scheduled_at, status')
          .in('patient_id', patientIds)
          .eq('practitioner_id', practitionerId)
          .in('status', ['confirmed', 'pending'])
          .gte('scheduled_at', nowIso)
          .order('scheduled_at', { ascending: true })
          .limit(patientIds.length * 3),
      ])

      // Build lookup maps
      const medMap: Record<string, { blood_type: string | null; allergies: string[] }> = {}
      for (const m of (medResult.data ?? [])) {
        medMap[m.patient_id] = { blood_type: m.blood_type, allergies: m.allergies ?? [] }
      }

      // Mood average per patient
      const moodSumMap: Record<string, { sum: number; count: number }> = {}
      for (const row of ((moodResult.data ?? []) as MoodRow[])) {
        if (!moodSumMap[row.patient_id]) moodSumMap[row.patient_id] = { sum: 0, count: 0 }
        moodSumMap[row.patient_id].sum += row.score
        moodSumMap[row.patient_id].count += 1
      }

      // Last completed session per patient (results already ordered desc, take first seen)
      const lastSessionMap: Record<string, string> = {}
      for (const row of ((lastSessionResult.data ?? []) as ApptRow[])) {
        if (!lastSessionMap[row.patient_id]) {
          lastSessionMap[row.patient_id] = row.scheduled_at
        }
      }

      // Next upcoming appointment per patient (results already ordered asc, take first seen)
      const nextApptMap: Record<string, string> = {}
      for (const row of ((nextApptResult.data ?? []) as ApptRow[])) {
        if (!nextApptMap[row.patient_id]) {
          nextApptMap[row.patient_id] = row.scheduled_at
        }
      }

      return Object.values(patientMap).map(({ user: u, apts: dates }) => {
        const moodEntry = moodSumMap[u.id]
        return {
          id: u.id,
          full_name: u.full_name ?? '—',
          phone: u.phone,
          country: u.country,
          created_at: u.created_at,
          lastAppt: dates[0] ?? null,
          totalAppts: dates.length,
          medicalProfile: medMap[u.id] ?? null,
          moodAvg: moodEntry ? Math.round((moodEntry.sum / moodEntry.count) * 10) / 10 : null,
          lastSessionDate: lastSessionMap[u.id] ?? null,
          nextApptDate: nextApptMap[u.id] ?? null,
        }
      }) satisfies Patient[]
    },
  })
}

interface Designation {
  patient_id: string
  referring_doctor_status: 'pending' | 'accepted' | 'refused'
  patient: { id: string; full_name: string; phone: string | null }
}

function useDesignations(practId: string | null) {
  return useQuery<Designation[]>({
    queryKey: ['referring-designations', practId],
    enabled: !!practId,
    queryFn: async () => {
      const { data } = await supabase
        .from('users')
        .select('id, full_name, phone, referring_doctor_status, practitioners!users_referring_doctor_id_fkey!inner(id)')
        .eq('practitioners.id', practId!)
        .in('referring_doctor_status', ['pending', 'accepted'])
      return (data ?? []).map(u => ({
        patient_id: u.id,
        referring_doctor_status: u.referring_doctor_status as 'pending' | 'accepted',
        patient: { id: u.id, full_name: u.full_name, phone: u.phone },
      }))
    },
  })
}

/** Format ISO date as "dd MMM" in French */
function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

/** Format ISO datetime as "dd MMM à HH:mm" in French */
function fmtDayTime(iso: string): string {
  const d = new Date(iso)
  const day = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return `${day} à ${time}`
}

export default function PatientsPage() {
  const { data: patients = [], isLoading, isError, error } = usePatients()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Patient | null>(null)
  const qc = useQueryClient()

  const { data: userId } = useQuery({
    queryKey: ['auth-user-id'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      return user?.id ?? null
    },
    staleTime: 10 * 60 * 1000,
  })

  const { data: practId } = useQuery({
    queryKey: ['my-pract-id', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.from('practitioners').select('id').eq('user_id', userId!).single()
      return data?.id ?? null
    },
    staleTime: 10 * 60 * 1000,
  })

  const { data: designations = [] } = useDesignations(practId ?? null)

  const respondDesignation = useMutation({
    mutationFn: async ({ patientId, accept }: { patientId: string; accept: boolean }) => {
      await supabase.from('users').update({
        referring_doctor_status: accept ? 'accepted' : 'refused',
      }).eq('id', patientId)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['referring-designations'] }),
  })

  const pendingDesignations = designations.filter(d => d.referring_doctor_status === 'pending')

  type StatusFilter = 'tous' | 'rdv_prochain' | 'humeur_basse' | 'a_recontacter'
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('tous')

  const searched = patients.filter(p =>
    p.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (p.phone ?? '').includes(search)
  )

  const filtered = searched.filter(p => {
    if (statusFilter === 'tous') return true
    if (statusFilter === 'rdv_prochain') return !!p.nextApptDate
    if (statusFilter === 'humeur_basse') return p.moodAvg !== null && p.moodAvg < 4
    if (statusFilter === 'a_recontacter') return !p.nextApptDate && !!p.lastSessionDate
    return true
  })

  const STATUS_TABS: { id: StatusFilter; label: string; icon: string; count: number }[] = [
    { id: 'tous', label: 'Tous', icon: 'group', count: searched.length },
    { id: 'rdv_prochain', label: 'RDV à venir', icon: 'calendar_clock', count: searched.filter(p => !!p.nextApptDate).length },
    { id: 'humeur_basse', label: 'Humeur basse', icon: 'sentiment_dissatisfied', count: searched.filter(p => p.moodAvg !== null && p.moodAvg < 4).length },
    { id: 'a_recontacter', label: 'À recontacter', icon: 'person_search', count: searched.filter(p => !p.nextApptDate && !!p.lastSessionDate).length },
  ]

  return (
    <div className="space-y-6 max-w-6xl" style={{ fontFamily: 'Manrope' }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#0b1c30]">Mes patients</h1>
          <p className="text-sm text-[#6f787e] mt-1">{patients.length} patient{patients.length !== 1 ? 's' : ''} suivi{patients.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Désignations médecin traitant */}
      {pendingDesignations.length > 0 && (
        <div className="rounded-2xl p-5 space-y-3" style={{ backgroundColor: 'rgba(255,225,112,0.15)', border: '1px solid rgba(255,225,112,0.50)' }}>
          <div className="flex items-center gap-2">
            <Icon name="medical_information" size={16} color="#705d00" />
            <p className="text-sm font-bold text-[#705d00]">
              {pendingDesignations.length} demande{pendingDesignations.length > 1 ? 's' : ''} de désignation médecin traitant
            </p>
          </div>
          <div className="space-y-2">
            {pendingDesignations.map(d => {
              const initials = d.patient.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
              return (
                <div key={d.patient_id} className="flex items-center gap-3 bg-white/60 rounded-xl px-4 py-3">
                  <div className="w-9 h-9 rounded-full bg-[#705d00] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#0b1c30] truncate">{d.patient.full_name}</p>
                    {d.patient.phone && <p className="text-xs text-[#6f787e]">{d.patient.phone}</p>}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => respondDesignation.mutate({ patientId: d.patient_id, accept: false })}
                      disabled={respondDesignation.isPending}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border border-[#ba1a1a] text-[#ba1a1a] hover:bg-[#ffdad6] transition-colors disabled:opacity-50"
                    >
                      <Icon name="close" size={13} color="#ba1a1a" />
                      Refuser
                    </button>
                    <button
                      onClick={() => respondDesignation.mutate({ patientId: d.patient_id, accept: true })}
                      disabled={respondDesignation.isPending}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-[#006685] text-white hover:bg-[#005070] transition-colors disabled:opacity-50"
                    >
                      <Icon name="check" size={13} color="#fff" />
                      Accepter
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recherche */}
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/70 border border-white/80" style={{ boxShadow: '0 2px 8px rgba(0,102,133,0.04)' }}>
        <Icon name="search" color="#6f787e" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par nom ou téléphone..."
          className="bg-transparent flex-1 text-sm text-[#0b1c30] placeholder-[#6f787e] outline-none"
        />
        {search && (
          <button onClick={() => setSearch('')} className="text-[#6f787e] hover:text-[#0b1c30]">
            <Icon name="close" size={16} />
          </button>
        )}
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all"
            style={{
              backgroundColor: statusFilter === tab.id ? '#006685' : 'rgba(255,255,255,0.70)',
              color: statusFilter === tab.id ? '#fff' : '#6f787e',
              border: `1px solid ${statusFilter === tab.id ? '#006685' : 'rgba(255,255,255,0.80)'}`,
              boxShadow: statusFilter === tab.id ? '0 4px 12px rgba(0,102,133,0.25)' : 'none',
            }}
          >
            <Icon name={tab.icon} size={14} color={statusFilter === tab.id ? '#fff' : '#6f787e'} />
            {tab.label}
            <span
              className="ml-1 px-1.5 py-0.5 rounded-full text-xs"
              style={{
                backgroundColor: statusFilter === tab.id ? 'rgba(255,255,255,0.25)' : '#e5eeff',
                color: statusFilter === tab.id ? '#fff' : '#006685',
              }}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      <div className="flex gap-6">
        {/* Liste */}
        <div className="flex-1 min-w-0 overflow-x-auto">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-16 rounded-xl bg-white/40 animate-pulse" />)}
            </div>
          ) : isError ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#ba1a1a' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '40px', color: '#bec8ce' }}>error</span>
              <p style={{ marginTop: '12px', fontWeight: 600, color: '#0b1c30' }}>Impossible de charger les patients</p>
              <p style={{ fontSize: '13px', color: '#6f787e', marginTop: '4px' }}>
                {error instanceof Error ? error.message : 'Erreur inconnue'}
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.60)', border: '1px solid rgba(255,255,255,0.80)' }}>
              <Icon name="group" size={48} color="#bec8ce" />
              <p className="font-semibold text-[#0b1c30] mt-3">
                {search ? 'Aucun résultat' : statusFilter !== 'tous' ? 'Aucun patient dans ce filtre' : "Aucun patient pour l'instant"}
              </p>
              <p className="text-sm text-[#6f787e] mt-1">
                {search ? 'Essayez un autre terme de recherche' : statusFilter !== 'tous' ? 'Essayez un autre filtre' : 'Vos patients apparaîtront ici après leurs premières réservations'}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Patient', 'Contact', 'Humeur moy.', 'Dernière session', 'Prochain RDV', 'Consultations', 'Infos médicales', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-bold text-[#6f787e] uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => {
                    const initials = p.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                    const isSelected = selected?.id === p.id
                    return (
                      <tr
                        key={p.id}
                        onClick={() => setSelected(isSelected ? null : p)}
                        className="border-b border-slate-50 hover:bg-sky-50/30 transition-colors cursor-pointer"
                        style={{ backgroundColor: isSelected ? 'rgba(229,238,255,0.5)' : undefined }}
                      >
                        {/* Patient */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-[#006685] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                              {initials}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-[#0b1c30]">{p.full_name}</p>
                              <p className="text-xs text-[#6f787e]">{p.country ?? '—'}</p>
                            </div>
                          </div>
                        </td>

                        {/* Contact */}
                        <td className="px-4 py-3 text-sm text-[#6f787e] whitespace-nowrap">{p.phone ?? '—'}</td>

                        {/* Humeur moyenne */}
                        <td className="px-4 py-3">
                          {p.moodAvg !== null ? (
                            <div className="flex items-center gap-1.5">
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                                style={{ backgroundColor: moodStyle(p.moodAvg!).bg, color: moodStyle(p.moodAvg!).text }}
                              >
                                {p.moodAvg}
                              </div>
                              <span className="text-xs text-[#6f787e]">/10</span>
                            </div>
                          ) : (
                            <span className="text-sm text-[#6f787e]">—</span>
                          )}
                        </td>

                        {/* Dernière session */}
                        <td className="px-4 py-3 text-xs text-[#6f787e] whitespace-nowrap">
                          {p.lastSessionDate ? fmtDay(p.lastSessionDate) : '—'}
                        </td>

                        {/* Prochain RDV */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {p.nextApptDate ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-[#e5eeff] text-[#006685]">
                              <Icon name="calendar_clock" size={12} color="#006685" />
                              {fmtDayTime(p.nextApptDate)}
                            </span>
                          ) : (
                            <span className="text-xs text-[#6f787e]">—</span>
                          )}
                        </td>

                        {/* Consultations */}
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full bg-[#e5eeff] text-[#006685]">
                            <Icon name="event" size={12} color="#006685" />
                            {p.totalAppts}
                          </span>
                        </td>

                        {/* Infos médicales */}
                        <td className="px-4 py-3">
                          {p.medicalProfile ? (
                            <div className="flex flex-wrap gap-1">
                              {p.medicalProfile.blood_type && (
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#ffdad6] text-[#ba1a1a]">
                                  {p.medicalProfile.blood_type}
                                </span>
                              )}
                              {p.medicalProfile.allergies.slice(0, 2).map(a => (
                                <span key={a} className="text-xs px-2 py-0.5 rounded-full bg-[#fff8e1] text-[#705d00]">{a}</span>
                              ))}
                              {p.medicalProfile.allergies.length > 2 && (
                                <span className="text-xs text-[#6f787e]">+{p.medicalProfile.allergies.length - 2}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-[#6f787e]">Non renseigné</span>
                          )}
                        </td>

                        {/* Wellness Journey link */}
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <Link
                            href={`/practitioner/patients/${p.id}/journey`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border border-[#006685] text-[#006685] hover:bg-[#e5eeff] transition-colors whitespace-nowrap"
                          >
                            <Icon name="route" size={13} color="#006685" />
                            Parcours
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Panneau détail */}
        {selected && (
          <div className="w-72 flex-shrink-0">
            <div className="rounded-2xl p-5 space-y-4 sticky top-0" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-[#0b1c30]">Fiche patient</h3>
                <button onClick={() => setSelected(null)} className="text-[#6f787e] hover:text-[#0b1c30]">
                  <Icon name="close" size={18} />
                </button>
              </div>

              {/* Avatar */}
              <div className="flex flex-col items-center gap-2 py-2">
                <div className="w-16 h-16 rounded-full bg-[#006685] flex items-center justify-center text-white text-xl font-bold">
                  {selected.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <p className="font-bold text-[#0b1c30]">{selected.full_name}</p>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#e5eeff] text-[#006685]">
                  {selected.totalAppts} consultation{selected.totalAppts !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Mood badge in detail panel */}
              {selected.moodAvg !== null && (
                <div className="flex items-center gap-2 justify-center">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ backgroundColor: moodStyle(selected.moodAvg).bg, color: moodStyle(selected.moodAvg).text }}
                  >
                    {selected.moodAvg}
                  </div>
                  <p className="text-xs text-[#6f787e]">Humeur moy. 7 jours</p>
                </div>
              )}

              {/* Infos */}
              <div className="space-y-3 border-t border-slate-100 pt-3">
                {[
                  { icon: 'phone', label: 'Téléphone', value: selected.phone ?? '—' },
                  { icon: 'public', label: 'Pays', value: selected.country ?? '—' },
                  {
                    icon: 'event_available',
                    label: 'Dernière session',
                    value: selected.lastSessionDate ? fmtDay(selected.lastSessionDate) : '—',
                  },
                  {
                    icon: 'calendar_clock',
                    label: 'Prochain RDV',
                    value: selected.nextApptDate ? fmtDayTime(selected.nextApptDate) : '—',
                  },
                  { icon: 'person_add', label: 'Patient depuis', value: new Date(selected.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) },
                ].map(row => (
                  <div key={row.label} className="flex items-start gap-2.5">
                    <Icon name={row.icon} size={16} color="#6f787e" />
                    <div>
                      <p className="text-xs text-[#6f787e]">{row.label}</p>
                      <p className="text-sm font-medium text-[#0b1c30]">{row.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Profil médical */}
              {selected.medicalProfile && (
                <div className="border-t border-slate-100 pt-3 space-y-2">
                  <p className="text-xs font-bold text-[#6f787e] uppercase tracking-wide flex items-center gap-1">
                    <Icon name="medical_information" size={14} color="#6f787e" />
                    Profil médical
                  </p>
                  {selected.medicalProfile.blood_type && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#6f787e]">Groupe sanguin</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#ffdad6] text-[#ba1a1a]">
                        {selected.medicalProfile.blood_type}
                      </span>
                    </div>
                  )}
                  {selected.medicalProfile.allergies.length > 0 && (
                    <div>
                      <p className="text-xs text-[#6f787e] mb-1">Allergies</p>
                      <div className="flex flex-wrap gap-1">
                        {selected.medicalProfile.allergies.map(a => (
                          <span key={a} className="text-xs px-2 py-0.5 rounded-full bg-[#fff8e1] text-[#705d00]">{a}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!selected.medicalProfile && (
                <div className="border-t border-slate-100 pt-3">
                  <p className="text-xs text-[#6f787e] flex items-center gap-1">
                    <Icon name="info" size={14} color="#6f787e" />
                    Profil médical non renseigné
                  </p>
                </div>
              )}

              {/* Journey CTA */}
              <div className="border-t border-slate-100 pt-3">
                <Link
                  href={`/practitioner/patients/${selected.id}/journey`}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border-2 border-[#006685] text-[#006685] hover:bg-[#e5eeff] transition-colors"
                >
                  <Icon name="route" size={16} color="#006685" />
                  Voir le parcours bien-être
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
