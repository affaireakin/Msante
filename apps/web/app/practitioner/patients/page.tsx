'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

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
}

function usePatients() {
  return useQuery<Patient[]>({
    queryKey: ['practitioner-patients'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')

      const { data: pract } = await supabase
        .from('practitioners').select('id').eq('user_id', user.id).single()
      if (!pract) throw new Error('Profil praticien introuvable')

      const { data: apts, error } = await supabase
        .from('appointments')
        .select('patient_id, scheduled_at, users!patient_id(id, full_name, phone, country, created_at)')
        .eq('practitioner_id', pract.id)
        .not('status', 'in', '("cancelled")')
        .order('scheduled_at', { ascending: false })

      if (error) throw error

      const patientMap: Record<string, { user: any; apts: string[] }> = {}
      for (const a of apts ?? []) {
        const u = (a as any).users
        if (!u) continue
        if (!patientMap[u.id]) patientMap[u.id] = { user: u, apts: [] }
        patientMap[u.id].apts.push(a.scheduled_at)
      }

      const patientIds = Object.keys(patientMap)
      const { data: medProfiles } = patientIds.length
        ? await supabase.from('patient_medical_profiles')
            .select('patient_id, blood_type, allergies')
            .in('patient_id', patientIds)
        : { data: [] }

      const medMap: Record<string, any> = {}
      for (const m of medProfiles ?? []) medMap[m.patient_id] = m

      return Object.values(patientMap).map(({ user: u, apts: dates }) => ({
        id: u.id,
        full_name: u.full_name ?? '—',
        phone: u.phone,
        country: u.country,
        created_at: u.created_at,
        lastAppt: dates[0] ?? null,
        totalAppts: dates.length,
        medicalProfile: medMap[u.id] ? { blood_type: medMap[u.id].blood_type, allergies: medMap[u.id].allergies ?? [] } : null,
      })) as Patient[]
    },
  })
}

export default function PatientsPage() {
  const { data: patients = [], isLoading } = usePatients()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Patient | null>(null)

  const filtered = patients.filter(p =>
    p.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (p.phone ?? '').includes(search)
  )

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#0b1c30]">Mes patients</h1>
          <p className="text-sm text-[#6f787e] mt-1">{patients.length} patient{patients.length !== 1 ? 's' : ''} suivi{patients.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

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

      <div className="flex gap-6">
        {/* Liste */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-16 rounded-xl bg-white/40 animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.60)', border: '1px solid rgba(255,255,255,0.80)' }}>
              <Icon name="group" size={48} color="#bec8ce" />
              <p className="font-semibold text-[#0b1c30] mt-3">
                {search ? 'Aucun résultat' : 'Aucun patient pour l\'instant'}
              </p>
              <p className="text-sm text-[#6f787e] mt-1">
                {search ? 'Essayez un autre terme de recherche' : 'Vos patients apparaîtront ici après leurs premières réservations'}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Patient', 'Contact', 'Consultations', 'Dernier RDV', 'Infos médicales'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-bold text-[#6f787e] uppercase tracking-wide">{h}</th>
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
                        <td className="px-4 py-3 text-sm text-[#6f787e]">{p.phone ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full bg-[#e5eeff] text-[#006685]">
                            <Icon name="event" size={12} color="#006685" />
                            {p.totalAppts}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#6f787e]">
                          {p.lastAppt
                            ? new Date(p.lastAppt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
                            : '—'}
                        </td>
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

              {/* Infos */}
              <div className="space-y-3 border-t border-slate-100 pt-3">
                {[
                  { icon: 'phone', label: 'Téléphone', value: selected.phone ?? '—' },
                  { icon: 'public', label: 'Pays', value: selected.country ?? '—' },
                  { icon: 'calendar_today', label: 'Dernier RDV', value: selected.lastAppt ? new Date(selected.lastAppt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : '—' },
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
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
