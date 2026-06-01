'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const DAYS_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const DURATIONS = [15, 30, 45, 60, 90, 120]
const TYPE_CONFIG = {
  video:      { label: 'Vidéo',      emoji: '📹', color: '#006685', bg: '#e5eeff' },
  presentiel: { label: 'Présentiel', emoji: '🏥', color: '#1d7a3a', bg: '#e8f5e9' },
}

// Time slots from 07:00 to 20:00, step = session_duration_min
function generatePreviewSlots(
  start: string,
  end: string,
  durationMin: number,
): string[] {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let cur = sh * 60 + sm
  const endMin = eh * 60 + em
  const slots: string[] = []
  while (cur + durationMin <= endMin) {
    slots.push(`${String(Math.floor(cur / 60)).padStart(2, '0')}:${String(cur % 60).padStart(2, '0')}`)
    cur += durationMin
  }
  return slots
}

interface Availability {
  id: string
  day_of_week: number
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
        .select('id, verification_status, session_duration_min')
        .eq('user_id', user.id)
        .single()

      if (pErr || !pract) throw new Error('Profil praticien introuvable. Connectez-vous avec un compte praticien.')

      const { data: avails, error: aErr } = await supabase
        .from('availabilities')
        .select('id, day_of_week, start_time, end_time, is_active, session_type, duration_min, price, currency')
        .eq('practitioner_id', pract.id)
        .order('day_of_week')
        .order('start_time')

      if (aErr) throw new Error(aErr.message)

      return {
        practitionerId: pract.id,
        verificationStatus: pract.verification_status as string,
        duration: pract.session_duration_min ?? 60,
        availabilities: (avails ?? []) as Availability[],
      }
    },
  })
}

export default function AvailabilityPage() {
  const queryClient = useQueryClient()
  const { data, isLoading, error } = usePractitionerData()
  const [addModal, setAddModal] = useState<{ day: number } | null>(null)
  const [newStart, setNewStart] = useState('09:00')
  const [newEnd, setNewEnd] = useState('17:00')
  const [newType, setNewType] = useState<'video' | 'presentiel'>('video')
  const [newDuration, setNewDuration] = useState(60)
  const [newPrice, setNewPrice] = useState('')
  const [newCurrency, setNewCurrency] = useState('XOF')

  const toggleSlot = useMutation({
    mutationFn: async (slot: Availability) => {
      const { error } = await supabase
        .from('availabilities')
        .update({ is_active: !slot.is_active })
        .eq('id', slot.id)
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
        day_of_week: addModal.day,
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

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-white/40 animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">
        Erreur : {(error as Error).message}
      </div>
    )
  }

  const { availabilities, duration } = data!

  // Group by day
  const byDay = DAYS.map((label, day) => ({
    label,
    short: DAYS_SHORT[day],
    day,
    slots: availabilities.filter(a => a.day_of_week === day),
  }))

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-[#0b1c30]">Mes disponibilités</h1>
        <p className="text-sm text-[#6f787e] mt-1">
          Définissez vos plages horaires. Choisissez le type, la durée et le tarif par créneau.
        </p>
      </div>

      {/* Weekly grid */}
      <div className="space-y-3">
        {byDay.map(({ label, day, slots }) => {
          const activeSlots = slots.filter(s => s.is_active)
          const previewTimes = activeSlots.flatMap(s =>
            generatePreviewSlots(s.start_time.slice(0, 5), s.end_time.slice(0, 5), s.duration_min)
          )

          return (
            <div
              key={day}
              className="rounded-2xl p-5"
              style={{ backgroundColor: 'rgba(255,255,255,0.60)', border: '1px solid rgba(255,255,255,0.80)' }}
            >
              {/* Day header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className={`font-bold text-sm w-24 ${slots.length > 0 ? 'text-[#0b1c30]' : 'text-[#bec8ce]'}`}>
                    {label}
                  </span>
                  {slots.length === 0 && (
                    <span className="text-xs text-[#bec8ce]">Indisponible</span>
                  )}
                </div>
                <button
                  onClick={() => { setAddModal({ day }); setNewStart('09:00'); setNewEnd('17:00'); setNewType('video'); setNewDuration(60); setNewPrice(''); setNewCurrency('XOF') }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#e5eeff] text-[#006685] text-xs font-bold hover:bg-[#006685] hover:text-white transition-all"
                >
                  + Ajouter
                </button>
              </div>

              {/* Time range pills */}
              {slots.length > 0 && (
                <div className="space-y-3">
                  {slots.map(slot => {
                    const slotTimes = generatePreviewSlots(
                      slot.start_time.slice(0, 5),
                      slot.end_time.slice(0, 5),
                      duration
                    )
                    return (
                      <div key={slot.id}>
                        {/* Range header */}
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <button
                            onClick={() => toggleSlot.mutate(slot)}
                            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                              slot.is_active
                                ? 'bg-[#006685] text-white border-[#006685]'
                                : 'bg-slate-100 text-slate-400 border-slate-200 line-through'
                            }`}
                          >
                            {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                          </button>
                          <span
                            className="px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={{ backgroundColor: TYPE_CONFIG[slot.session_type ?? 'video'].bg, color: TYPE_CONFIG[slot.session_type ?? 'video'].color }}
                          >
                            {TYPE_CONFIG[slot.session_type ?? 'video'].emoji} {TYPE_CONFIG[slot.session_type ?? 'video'].label}
                          </span>
                          <span className="text-xs text-[#6f787e]">
                            {slot.duration_min} min · {slotTimes.length} créneau{slotTimes.length > 1 ? 'x' : ''}
                          </span>
                          {slot.price && (
                            <span className="text-xs font-bold text-[#006685]">
                              {slot.price.toLocaleString('fr-FR')} {slot.currency}
                            </span>
                          )}
                          <button
                            onClick={() => deleteSlot.mutate(slot.id)}
                            className="ml-auto text-slate-300 hover:text-red-500 transition-colors text-sm"
                            title="Supprimer"
                          >
                            ✕
                          </button>
                        </div>

                        {/* Individual slots preview */}
                        {slot.is_active && slotTimes.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pl-2">
                            {slotTimes.map(t => (
                              <span
                                key={t}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                                style={{ backgroundColor: TYPE_CONFIG[slot.session_type ?? 'video'].bg, color: TYPE_CONFIG[slot.session_type ?? 'video'].color }}
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Total slots summary */}
                  {previewTimes.length > 0 && (
                    <p className="text-xs text-[#6f787e] mt-1">
                      → <strong>{previewTimes.length} créneaux visibles</strong> chaque {label.toLowerCase()} pour les patients
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Info banner */}
      <div className="bg-[#e5eeff] rounded-2xl p-4 text-sm text-[#005e7a]">
        <p className="font-semibold mb-1">Comment ça marche ?</p>
        <ul className="space-y-0.5 text-xs">
          <li>• Ajoutez une plage horaire (ex: Lundi 09h-17h)</li>
          <li>• Les créneaux de {duration} min sont automatiquement générés et visibles aux patients</li>
          <li>• Désactivez une plage pour la rendre invisible sans la supprimer</li>
          <li>• Les créneaux déjà réservés sont automatiquement masqués</li>
        </ul>
      </div>

      {/* Add slot modal */}
      {addModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setAddModal(null)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="text-lg font-bold text-[#0b1c30] mb-1">
              Nouveau créneau — {DAYS[addModal.day]}
            </h3>
            <p className="text-sm text-[#6f787e] mb-5">Configurez le type, la durée et le tarif.</p>

            {/* Type */}
            <div className="mb-4">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Type de consultation</p>
              <div className="flex gap-2">
                {(['video', 'presentiel'] as const).map(t => {
                  const cfg = TYPE_CONFIG[t]
                  return (
                    <button
                      key={t}
                      onClick={() => setNewType(t)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all"
                      style={newType === t
                        ? { backgroundColor: cfg.color, color: '#fff', borderColor: cfg.color }
                        : { backgroundColor: '#f8f9ff', color: '#6f787e', borderColor: '#e2e8f0' }}
                    >
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
                  <button
                    key={d}
                    onClick={() => setNewDuration(d)}
                    className="px-3 py-1.5 rounded-full text-xs font-bold border transition-all"
                    style={newDuration === d
                      ? { backgroundColor: '#006685', color: '#fff', borderColor: '#006685' }
                      : { backgroundColor: '#f8f9ff', color: '#6f787e', borderColor: '#e2e8f0' }}
                  >
                    {d} min
                  </button>
                ))}
              </div>
            </div>

            {/* Horaires */}
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
                <input
                  type="number"
                  value={newPrice}
                  onChange={e => setNewPrice(e.target.value)}
                  placeholder="ex: 15000"
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#006685]"
                />
                <select
                  value={newCurrency}
                  onChange={e => setNewCurrency(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#006685] bg-white"
                >
                  <option value="XOF">XOF</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>

            {/* Preview */}
            {newStart && newEnd && newStart < newEnd && (
              <div className="rounded-xl p-3 mb-5" style={{ backgroundColor: TYPE_CONFIG[newType].bg }}>
                <p className="text-xs font-bold mb-2" style={{ color: TYPE_CONFIG[newType].color }}>
                  {generatePreviewSlots(newStart, newEnd, newDuration).length} créneaux de {newDuration} min générés :
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {generatePreviewSlots(newStart, newEnd, newDuration).slice(0, 12).map(t => (
                    <span key={t} className="px-2 py-0.5 bg-white rounded-lg text-xs font-semibold" style={{ color: TYPE_CONFIG[newType].color }}>{t}</span>
                  ))}
                  {generatePreviewSlots(newStart, newEnd, newDuration).length > 12 && (
                    <span className="text-xs" style={{ color: TYPE_CONFIG[newType].color }}>+{generatePreviewSlots(newStart, newEnd, newDuration).length - 12} autres</span>
                  )}
                </div>
                {generatePreviewSlots(newStart, newEnd, newDuration).length === 0 && (
                  <p className="text-xs text-amber-600">Plage trop courte pour {newDuration} min.</p>
                )}
              </div>
            )}

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
