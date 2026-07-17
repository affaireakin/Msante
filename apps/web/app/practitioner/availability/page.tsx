'use client'
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConsultationType {
  id: string; practitioner_id: string; name: string; duration_min: number
  price: number | null; currency: string; color: string; description: string | null
  mode: 'presentiel' | 'video' | 'both'; is_active: boolean; sort_order: number
}
interface Location {
  id: string; name: string; address: string | null; city: string | null
  is_teleconsult: boolean; is_active: boolean
}
interface WeeklyAvail {
  id: string; day_of_week: number | null; specific_date: string | null
  start_time: string; end_time: string
  location_id: string | null; consultation_type_ids: string[]; is_active: boolean
}
interface BlockedPeriod {
  id: string; start_date: string; end_date: string
  start_time: string | null; end_time: string | null
  reason_type: string; reason_label: string | null
}
interface BookingSettings {
  min_booking_delay_h: number; max_booking_days_ahead: number
  buffer_between_min: number; max_patients_per_day: number | null
  cancellation_deadline_hours: number | null
  auto_confirm: boolean; waitlist_enabled: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']

const WORK_DAYS = [1,2,3,4,5,6,0] // Mon → Sat → Sun display order

const REASON_TYPES = [
  { value: 'vacation',  label: 'Congés / Vacances',  icon: 'beach_access' },
  { value: 'training',  label: 'Formation',           icon: 'school' },
  { value: 'meeting',   label: 'Réunion',             icon: 'groups' },
  { value: 'sick',      label: 'Maladie',             icon: 'sick' },
  { value: 'travel',    label: 'Déplacement',         icon: 'flight' },
  { value: 'other',     label: 'Autre',               icon: 'event_busy' },
]

const MODE_OPTIONS = [
  { value: 'both',       label: 'Présentiel + Vidéo', icon: 'sync_alt' },
  { value: 'presentiel', label: 'Présentiel',          icon: 'location_on' },
  { value: 'video',      label: 'Téléconsultation',   icon: 'videocam' },
]

const PRESET_COLORS = ['#82d8ff','#1d7a3a','#705d00','#ba1a1a','#6d28d9','#0f766e','#c2410c','#1d4ed8']

function pad(n: number) { return String(n).padStart(2,'0') }

function generateSlotCount(start: string, end: string, dur: number) {
  const [sh,sm] = start.split(':').map(Number); const [eh,em] = end.split(':').map(Number)
  return Math.floor(((eh*60+em)-(sh*60+sm)) / dur)
}

function Icon({ name, size=18, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-symbols-outlined" style={{ fontSize:`${size}px`, color, lineHeight:1, userSelect:'none' }}>{name}</span>
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? 'bg-[#82d8ff]' : 'bg-slate-300'}`}>
      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-1'}`} />
    </button>
  )
}

// ─── Data hook ────────────────────────────────────────────────────────────────

function useAvailData() {
  return useQuery({
    queryKey: ['avail-v2'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')
      const { data: pract } = await supabase.from('practitioners').select('id').eq('user_id', user.id).single()
      if (!pract) throw new Error('Profil introuvable')
      const id = pract.id

      const [types, locations, weekly, blocked, settings] = await Promise.all([
        supabase.from('consultation_types').select('*').eq('practitioner_id', id).order('sort_order'),
        supabase.from('practitioner_locations').select('*').eq('practitioner_id', id).eq('is_active', true),
        supabase.from('weekly_availabilities').select('*').eq('practitioner_id', id).order('day_of_week').order('start_time'),
        supabase.from('blocked_periods').select('*').eq('practitioner_id', id).gte('end_date', new Date().toISOString().split('T')[0]).order('start_date'),
        supabase.from('practitioner_booking_settings').select('*').eq('practitioner_id', id).maybeSingle(),
      ])

      return {
        practitionerId: id,
        types: (types.data ?? []) as ConsultationType[],
        locations: (locations.data ?? []) as Location[],
        weekly: (weekly.data ?? []) as WeeklyAvail[],
        blocked: (blocked.data ?? []) as BlockedPeriod[],
        settings: (settings.data ?? {
          min_booking_delay_h: 2, max_booking_days_ahead: 60,
          buffer_between_min: 0, max_patients_per_day: null,
          cancellation_deadline_hours: 24,
          auto_confirm: true, waitlist_enabled: false,
        }) as BookingSettings,
      }
    },
    staleTime: 30_000,
  })
}

// ─── Tab: Types de consultation ───────────────────────────────────────────────

function TypesTab({ data }: { data: ReturnType<typeof useAvailData>['data'] }) {
  const qc = useQueryClient()
  const pid = data!.practitionerId
  const types = data!.types

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ConsultationType | null>(null)
  const [form, setForm] = useState<{ name: string; duration_min: number; price: string; currency: string; color: string; description: string; mode: 'presentiel' | 'video' | 'both' }>({ name: '', duration_min: 30, price: '', currency: 'XOF', color: '#82d8ff', description: '', mode: 'both' })

  function openNew() { setForm({ name:'', duration_min:30, price:'', currency:'XOF', color:'#82d8ff', description:'', mode:'both' }); setEditing(null); setShowForm(true) }
  function openEdit(t: ConsultationType) {
    setForm({ name:t.name, duration_min:t.duration_min, price:t.price?.toString()??'', currency:t.currency, color:t.color, description:t.description??'', mode:t.mode })
    setEditing(t); setShowForm(true)
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = { name: form.name, duration_min: form.duration_min, price: form.price ? parseFloat(form.price) : null, currency: form.currency, color: form.color, description: form.description || null, mode: form.mode }
      if (editing) {
        const { error } = await supabase.from('consultation_types').update(payload).eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('consultation_types').insert({ ...payload, practitioner_id: pid, sort_order: types.length })
        if (error) throw error
      }
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['avail-v2'] }); setShowForm(false) },
    onError: (e: Error) => alert(e.message),
  })

  const toggle = useMutation({
    mutationFn: async (t: ConsultationType) => {
      const { error } = await supabase.from('consultation_types').update({ is_active: !t.is_active }).eq('id', t.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['avail-v2'] }),
  })

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('consultation_types').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['avail-v2'] }),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{types.length} type{types.length !== 1 ? 's' : ''} configuré{types.length !== 1 ? 's' : ''}</p>
        <button onClick={openNew} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: '#82d8ff' }}>
          <Icon name="add" size={16} color="#fff" />Nouveau type
        </button>
      </div>

      {types.length === 0 ? (
        <div className="bg-white/60 border border-white/80 rounded-xl p-10 text-center">
          <Icon name="event_note" size={40} color="#cbd5e1" />
          <p className="mt-3 text-slate-400 text-sm">Aucun type configuré — commencez par créer vos types de consultations</p>
        </div>
      ) : (
        <div className="space-y-2">
          {types.map(t => {
            const modeOpt = MODE_OPTIONS.find(m => m.value === t.mode)
            return (
              <div key={t.id} className={`bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl p-4 flex items-center gap-3 shadow-sm transition-opacity ${t.is_active ? '' : 'opacity-50'}`}>
                <div className="w-3 h-12 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-[#0b1c30]">{t.name}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{t.duration_min} min</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#e5eeff] text-[#82d8ff]">
                      <Icon name={modeOpt?.icon ?? 'sync_alt'} size={11} color="#82d8ff" /> {modeOpt?.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {t.price ? `${t.price.toLocaleString('fr-FR')} ${t.currency}` : 'Tarif non défini'}
                    {t.description ? ` · ${t.description}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Toggle checked={t.is_active} onChange={() => toggle.mutate(t)} />
                  <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                    <Icon name="edit" size={15} color="#6f787e" />
                  </button>
                  <button onClick={() => { if (confirm(`Supprimer "${t.name}" ?`)) del.mutate(t.id) }} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors">
                    <Icon name="delete" size={15} color="#ba1a1a" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="text-lg font-bold text-[#0b1c30] mb-4">{editing ? 'Modifier le type' : 'Nouveau type de consultation'}</h3>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Nom</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="ex: Consultation générale"
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-[#0b1c30] outline-none focus:border-[#82d8ff]" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Durée (min)</label>
                  <div className="flex flex-wrap gap-1.5">
                    {[15,20,30,45,60,90].map(d => (
                      <button key={d} onClick={() => setForm(f => ({ ...f, duration_min: d }))}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all"
                        style={{ backgroundColor: form.duration_min === d ? '#82d8ff' : '#f8f9ff', color: form.duration_min === d ? '#fff' : '#6f787e', borderColor: form.duration_min === d ? '#82d8ff' : '#e2e8f0' }}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Tarif</label>
                  <div className="flex gap-1.5">
                    <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="15000"
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm text-[#0b1c30] outline-none focus:border-[#82d8ff] min-w-0" />
                    <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                      className="px-2 py-2 border border-slate-200 rounded-xl text-xs outline-none bg-white">
                      <option value="XOF">XOF</option><option value="EUR">EUR</option><option value="USD">USD</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {MODE_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setForm(f => ({ ...f, mode: opt.value as typeof form.mode }))}
                      className="py-2 rounded-xl text-xs font-semibold border flex flex-col items-center gap-1 transition-all"
                      style={{ borderColor: form.mode === opt.value ? '#82d8ff' : '#e2e8f0', backgroundColor: form.mode === opt.value ? '#e5eeff' : '#f8f9ff', color: form.mode === opt.value ? '#82d8ff' : '#6f787e' }}>
                      <Icon name={opt.icon} size={16} color={form.mode === opt.value ? '#82d8ff' : '#6f787e'} />
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">Couleur d'affichage</label>
                <div className="flex gap-2 flex-wrap">
                  {PRESET_COLORS.map(c => (
                    <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                      className="w-7 h-7 rounded-full border-2 transition-all"
                      style={{ backgroundColor: c, borderColor: form.color === c ? '#0b1c30' : 'transparent' }} />
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Description (optionnelle)</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="ex: Pour les nouveaux patients"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-[#0b1c30] outline-none focus:border-[#82d8ff]" />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-500 hover:bg-slate-50">Annuler</button>
              <button onClick={() => save.mutate()} disabled={!form.name || save.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: '#82d8ff' }}>
                {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Planning hebdomadaire ───────────────────────────────────────────────

function PlanningTab({ data }: { data: ReturnType<typeof useAvailData>['data'] }) {
  const qc = useQueryClient()
  const pid = data!.practitionerId
  const weekly = data!.weekly.filter(w => w.day_of_week !== null)
  const oneOff = data!.weekly.filter(w => w.specific_date !== null).sort((a, b) => a.specific_date!.localeCompare(b.specific_date!))
  const types = data!.types.filter(t => t.is_active)
  const locations = data!.locations

  const [showForm, setShowForm] = useState<number | null>(null) // day_of_week
  const [showDateForm, setShowDateForm] = useState(false)
  const [form, setForm] = useState({ start_time: '09:00', end_time: '17:00', location_id: '', type_ids: [] as string[] })
  const [dateForm, setDateForm] = useState({ specific_date: '', start_time: '09:00', end_time: '17:00', location_id: '', type_ids: [] as string[] })

  const byDay = useMemo(() => {
    const map = new Map<number, WeeklyAvail[]>()
    for (const w of weekly) {
      if (!map.has(w.day_of_week!)) map.set(w.day_of_week!, [])
      map.get(w.day_of_week!)!.push(w)
    }
    return map
  }, [weekly])

  const add = useMutation({
    mutationFn: async () => {
      if (showForm === null) return
      const { error } = await supabase.from('weekly_availabilities').insert({
        practitioner_id: pid, day_of_week: showForm,
        start_time: form.start_time, end_time: form.end_time,
        location_id: form.location_id || null,
        consultation_type_ids: form.type_ids,
      })
      if (error) throw error
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['avail-v2'] }); setShowForm(null) },
    onError: (e: Error) => alert(e.message),
  })

  const addDate = useMutation({
    mutationFn: async () => {
      if (!dateForm.specific_date) return
      const { error } = await supabase.from('weekly_availabilities').insert({
        practitioner_id: pid, day_of_week: null, specific_date: dateForm.specific_date,
        start_time: dateForm.start_time, end_time: dateForm.end_time,
        location_id: dateForm.location_id || null,
        consultation_type_ids: dateForm.type_ids,
      })
      if (error) throw error
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['avail-v2'] }); setShowDateForm(false) },
    onError: (e: Error) => alert(e.message),
  })

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('weekly_availabilities').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['avail-v2'] }),
  })

  const toggle = useMutation({
    mutationFn: async (w: WeeklyAvail) => {
      const { error } = await supabase.from('weekly_availabilities').update({ is_active: !w.is_active }).eq('id', w.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['avail-v2'] }),
  })

  function openForm(day: number) {
    setForm({ start_time: '09:00', end_time: '17:00', location_id: '', type_ids: types.map(t => t.id) })
    setShowForm(day)
  }

  function openDateForm() {
    setDateForm({ specific_date: '', start_time: '09:00', end_time: '17:00', location_id: '', type_ids: types.map(t => t.id) })
    setShowDateForm(true)
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">Les créneaux se répètent automatiquement chaque semaine.</p>

      {/* Disponibilités ponctuelles (date précise) */}
      <div className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100/60">
          <div>
            <p className="text-sm font-semibold text-[#0b1c30]">Dates spécifiques</p>
            <p className="text-xs text-slate-400">Un créneau ponctuel, pour une seule date (ne se répète pas).</p>
          </div>
          <button onClick={openDateForm}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-[#82d8ff] bg-[#e5eeff] hover:bg-[#bee9ff] transition-colors flex-shrink-0">
            <Icon name="add" size={13} color="#82d8ff" />Ajouter une date
          </button>
        </div>
        {oneOff.length === 0 ? (
          <div className="px-4 py-3 text-xs text-slate-400 italic">Aucune date spécifique ajoutée</div>
        ) : (
          <div className="divide-y divide-slate-100/60">
            {oneOff.map(s => {
              const loc = locations.find(l => l.id === s.location_id)
              const slotTypes = types.filter(t => s.consultation_type_ids.includes(t.id))
              const dateLabel = new Date(s.specific_date! + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })
              return (
                <div key={s.id} className={`flex items-center gap-3 px-4 py-3 ${s.is_active ? '' : 'opacity-50'}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-[#0b1c30] capitalize">{dateLabel}</span>
                      <span className="text-sm text-slate-500">{s.start_time.slice(0,5)} – {s.end_time.slice(0,5)}</span>
                      {loc && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">{loc.name}</span>}
                      {slotTypes.slice(0, 2).map(t => (
                        <span key={t.id} className="text-xs px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: t.color }}>{t.name}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Toggle checked={s.is_active} onChange={() => toggle.mutate(s)} />
                    <button onClick={() => del.mutate(s.id)} className="p-1 rounded hover:bg-red-50 transition-colors">
                      <Icon name="delete" size={14} color="#ba1a1a" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {WORK_DAYS.map(day => {
        const slots = byDay.get(day) ?? []
        const dayName = DAYS[day]
        return (
          <div key={day} className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100/60">
              <p className="text-sm font-semibold text-[#0b1c30]">{dayName}</p>
              <button onClick={() => openForm(day)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-[#82d8ff] bg-[#e5eeff] hover:bg-[#bee9ff] transition-colors">
                <Icon name="add" size={13} color="#82d8ff" />Ajouter
              </button>
            </div>

            {slots.length === 0 ? (
              <div className="px-4 py-3 text-xs text-slate-400 italic">Fermé / Pas de disponibilité</div>
            ) : (
              <div className="divide-y divide-slate-100/60">
                {slots.map(s => {
                  const loc = locations.find(l => l.id === s.location_id)
                  const slotTypes = types.filter(t => s.consultation_type_ids.includes(t.id))
                  const slotCount = generateSlotCount(s.start_time.slice(0,5), s.end_time.slice(0,5), slotTypes[0]?.duration_min ?? 30)
                  return (
                    <div key={s.id} className={`flex items-center gap-3 px-4 py-3 ${s.is_active ? '' : 'opacity-50'}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-[#0b1c30]">{s.start_time.slice(0,5)} – {s.end_time.slice(0,5)}</span>
                          {loc && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">{loc.name}</span>}
                          {slotTypes.slice(0, 2).map(t => (
                            <span key={t.id} className="text-xs px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: t.color }}>{t.name}</span>
                          ))}
                          {slotTypes.length > 2 && <span className="text-xs text-slate-400">+{slotTypes.length - 2}</span>}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">≈ {slotCount} créneaux générés / semaine</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Toggle checked={s.is_active} onChange={() => toggle.mutate(s)} />
                        <button onClick={() => del.mutate(s.id)} className="p-1 rounded hover:bg-red-50 transition-colors">
                          <Icon name="delete" size={14} color="#ba1a1a" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {showForm !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowForm(null)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="text-lg font-bold text-[#0b1c30] mb-1">Ajouter une plage</h3>
            <p className="text-sm text-[#82d8ff] font-semibold mb-4">{DAYS[showForm]}</p>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Début</label>
                  <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-[#0b1c30] outline-none focus:border-[#82d8ff]" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Fin</label>
                  <input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-[#0b1c30] outline-none focus:border-[#82d8ff]" />
                </div>
              </div>

              {locations.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Lieu</label>
                  <select value={form.location_id} onChange={e => setForm(f => ({ ...f, location_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none bg-white focus:border-[#82d8ff]">
                    <option value="">Sans lieu spécifique</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
              )}

              {types.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Types de consultation</label>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {types.map(t => {
                      const checked = form.type_ids.includes(t.id)
                      return (
                        <label key={t.id} onClick={() => setForm(f => ({ ...f, type_ids: checked ? f.type_ids.filter(id => id !== t.id) : [...f.type_ids, t.id] }))}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer hover:bg-slate-50 transition-colors"
                          style={{ borderColor: checked ? t.color : '#e2e8f0', backgroundColor: checked ? `${t.color}10` : 'transparent' }}>
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                          <span className="text-sm text-[#0b1c30] flex-1">{t.name}</span>
                          <span className="text-xs text-slate-400">{t.duration_min} min</span>
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${checked ? 'bg-[#82d8ff] border-[#82d8ff]' : 'border-slate-300'}`}>
                            {checked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>}
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}

              {types.length > 0 && form.type_ids.length > 0 && form.start_time < form.end_time && (
                <div className="bg-[#e5eeff] rounded-xl px-3 py-2.5">
                  {form.type_ids.map(tid => {
                    const t = types.find(x => x.id === tid)!
                    const count = generateSlotCount(form.start_time, form.end_time, t.duration_min)
                    return <p key={tid} className="text-xs text-[#82d8ff]">{t.name}: <strong>{count} créneaux</strong> de {t.duration_min} min</p>
                  })}
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowForm(null)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-500">Annuler</button>
              <button onClick={() => add.mutate()} disabled={add.isPending || !form.start_time || !form.end_time || form.start_time >= form.end_time}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: '#82d8ff' }}>
                {add.isPending ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowDateForm(false)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="text-lg font-bold text-[#0b1c30] mb-1">Ajouter une date spécifique</h3>
            <p className="text-sm text-slate-400 mb-4">Ce créneau ne s&apos;appliquera qu&apos;à la date choisie.</p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Date</label>
                <input type="date" value={dateForm.specific_date} min={new Date().toISOString().split('T')[0]}
                  onChange={e => setDateForm(f => ({ ...f, specific_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#82d8ff]" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Début</label>
                  <input type="time" value={dateForm.start_time} onChange={e => setDateForm(f => ({ ...f, start_time: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-[#0b1c30] outline-none focus:border-[#82d8ff]" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Fin</label>
                  <input type="time" value={dateForm.end_time} onChange={e => setDateForm(f => ({ ...f, end_time: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-[#0b1c30] outline-none focus:border-[#82d8ff]" />
                </div>
              </div>

              {locations.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Lieu</label>
                  <select value={dateForm.location_id} onChange={e => setDateForm(f => ({ ...f, location_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none bg-white focus:border-[#82d8ff]">
                    <option value="">Sans lieu spécifique</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
              )}

              {types.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Types de consultation</label>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {types.map(t => {
                      const checked = dateForm.type_ids.includes(t.id)
                      return (
                        <label key={t.id} onClick={() => setDateForm(f => ({ ...f, type_ids: checked ? f.type_ids.filter(id => id !== t.id) : [...f.type_ids, t.id] }))}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer hover:bg-slate-50 transition-colors"
                          style={{ borderColor: checked ? t.color : '#e2e8f0', backgroundColor: checked ? `${t.color}10` : 'transparent' }}>
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                          <span className="text-sm text-[#0b1c30] flex-1">{t.name}</span>
                          <span className="text-xs text-slate-400">{t.duration_min} min</span>
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${checked ? 'bg-[#82d8ff] border-[#82d8ff]' : 'border-slate-300'}`}>
                            {checked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>}
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}

              {types.length > 0 && dateForm.type_ids.length > 0 && dateForm.start_time < dateForm.end_time && (
                <div className="bg-[#e5eeff] rounded-xl px-3 py-2.5">
                  {dateForm.type_ids.map(tid => {
                    const t = types.find(x => x.id === tid)!
                    const count = generateSlotCount(dateForm.start_time, dateForm.end_time, t.duration_min)
                    return <p key={tid} className="text-xs text-[#82d8ff]">{t.name}: <strong>{count} créneaux</strong> de {t.duration_min} min</p>
                  })}
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowDateForm(false)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-500">Annuler</button>
              <button onClick={() => addDate.mutate()}
                disabled={addDate.isPending || !dateForm.specific_date || !dateForm.start_time || !dateForm.end_time || dateForm.start_time >= dateForm.end_time}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: '#82d8ff' }}>
                {addDate.isPending ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Périodes bloquées ───────────────────────────────────────────────────

function BlockedTab({ data }: { data: ReturnType<typeof useAvailData>['data'] }) {
  const qc = useQueryClient()
  const pid = data!.practitionerId
  const blocked = data!.blocked

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ start_date: '', end_date: '', start_time: '', end_time: '', reason_type: 'vacation', reason_label: '', all_day: true })

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('blocked_periods').insert({
        practitioner_id: pid,
        start_date: form.start_date, end_date: form.end_date,
        start_time: form.all_day ? null : form.start_time || null,
        end_time: form.all_day ? null : form.end_time || null,
        reason_type: form.reason_type, reason_label: form.reason_label || null,
      })
      if (error) throw error
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['avail-v2'] }); setShowForm(false) },
    onError: (e: Error) => alert(e.message),
  })

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('blocked_periods').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['avail-v2'] }),
  })

  function fmtDateRange(start: string, end: string) {
    const s = new Date(start + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    const e = new Date(end + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
    return start === end ? e : `${s} → ${e}`
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Les créneaux dans ces périodes disparaissent automatiquement.</p>
        <button onClick={() => { setForm({ start_date: '', end_date: '', start_time: '', end_time: '', reason_type: 'vacation', reason_label: '', all_day: true }); setShowForm(true) }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: '#82d8ff' }}>
          <Icon name="event_busy" size={16} color="#fff" />Bloquer une période
        </button>
      </div>

      {blocked.length === 0 ? (
        <div className="bg-white/60 border border-white/80 rounded-xl p-10 text-center">
          <Icon name="event_available" size={40} color="#cbd5e1" />
          <p className="mt-3 text-slate-400 text-sm">Aucune période bloquée — toutes vos disponibilités sont actives</p>
        </div>
      ) : (
        <div className="space-y-2">
          {blocked.map(b => {
            const rt = REASON_TYPES.find(r => r.value === b.reason_type)
            return (
              <div key={b.id} className="bg-white/60 backdrop-blur-sm border border-red-100/60 rounded-xl p-4 flex items-center gap-3 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                  <Icon name={rt?.icon ?? 'event_busy'} size={20} color="#ba1a1a" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#0b1c30]">{b.reason_label || rt?.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {fmtDateRange(b.start_date, b.end_date)}
                    {b.start_time && b.end_time ? ` · ${b.start_time.slice(0,5)} – ${b.end_time.slice(0,5)}` : ' · Journée entière'}
                  </p>
                </div>
                <button onClick={() => del.mutate(b.id)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0">
                  <Icon name="delete" size={16} color="#ba1a1a" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-[#0b1c30] mb-4">Bloquer une période</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Date début</label>
                  <input type="date" value={form.start_date} min={new Date().toISOString().split('T')[0]}
                    onChange={e => setForm(f => ({ ...f, start_date: e.target.value, end_date: f.end_date || e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-[#0b1c30] outline-none focus:border-[#82d8ff]" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Date fin</label>
                  <input type="date" value={form.end_date} min={form.start_date || new Date().toISOString().split('T')[0]}
                    onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-[#0b1c30] outline-none focus:border-[#82d8ff]" />
                </div>
              </div>

              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-[#0b1c30]">Journée entière</span>
                <Toggle checked={form.all_day} onChange={v => setForm(f => ({ ...f, all_day: v }))} />
              </div>

              {!form.all_day && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Début</label>
                    <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-[#0b1c30] outline-none focus:border-[#82d8ff]" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Fin</label>
                    <input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-[#0b1c30] outline-none focus:border-[#82d8ff]" />
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Raison</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {REASON_TYPES.map(r => (
                    <button key={r.value} onClick={() => setForm(f => ({ ...f, reason_type: r.value }))}
                      className="py-2 px-2 rounded-xl text-[11px] font-semibold border flex flex-col items-center gap-1 transition-all"
                      style={{ borderColor: form.reason_type === r.value ? '#ba1a1a' : '#e2e8f0', backgroundColor: form.reason_type === r.value ? '#ffdad6' : '#f8f9ff', color: form.reason_type === r.value ? '#ba1a1a' : '#6f787e' }}>
                      <Icon name={r.icon} size={16} color={form.reason_type === r.value ? '#ba1a1a' : '#6f787e'} />
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Libellé personnalisé (optionnel)</label>
                <input value={form.reason_label} onChange={e => setForm(f => ({ ...f, reason_label: e.target.value }))} placeholder="ex: Vacances d'été"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#82d8ff]" />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-500">Annuler</button>
              <button onClick={() => add.mutate()} disabled={!form.start_date || !form.end_date || add.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: '#ba1a1a' }}>
                {add.isPending ? 'Enregistrement…' : 'Bloquer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Lieux ───────────────────────────────────────────────────────────────

function LocationsTab({ data }: { data: ReturnType<typeof useAvailData>['data'] }) {
  const qc = useQueryClient()
  const pid = data!.practitionerId
  const locations = data!.locations

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', address: '', city: '', is_teleconsult: false })

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('practitioner_locations').insert({ practitioner_id: pid, ...form })
      if (error) throw error
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['avail-v2'] }); setShowForm(false) },
    onError: (e: Error) => alert(e.message),
  })

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('practitioner_locations').update({ is_active: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['avail-v2'] }),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Cabinet, clinique, hôpital, domicile…</p>
        <button onClick={() => { setForm({ name:'', address:'', city:'', is_teleconsult:false }); setShowForm(true) }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: '#82d8ff' }}>
          <Icon name="add_location" size={16} color="#fff" />Ajouter un lieu
        </button>
      </div>

      {locations.length === 0 ? (
        <div className="bg-white/60 border border-white/80 rounded-xl p-10 text-center">
          <Icon name="location_off" size={40} color="#cbd5e1" />
          <p className="mt-3 text-slate-400 text-sm">Aucun lieu configuré</p>
        </div>
      ) : (
        <div className="space-y-2">
          {locations.map(l => (
            <div key={l.id} className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl p-4 flex items-center gap-3 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-[#e5eeff] flex items-center justify-center flex-shrink-0">
                <Icon name={l.is_teleconsult ? 'videocam' : 'location_on'} size={20} color="#82d8ff" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#0b1c30]">{l.name}</p>
                <p className="text-xs text-slate-400">{[l.address, l.city].filter(Boolean).join(', ') || (l.is_teleconsult ? 'Téléconsultation' : 'Sans adresse')}</p>
              </div>
              <button onClick={() => del.mutate(l.id)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0">
                <Icon name="delete" size={16} color="#ba1a1a" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-[#0b1c30] mb-4">Nouveau lieu</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Nom du lieu</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="ex: Cabinet principal"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#82d8ff]" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Adresse</label>
                <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="ex: 12 rue de la Santé"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#82d8ff]" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Ville</label>
                <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="ex: Dakar"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#82d8ff]" />
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-sm text-[#0b1c30]">Lieu de téléconsultation</span>
                <Toggle checked={form.is_teleconsult} onChange={v => setForm(f => ({ ...f, is_teleconsult: v }))} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-500">Annuler</button>
              <button onClick={() => add.mutate()} disabled={!form.name || add.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: '#82d8ff' }}>
                {add.isPending ? 'Enregistrement…' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Paramètres avancés ──────────────────────────────────────────────────

function SettingsTab({ data }: { data: ReturnType<typeof useAvailData>['data'] }) {
  const qc = useQueryClient()
  const pid = data!.practitionerId
  const s = data!.settings

  const [form, setForm] = useState<BookingSettings>({ ...s })
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)

  function upd<K extends keyof BookingSettings>(k: K, v: BookingSettings[K]) {
    setForm(f => ({ ...f, [k]: v })); setDirty(true)
  }

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('practitioner_booking_settings').upsert({ practitioner_id: pid, ...form, updated_at: new Date().toISOString() })
      if (error) throw error
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['avail-v2'] }); setDirty(false); setSaved(true); setTimeout(() => setSaved(false), 2500) },
    onError: (e: Error) => alert(e.message),
  })

  return (
    <div className="space-y-4 max-w-xl">
      {[
        { label: 'Délai minimum avant réservation', desc: 'Combien d\'heures à l\'avance un patient peut réserver', key: 'min_booking_delay_h' as const, unit: 'heures', min: 0, max: 72 },
        { label: 'Fenêtre de réservation', desc: 'Jusqu\'à combien de jours à l\'avance un patient peut réserver', key: 'max_booking_days_ahead' as const, unit: 'jours', min: 7, max: 365 },
        { label: 'Temps tampon entre consultations', desc: 'Pause automatique entre deux rendez-vous', key: 'buffer_between_min' as const, unit: 'min', min: 0, max: 60 },
      ].map(({ label, desc, key, unit, min, max }) => (
        <div key={key} className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[#0b1c30]">{label}</p>
              <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <input type="number" value={form[key] ?? ''} min={min} max={max}
                onChange={e => upd(key, parseInt(e.target.value) || 0)}
                className="w-20 px-3 py-1.5 border border-slate-200 rounded-xl text-sm text-center text-[#0b1c30] outline-none focus:border-[#82d8ff]" />
              <span className="text-xs text-slate-400">{unit}</span>
            </div>
          </div>
        </div>
      ))}

      <div className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl p-4 shadow-sm">
        <p className="text-sm font-semibold text-[#0b1c30] mb-0.5">Délai d&apos;annulation</p>
        <p className="text-xs text-slate-400 mb-3">Passé ce délai avant le RDV, ni le patient ni vous ne pouvez plus annuler en ligne</p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {[48, 24, 12, 2].map(h => (
            <button key={h} type="button" onClick={() => upd('cancellation_deadline_hours', h)}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all"
              style={{ backgroundColor: form.cancellation_deadline_hours === h ? '#82d8ff' : '#f8f9ff', color: form.cancellation_deadline_hours === h ? '#fff' : '#6f787e', borderColor: form.cancellation_deadline_hours === h ? '#82d8ff' : '#e2e8f0' }}>
              {h}h avant
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input type="number" value={form.cancellation_deadline_hours ?? ''} min={0}
            onChange={e => upd('cancellation_deadline_hours', e.target.value ? parseInt(e.target.value) : null)}
            placeholder="Personnalisé"
            className="w-28 px-3 py-1.5 border border-slate-200 rounded-xl text-sm text-center text-[#0b1c30] outline-none focus:border-[#82d8ff]" />
          <span className="text-xs text-slate-400">heures avant le RDV (vide = pas de limite)</span>
        </div>
      </div>

      <div className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl p-4 shadow-sm">
        <p className="text-sm font-semibold text-[#0b1c30] mb-0.5">Patients max par jour</p>
        <p className="text-xs text-slate-400 mb-3">Laisser vide pour illimité</p>
        <input type="number" value={form.max_patients_per_day ?? ''} min={1}
          onChange={e => upd('max_patients_per_day', e.target.value ? parseInt(e.target.value) : null)}
          placeholder="Illimité"
          className="w-28 px-3 py-1.5 border border-slate-200 rounded-xl text-sm text-center text-[#0b1c30] outline-none focus:border-[#82d8ff]" />
      </div>

      {[
        { label: 'Confirmation automatique', desc: 'Les RDV sont confirmés sans intervention de votre part', key: 'auto_confirm' as const },
        { label: 'Liste d\'attente', desc: 'Les patients peuvent s\'inscrire en liste d\'attente si aucun créneau n\'est disponible', key: 'waitlist_enabled' as const },
      ].map(({ label, desc, key }) => (
        <div key={key} className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl p-4 shadow-sm flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#0b1c30]">{label}</p>
            <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
          </div>
          <Toggle checked={form[key]} onChange={v => upd(key, v)} />
        </div>
      ))}

      <button onClick={() => save.mutate()} disabled={!dirty || save.isPending}
        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 disabled:opacity-40"
        style={{ backgroundColor: '#82d8ff' }}>
        {save.isPending ? 'Enregistrement…' : saved ? '✓ Enregistré' : 'Enregistrer les paramètres'}
      </button>
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

type TabKey = 'types' | 'planning' | 'exceptions' | 'lieux' | 'parametres'

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'types',      label: 'Types',      icon: 'event_note' },
  { key: 'planning',   label: 'Planning',   icon: 'calendar_month' },
  { key: 'exceptions', label: 'Exceptions', icon: 'event_busy' },
  { key: 'lieux',      label: 'Lieux',      icon: 'location_on' },
  { key: 'parametres', label: 'Paramètres', icon: 'tune' },
]

export default function AvailabilityPage() {
  const { data, isLoading, error } = useAvailData()
  const [tab, setTab] = useState<TabKey>('types')

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-2xl">
        <div className="h-8 w-64 bg-slate-200 rounded animate-pulse" />
        <div className="flex gap-2">{[1,2,3,4,5].map(i => <div key={i} className="h-9 w-24 bg-slate-100 rounded-xl animate-pulse" />)}</div>
        {[1,2,3].map(i => <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />)}
      </div>
    )
  }

  if (error || !data) {
    return <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">Erreur : {(error as Error)?.message}</div>
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-[#0b1c30]">Disponibilités</h1>
        <p className="text-sm text-[#6f787e] mt-1">Configurez vos types de consultations, planning hebdomadaire, exceptions et paramètres de réservation.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all flex-shrink-0"
            style={tab === t.key
              ? { backgroundColor: '#82d8ff', color: '#fff' }
              : { backgroundColor: 'rgba(255,255,255,0.60)', color: '#3f484d', border: '1px solid rgba(190,200,206,0.40)' }}>
            <Icon name={t.icon} size={15} color={tab === t.key ? '#fff' : '#6f787e'} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'types'      && <TypesTab data={data} />}
      {tab === 'planning'   && <PlanningTab data={data} />}
      {tab === 'exceptions' && <BlockedTab data={data} />}
      {tab === 'lieux'      && <LocationsTab data={data} />}
      {tab === 'parametres' && <SettingsTab data={data} />}
    </div>
  )
}
