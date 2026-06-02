'use client'
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

const DURATIONS = [15, 30, 45, 60, 90, 120]
const TYPE_CONFIG = {
  video:      { label: 'Vidéo',      emoji: '📹', color: '#006685', bg: '#e5eeff' },
  presentiel: { label: 'Présentiel', emoji: '🏥', color: '#1d7a3a', bg: '#e8f5e9' },
}
const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const DAYS_SHORT = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']

function pad(n: number) { return String(n).padStart(2, '0') }
function toDateStr(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` }
function parseDate(s: string) { const [y,m,d] = s.split('-').map(Number); return new Date(y,m-1,d) }
function formatDateFR(s: string) {
  const d = parseDate(s)
  return d.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' })
}

function generatePreviewSlots(start: string, end: string, dur: number): string[] {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let cur = sh * 60 + sm
  const endMin = eh * 60 + em
  const slots: string[] = []
  while (cur + dur <= endMin) {
    slots.push(`${pad(Math.floor(cur/60))}:${pad(cur%60)}`)
    cur += dur
  }
  return slots
}

interface Availability {
  id: string
  slot_date: string
  start_time: string
  end_time: string
  is_active: boolean
  session_type: 'video' | 'presentiel'
  duration_min: number
  price: number | null
  currency: string
}

function usePractitionerData() {
  return useQuery({
    queryKey: ['practitioner-avail-page'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')
      const { data: pract, error: pErr } = await supabase
        .from('practitioners')
        .select('id, verification_status')
        .eq('user_id', user.id)
        .single()
      if (pErr || !pract) throw new Error('Profil praticien introuvable.')
      const today = toDateStr(new Date())
      const { data: avails, error: aErr } = await supabase
        .from('availabilities')
        .select('id, slot_date, start_time, end_time, is_active, session_type, duration_min, price, currency')
        .eq('practitioner_id', pract.id)
        .gte('slot_date', today)
        .order('slot_date')
        .order('start_time')
      if (aErr) throw new Error(aErr.message)
      return { practitionerId: pract.id, availabilities: (avails ?? []) as Availability[] }
    },
  })
}

// Build a 6-week calendar grid starting from today
function buildCalendarWeeks(baseDate: Date, year: number, month: number) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const weeks: (Date | null)[][] = []
  let week: (Date | null)[] = Array(firstDay.getDay()).fill(null)
  for (let d = 1; d <= lastDay.getDate(); d++) {
    week.push(new Date(year, month, d))
    if (week.length === 7) { weeks.push(week); week = [] }
  }
  if (week.length > 0) { while (week.length < 7) week.push(null); weeks.push(week) }
  return weeks
}

export default function AvailabilityPage() {
  const queryClient = useQueryClient()
  const { data, isLoading, error } = usePractitionerData()

  // Calendar navigation
  const today = new Date()
  const [calYear, setCalYear]   = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())

  // Add modal
  const [addModal, setAddModal] = useState<{ date: string } | null>(null)
  const [newStart, setNewStart]       = useState('09:00')
  const [newEnd, setNewEnd]           = useState('17:00')
  const [newType, setNewType]         = useState<'video' | 'presentiel'>('video')
  const [newDuration, setNewDuration] = useState(60)
  const [newPrice, setNewPrice]       = useState('')
  const [newCurrency, setNewCurrency] = useState('XOF')

  const slots = data?.availabilities ?? []
  const slotsByDate = useMemo(() => {
    const map = new Map<string, Availability[]>()
    for (const s of slots) {
      if (!map.has(s.slot_date)) map.set(s.slot_date, [])
      map.get(s.slot_date)!.push(s)
    }
    return map
  }, [slots])

  const weeks = buildCalendarWeeks(today, calYear, calMonth)

  const todayStr = toDateStr(today)

  const toggleSlot = useMutation({
    mutationFn: async (slot: Availability) => {
      const { error } = await supabase.from('availabilities').update({ is_active: !slot.is_active }).eq('id', slot.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['practitioner-avail-page'] }),
  })

  const deleteSlot = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('availabilities').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['practitioner-avail-page'] }),
  })

  const addSlot = useMutation({
    mutationFn: async () => {
      if (!addModal || !data) return
      const { error } = await supabase.from('availabilities').insert({
        practitioner_id: data.practitionerId,
        slot_date: addModal.date,
        start_time: newStart,
        end_time: newEnd,
        is_active: true,
        session_type: newType,
        duration_min: newDuration,
        price: newPrice ? parseFloat(newPrice) : null,
        currency: newCurrency,
      })
      if (error) throw error
      setAddModal(null)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['practitioner-avail-page'] }),
  })

  function openAddModal(dateStr: string) {
    setAddModal({ date: dateStr })
    setNewStart('09:00'); setNewEnd('17:00')
    setNewType('video'); setNewDuration(60)
    setNewPrice(''); setNewCurrency('XOF')
  }

  function prevMonth() {
    if (calMonth === 0) { setCalYear(y => y-1); setCalMonth(11) }
    else setCalMonth(m => m-1)
  }
  function nextMonth() {
    if (calMonth === 11) { setCalYear(y => y+1); setCalMonth(0) }
    else setCalMonth(m => m+1)
  }

  if (isLoading) return (
    <div className="space-y-3">
      {Array.from({length:4}).map((_,i) => <div key={i} className="h-20 rounded-2xl bg-white/40 animate-pulse" />)}
    </div>
  )

  if (error) return (
    <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">
      Erreur : {(error as Error).message}
    </div>
  )

  // Upcoming slots (next 60 days grouped by date)
  const upcomingDates = [...slotsByDate.keys()].sort()

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-[#0b1c30]">Mes disponibilités</h1>
        <p className="text-sm text-[#6f787e] mt-1">
          Cliquez sur une date pour ajouter un créneau. Chaque créneau est lié à une date précise.
        </p>
      </div>

      {/* Calendar */}
      <div className="rounded-2xl p-5" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#e5eeff] transition-colors text-[#006685]">
            <span className="material-symbols-outlined" style={{fontSize:'18px'}}>chevron_left</span>
          </button>
          <p className="font-bold text-[#0b1c30] text-sm">{MONTHS_FR[calMonth]} {calYear}</p>
          <button onClick={nextMonth} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#e5eeff] transition-colors text-[#006685]">
            <span className="material-symbols-outlined" style={{fontSize:'18px'}}>chevron_right</span>
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-2">
          {DAYS_SHORT.map(d => (
            <div key={d} className="text-center text-xs font-bold text-[#6f787e] py-1">{d}</div>
          ))}
        </div>

        {/* Days grid */}
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1 mb-1">
            {week.map((day, di) => {
              if (!day) return <div key={di} />
              const dateStr = toDateStr(day)
              const isPast = dateStr < todayStr
              const hasSlots = slotsByDate.has(dateStr)
              const isToday = dateStr === todayStr

              return (
                <button
                  key={di}
                  onClick={() => !isPast && openAddModal(dateStr)}
                  disabled={isPast}
                  className={`relative h-10 rounded-xl flex flex-col items-center justify-center text-xs font-semibold transition-all ${
                    isPast ? 'text-[#bec8ce] cursor-not-allowed' :
                    isToday ? 'bg-[#006685] text-white shadow-md' :
                    hasSlots ? 'bg-[#e5eeff] text-[#006685] hover:bg-[#006685] hover:text-white' :
                    'text-[#0b1c30] hover:bg-[#e5eeff] hover:text-[#006685]'
                  }`}
                >
                  {day.getDate()}
                  {hasSlots && !isToday && (
                    <div className="absolute bottom-1 w-1 h-1 rounded-full bg-[#006685]" />
                  )}
                </button>
              )
            })}
          </div>
        ))}
        <p className="text-xs text-[#6f787e] mt-3">
          <span className="inline-block w-2 h-2 rounded-full bg-[#006685] mr-1" />Les dates avec créneaux configurés sont indiquées en bleu
        </p>
      </div>

      {/* Upcoming slots list */}
      {upcomingDates.length === 0 ? (
        <div className="rounded-2xl p-10 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.60)', border: '1px solid rgba(255,255,255,0.80)' }}>
          <span className="material-symbols-outlined text-[#bec8ce]" style={{fontSize:'48px'}}>calendar_month</span>
          <p className="font-semibold text-[#0b1c30] mt-3">Aucun créneau configuré</p>
          <p className="text-sm text-[#6f787e] mt-1">Cliquez sur une date dans le calendrier pour ajouter votre premier créneau</p>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-[#6f787e] uppercase tracking-wide">Créneaux à venir</h2>
          {upcomingDates.map(dateStr => {
            const dateSlots = slotsByDate.get(dateStr)!
            return (
              <div key={dateStr} className="rounded-2xl p-5" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="font-bold text-[#0b1c30] text-sm capitalize">{formatDateFR(dateStr)}</p>
                  <button
                    onClick={() => openAddModal(dateStr)}
                    className="text-xs font-bold text-[#006685] px-3 py-1 rounded-full bg-[#e5eeff] hover:bg-[#006685] hover:text-white transition-all"
                  >
                    + Créneau
                  </button>
                </div>
                <div className="space-y-3">
                  {dateSlots.map(slot => {
                    const times = generatePreviewSlots(slot.start_time.slice(0,5), slot.end_time.slice(0,5), slot.duration_min)
                    const cfg = TYPE_CONFIG[slot.session_type ?? 'video']
                    return (
                      <div key={slot.id}>
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <button
                            onClick={() => toggleSlot.mutate(slot)}
                            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                              slot.is_active
                                ? 'bg-[#006685] text-white border-[#006685]'
                                : 'bg-slate-100 text-slate-400 border-slate-200 line-through'
                            }`}
                          >
                            {slot.start_time.slice(0,5)} – {slot.end_time.slice(0,5)}
                          </button>
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                            {cfg.emoji} {cfg.label}
                          </span>
                          <span className="text-xs text-[#6f787e]">{slot.duration_min} min · {times.length} créneaux</span>
                          {slot.price && (
                            <span className="text-xs font-bold text-[#006685]">{slot.price.toLocaleString('fr-FR')} {slot.currency}</span>
                          )}
                          <button
                            onClick={() => deleteSlot.mutate(slot.id)}
                            className="ml-auto text-slate-300 hover:text-red-500 transition-colors"
                            title="Supprimer"
                          >
                            <span className="material-symbols-outlined" style={{fontSize:'16px'}}>delete</span>
                          </button>
                        </div>
                        {slot.is_active && times.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pl-2">
                            {times.map(t => (
                              <span key={t} className="px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ backgroundColor: cfg.bg, color: cfg.color }}>{t}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add modal */}
      {addModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setAddModal(null)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="text-lg font-bold text-[#0b1c30] mb-0.5">Nouveau créneau</h3>
            <p className="text-sm font-semibold text-[#006685] mb-5 capitalize">{formatDateFR(addModal.date)}</p>

            {/* Type */}
            <div className="mb-4">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Type de consultation</p>
              <div className="flex gap-2">
                {(['video', 'presentiel'] as const).map(t => {
                  const cfg = TYPE_CONFIG[t]
                  return (
                    <button key={t} onClick={() => setNewType(t)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all"
                      style={newType === t
                        ? { backgroundColor: cfg.color, color: '#fff', borderColor: cfg.color }
                        : { backgroundColor: '#f8f9ff', color: '#6f787e', borderColor: '#e2e8f0' }}>
                      {cfg.emoji} {cfg.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Duration */}
            <div className="mb-4">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Durée par séance</p>
              <div className="flex flex-wrap gap-2">
                {DURATIONS.map(d => (
                  <button key={d} onClick={() => setNewDuration(d)}
                    className="px-3 py-1.5 rounded-full text-xs font-bold border transition-all"
                    style={newDuration === d
                      ? { backgroundColor: '#006685', color: '#fff', borderColor: '#006685' }
                      : { backgroundColor: '#f8f9ff', color: '#6f787e', borderColor: '#e2e8f0' }}>
                    {d} min
                  </button>
                ))}
              </div>
            </div>

            {/* Hours */}
            <div className="flex gap-3 mb-4">
              <div className="flex-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Début</label>
                <input type="time" value={newStart} onChange={e => setNewStart(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#006685]" />
              </div>
              <div className="flex-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">Fin</label>
                <input type="time" value={newEnd} onChange={e => setNewEnd(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#006685]" />
              </div>
            </div>

            {/* Price */}
            <div className="mb-4">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Tarif (optionnel)</p>
              <div className="flex gap-2">
                <input type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="ex: 15000"
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#006685]" />
                <select value={newCurrency} onChange={e => setNewCurrency(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#006685] bg-white">
                  <option value="XOF">XOF</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>

            {/* Preview */}
            {newStart && newEnd && newStart < newEnd && (() => {
              const preview = generatePreviewSlots(newStart, newEnd, newDuration)
              const cfg = TYPE_CONFIG[newType]
              return (
                <div className="rounded-xl p-3 mb-5" style={{ backgroundColor: cfg.bg }}>
                  <p className="text-xs font-bold mb-2" style={{ color: cfg.color }}>
                    {preview.length} créneau{preview.length > 1 ? 'x' : ''} de {newDuration} min :
                  </p>
                  {preview.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {preview.slice(0, 12).map(t => (
                        <span key={t} className="px-2 py-0.5 bg-white rounded-lg text-xs font-semibold" style={{ color: cfg.color }}>{t}</span>
                      ))}
                      {preview.length > 12 && <span className="text-xs" style={{ color: cfg.color }}>+{preview.length-12} autres</span>}
                    </div>
                  ) : (
                    <p className="text-xs text-amber-600">Plage trop courte pour {newDuration} min.</p>
                  )}
                </div>
              )
            })()}

            <div className="flex gap-3">
              <button onClick={() => setAddModal(null)}
                className="flex-1 py-2.5 border border-slate-200 rounded-full text-sm text-[#6f787e] hover:bg-slate-50">
                Annuler
              </button>
              <button
                onClick={() => addSlot.mutate()}
                disabled={addSlot.isPending || !newStart || !newEnd || newStart >= newEnd || generatePreviewSlots(newStart, newEnd, newDuration).length === 0}
                className="flex-1 py-2.5 bg-[#006685] text-white rounded-full text-sm font-bold hover:shadow-lg disabled:opacity-50">
                {addSlot.isPending ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
