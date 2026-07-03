'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

function Icon({ name, size = 18, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-symbols-outlined" style={{ fontSize: `${size}px`, color, lineHeight: 1, userSelect: 'none' }}>{name}</span>
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

const SECTION_META: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  notes:          { label: 'Notes cliniques',   icon: 'description',  color: '#82d8ff', bg: '#e5eeff' },
  prescriptions:  { label: 'Ordonnances',       icon: 'pill',         color: '#1d7a3a', bg: '#dcfce7' },
  mood_journal:   { label: 'Journal mood',      icon: 'mood',         color: '#705d00', bg: '#fef9c3' },
  analyses:       { label: 'Analyses',          icon: 'biotech',      color: '#0f766e', bg: '#ccfbf1' },
  imagerie:       { label: 'Imagerie',          icon: 'radiology',    color: '#6d28d9', bg: '#f3e8ff' },
  dossier:        { label: 'Dossier médical',   icon: 'folder_shared',color: '#475569', bg: '#f1f5f9' },
  appreciations:  { label: 'Appréciations',     icon: 'star',         color: '#d97706', bg: '#fef3c7' },
  messages:       { label: 'Messages',          icon: 'chat_bubble',  color: '#2563eb', bg: '#dbeafe' },
}

function sectionMeta(key: string) {
  return SECTION_META[key] ?? { label: key, icon: 'visibility', color: '#475569', bg: '#f1f5f9' }
}

interface AccessLog {
  id: string
  practitioner_id: string
  pract_name: string
  pract_speciality: string
  accessed_section: string
  accessed_at: string
}

function useAccessLogs() {
  return useQuery<AccessLog[]>({
    queryKey: ['patient-access-logs'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')
      const { data, error } = await supabase
        .from('patient_access_logs')
        .select(`id, practitioner_id, accessed_section, accessed_at,
                 practitioner:practitioners!patient_access_logs_practitioner_id_fkey(
                   speciality,
                   user:users!practitioners_user_id_fkey(full_name)
                 )`)
        .eq('patient_id', user.id)
        .order('accessed_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return (data ?? []).map(r => {
        const pract = r.practitioner as unknown as { speciality: string; user: { full_name: string } }
        return {
          id: r.id,
          practitioner_id: r.practitioner_id,
          pract_name: pract?.user?.full_name ?? 'Praticien inconnu',
          pract_speciality: pract?.speciality ?? '',
          accessed_section: r.accessed_section,
          accessed_at: r.accessed_at,
        }
      })
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

function fmtDatetime(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function isSameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

function groupByDay(logs: AccessLog[]) {
  const groups: { date: string; items: AccessLog[] }[] = []
  for (const log of logs) {
    const last = groups[groups.length - 1]
    if (last && isSameDay(last.date, log.accessed_at)) {
      last.items.push(log)
    } else {
      groups.push({ date: log.accessed_at, items: [log] })
    }
  }
  return groups
}

export default function JournalAccesPage() {
  const { data: logs = [], isLoading, error } = useAccessLogs()
  const [sectionFilter, setSectionFilter] = useState('all')
  const [practFilter, setPractFilter] = useState('all')

  const sections = Array.from(new Set(logs.map(l => l.accessed_section)))
  const practitioners = Array.from(
    new Map(logs.map(l => [l.practitioner_id, l.pract_name])).entries()
  )

  const filtered = logs.filter(l => {
    if (sectionFilter !== 'all' && l.accessed_section !== sectionFilter) return false
    if (practFilter !== 'all' && l.practitioner_id !== practFilter) return false
    return true
  })

  const grouped = groupByDay(filtered)

  const today = logs.filter(l => isSameDay(l.accessed_at, new Date().toISOString()))
  const week = logs.filter(l => {
    const d = new Date(l.accessed_at)
    const now = new Date()
    const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
    return diff <= 7
  })
  const uniquePracts = new Set(logs.map(l => l.practitioner_id)).size

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-[#0b1c30] tracking-tight">Journal d'accès</h1>
        <p className="text-sm text-slate-500 mt-0.5">Historique complet des accès à vos données médicales</p>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
        <Icon name="lock" size={16} color="#d97706" />
        <p className="text-xs text-amber-700 leading-relaxed">
          Ce journal est <strong>immuable et chiffré</strong>. Chaque accès à vos données par un praticien est enregistré. En cas d'accès suspect, contactez notre équipe.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl p-4 text-center shadow-sm">
          <p className="text-2xl font-black text-[#82d8ff]">{today.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Aujourd'hui</p>
        </div>
        <div className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl p-4 text-center shadow-sm">
          <p className="text-2xl font-black text-[#705d00]">{week.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Cette semaine</p>
        </div>
        <div className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl p-4 text-center shadow-sm">
          <p className="text-2xl font-black text-[#475569]">{uniquePracts}</p>
          <p className="text-xs text-slate-500 mt-0.5">Praticiens actifs</p>
        </div>
      </div>

      {/* Filtres */}
      {!isLoading && logs.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          <div className="flex flex-col gap-1 flex-1 min-w-36">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-1">Section</label>
            <select value={sectionFilter} onChange={e => setSectionFilter(e.target.value)}
              className="px-3 py-2 rounded-xl text-xs border border-slate-200 bg-white/80 text-[#0b1c30] outline-none focus:border-[#82d8ff]">
              <option value="all">Toutes les sections</option>
              {sections.map(s => <option key={s} value={s}>{sectionMeta(s).label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-36">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-1">Praticien</label>
            <select value={practFilter} onChange={e => setPractFilter(e.target.value)}
              className="px-3 py-2 rounded-xl text-xs border border-slate-200 bg-white/80 text-[#0b1c30] outline-none focus:border-[#82d8ff]">
              <option value="all">Tous les praticiens</option>
              {practitioners.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Timeline */}
      {isLoading ? (
        <div className="space-y-4 animate-pulse">
          {[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-slate-100 rounded-xl" />)}
        </div>
      ) : error ? (
        <div className="bg-white/60 border border-white/80 rounded-xl p-8 text-center">
          <Icon name="error" size={32} color="#ba1a1a" />
          <p className="mt-2 text-sm text-slate-500">{(error as Error).message}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white/60 border border-white/80 rounded-xl p-10 text-center shadow-sm">
          <Icon name="manage_history" size={48} color="#cbd5e1" />
          <p className="mt-3 text-slate-400 text-sm font-medium">Aucun accès enregistré</p>
          <p className="text-xs text-slate-400 mt-1">Les accès à vos données apparaîtront ici.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(group => (
            <div key={group.date}>
              {/* Date header */}
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px flex-1 bg-slate-200/60" />
                <span className="text-xs font-semibold text-slate-400 px-2">{fmtDate(group.date)}</span>
                <div className="h-px flex-1 bg-slate-200/60" />
              </div>

              {/* Timeline items */}
              <div className="relative">
                <div className="absolute left-5 top-0 bottom-0 w-px bg-slate-200/60" />
                <div className="space-y-3">
                  {group.items.map(log => {
                    const meta = sectionMeta(log.accessed_section)
                    return (
                      <div key={log.id} className="flex items-start gap-4">
                        {/* Timeline dot */}
                        <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-sm z-10" style={{ backgroundColor: meta.bg }}>
                          <Icon name={meta.icon} size={16} color={meta.color} />
                        </div>

                        {/* Card */}
                        <div className="flex-1 bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl p-3.5 shadow-sm min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: meta.bg, color: meta.color }}>
                                  {meta.label}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1.5">
                                <div className="w-6 h-6 rounded-full bg-[#e5eeff] flex items-center justify-center text-[#82d8ff] text-[10px] font-bold flex-shrink-0">
                                  {initials(log.pract_name)}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-[#0b1c30] truncate">{log.pract_name}</p>
                                  <p className="text-[11px] text-slate-400 capitalize">{log.pract_speciality}</p>
                                </div>
                              </div>
                            </div>
                            <span className="text-[11px] text-slate-400 flex-shrink-0 whitespace-nowrap">
                              {new Date(log.accessed_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ))}

          {/* Footer count */}
          <p className="text-center text-xs text-slate-400 py-2">
            {filtered.length} événement{filtered.length > 1 ? 's' : ''} affiché{filtered.length > 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  )
}
