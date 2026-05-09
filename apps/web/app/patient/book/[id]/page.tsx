'use client'
import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// ── Slot generation (same logic as mobile) ──────────────────────────────────

interface RawAvailability {
  day_of_week: number
  start_time: string
  end_time: string
}

interface TimeSlot {
  date: string        // YYYY-MM-DD
  start_time: string  // HH:MM
  end_time: string
  available: boolean
}

function generateSlots(
  availabilities: RawAvailability[],
  takenSlots: string[],
  durationMin: number,
  daysAhead = 21,
): TimeSlot[] {
  const slots: TimeSlot[] = []
  const today = new Date()

  for (let d = 0; d < daysAhead; d++) {
    const date = new Date(today)
    date.setDate(today.getDate() + d)
    const dayOfWeek = date.getDay()
    const dateStr = date.toISOString().split('T')[0]

    for (const avail of availabilities.filter(a => a.day_of_week === dayOfWeek)) {
      const [sh, sm] = avail.start_time.split(':').map(Number)
      const [eh, em] = avail.end_time.split(':').map(Number)
      let cur = sh * 60 + sm
      const end = eh * 60 + em

      while (cur + durationMin <= end) {
        const s = `${String(Math.floor(cur / 60)).padStart(2, '0')}:${String(cur % 60).padStart(2, '0')}`
        const e_min = cur + durationMin
        const e = `${String(Math.floor(e_min / 60)).padStart(2, '0')}:${String(e_min % 60).padStart(2, '0')}`
        const key = `${dateStr}T${s}:00`
        slots.push({ date: dateStr, start_time: s, end_time: e, available: !takenSlots.includes(key) })
        cur += durationMin
      }
    }
  }
  return slots
}

// ── Data hooks ───────────────────────────────────────────────────────────────

interface Practitioner {
  id: string
  speciality: string
  session_price: number | null
  session_currency: string | null
  session_duration_min: number | null
  users: { full_name: string } | null
}

function usePractitionerBooking(id: string) {
  return useQuery({
    queryKey: ['practitioner-booking', id],
    queryFn: async () => {
      const [{ data: pract }, { data: avails }, { data: appointments }] = await Promise.all([
        supabase
          .from('practitioners')
          .select('id, speciality, session_price, session_currency, session_duration_min, users!inner(full_name)')
          .eq('id', id)
          .single(),
        supabase
          .from('availabilities')
          .select('day_of_week, start_time, end_time')
          .eq('practitioner_id', id)
          .eq('is_active', true),
        supabase
          .from('appointments')
          .select('scheduled_at')
          .eq('practitioner_id', id)
          .not('status', 'in', '("cancelled","no_show")')
          .gte('scheduled_at', new Date().toISOString()),
      ])

      const pData = pract as unknown as Practitioner
      const duration = pData?.session_duration_min ?? 60
      const taken = (appointments ?? []).map(a => a.scheduled_at.substring(0, 19))
      const slots = generateSlots(avails ?? [], taken, duration)
      return { practitioner: pData, slots, duration }
    },
    enabled: !!id,
  })
}

// ── Payment providers ────────────────────────────────────────────────────────

const PROVIDERS = [
  { id: 'wave', label: 'Wave', color: '#1B6CA8', bg: '#e8f4fd', emoji: '🌊' },
  { id: 'orange_money', label: 'Orange Money', color: '#FF6900', bg: '#fff3e0', emoji: '🟠' },
  { id: 'card', label: 'Carte bancaire', color: '#006685', bg: '#e5eeff', emoji: '💳' },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function groupByDate(slots: TimeSlot[]) {
  const map = new Map<string, TimeSlot[]>()
  for (const slot of slots) {
    if (!map.has(slot.date)) map.set(slot.date, [])
    map.get(slot.date)!.push(slot)
  }
  return map
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

// ── Main component ───────────────────────────────────────────────────────────

type Step = 'slots' | 'payment' | 'success'

export default function BookingPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data, isLoading } = usePractitionerBooking(id)

  const [step, setStep] = useState<Step>('slots')
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [sessionType, setSessionType] = useState<'video' | 'audio' | 'chat'>('video')
  const [provider, setProvider] = useState<string>('wave')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [appointmentId, setAppointmentId] = useState('')

  const pract = data?.practitioner
  const slots = data?.slots ?? []
  const grouped = groupByDate(slots.filter(s => s.available))
  const dates = [...grouped.keys()]

  const initials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  const handleBook = async () => {
    if (!selectedSlot || !pract) return
    setError('')
    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const scheduled_at = `${selectedSlot.date}T${selectedSlot.start_time}:00`

      // Step 1: create appointment
      const res1 = await fetch(`${supabaseUrl}/functions/v1/create-appointment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          practitioner_id: pract.id,
          scheduled_at,
          duration_min: data?.duration ?? 60,
          type: sessionType,
        }),
      })
      const r1 = await res1.json() as { appointmentId?: string; error?: string }
      if (!res1.ok || !r1.appointmentId) throw new Error(r1.error ?? 'Erreur création RDV')

      // Step 2: process payment
      const res2 = await fetch(`${supabaseUrl}/functions/v1/process-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          appointment_id: r1.appointmentId,
          provider,
          phone: phone || null,
        }),
      })
      const r2 = await res2.json() as { paymentId?: string; status?: string; error?: string }
      if (!res2.ok || r2.status !== 'completed') throw new Error(r2.error ?? 'Paiement échoué')

      setAppointmentId(r1.appointmentId)
      setStep('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#006685] border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!pract) {
    return (
      <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center">
        <p className="text-[#6f787e]">Praticien introuvable.</p>
      </div>
    )
  }

  // ── Success ──
  if (step === 'success') {
    return (
      <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center text-4xl mx-auto">✓</div>
          <div>
            <h1 className="text-2xl font-black text-[#0b1c30]">Rendez-vous confirmé !</h1>
            <p className="text-sm text-[#6f787e] mt-2">
              Votre séance avec <strong>{pract.users?.full_name}</strong> est réservée pour le{' '}
              <strong>{selectedSlot && formatDate(selectedSlot.date)}</strong> à{' '}
              <strong>{selectedSlot?.start_time}</strong>.
            </p>
          </div>
          <div
            className="rounded-2xl p-5 text-left space-y-3"
            style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}
          >
            {[
              { label: 'Praticien', value: pract.users?.full_name ?? '—' },
              { label: 'Date', value: selectedSlot ? formatDate(selectedSlot.date) : '—' },
              { label: 'Heure', value: `${selectedSlot?.start_time} – ${selectedSlot?.end_time}` },
              { label: 'Type', value: sessionType === 'video' ? 'Vidéo' : sessionType === 'audio' ? 'Audio' : 'Chat' },
              { label: 'Paiement', value: PROVIDERS.find(p => p.id === provider)?.label ?? provider },
              { label: 'Montant', value: pract.session_price ? `${pract.session_price.toLocaleString('fr-FR')} ${pract.session_currency ?? 'XOF'}` : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-sm border-b border-slate-100 pb-2 last:border-0">
                <span className="text-[#6f787e]">{label}</span>
                <span className="font-semibold text-[#0b1c30]">{value}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/patient')}
              className="flex-1 py-3 bg-[#006685] text-white font-bold rounded-xl hover:shadow-lg hover:shadow-sky-500/20 transition-all text-sm"
            >
              Retour à l&apos;accueil
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f9ff]">
      {/* Top bar */}
      <header className="bg-white/70 backdrop-blur-xl border-b border-slate-200/50 px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => step === 'payment' ? setStep('slots') : router.push('/patient')}
          className="text-[#006685] font-semibold text-sm hover:underline"
        >
          ← Retour
        </button>
        <div className="flex-1">
          <span className="text-lg font-black text-[#0b1c30]">M-Santé</span>
          <span className="text-xs text-[#006685] font-semibold ml-2">Réservation</span>
        </div>
        {/* Steps */}
        <div className="flex items-center gap-2 text-xs">
          <span className={`font-semibold ${step === 'slots' ? 'text-[#006685]' : 'text-[#bec8ce]'}`}>1 Créneau</span>
          <span className="text-[#bec8ce]">›</span>
          <span className={`font-semibold ${step === 'payment' ? 'text-[#006685]' : 'text-[#bec8ce]'}`}>2 Paiement</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Practitioner card */}
        <div
          className="rounded-2xl p-5 flex items-center gap-4"
          style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}
        >
          <div className="w-14 h-14 rounded-full bg-[#006685] flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
            {initials(pract.users?.full_name ?? 'P')}
          </div>
          <div>
            <p className="font-bold text-[#0b1c30] text-lg">{pract.users?.full_name}</p>
            <p className="text-sm text-[#6f787e]">{pract.speciality} · {data?.duration ?? 60} min</p>
            {pract.session_price && (
              <p className="text-sm font-semibold text-[#006685]">
                {pract.session_price.toLocaleString('fr-FR')} {pract.session_currency ?? 'XOF'}
              </p>
            )}
          </div>
        </div>

        {/* ── Step 1: Slot selection ── */}
        {step === 'slots' && (
          <>
            {/* Session type */}
            <div>
              <p className="text-sm font-bold text-[#0b1c30] mb-3">Type de consultation</p>
              <div className="flex gap-2">
                {([
                  { id: 'video', label: 'Vidéo', emoji: '📹' },
                  { id: 'audio', label: 'Audio', emoji: '🎙️' },
                  { id: 'chat', label: 'Chat', emoji: '💬' },
                ] as const).map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSessionType(t.id)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                      sessionType === t.id
                        ? 'bg-[#006685] text-white border-[#006685]'
                        : 'bg-white/60 text-[#3f484d] border-slate-200/50 hover:bg-white'
                    }`}
                  >
                    {t.emoji} {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Date tabs */}
            {dates.length === 0 ? (
              <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.60)', border: '1px solid rgba(255,255,255,0.80)' }}>
                <p className="text-[#6f787e]">Aucun créneau disponible pour les 3 prochaines semaines.</p>
              </div>
            ) : (
              <>
                <div>
                  <p className="text-sm font-bold text-[#0b1c30] mb-3">Choisir une date</p>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {dates.map(date => (
                      <button
                        key={date}
                        onClick={() => { setSelectedDate(date); setSelectedSlot(null) }}
                        className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                          selectedDate === date
                            ? 'bg-[#006685] text-white border-[#006685]'
                            : 'bg-white/60 text-[#3f484d] border-slate-200/50 hover:bg-white'
                        }`}
                      >
                        {formatDate(date)}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedDate && (
                  <div>
                    <p className="text-sm font-bold text-[#0b1c30] mb-3">Créneaux disponibles</p>
                    <div className="flex flex-wrap gap-2">
                      {(grouped.get(selectedDate) ?? []).map(slot => {
                        const key = `${slot.date}-${slot.start_time}`
                        const isSelected = selectedSlot?.date === slot.date && selectedSlot?.start_time === slot.start_time
                        return (
                          <button
                            key={key}
                            onClick={() => setSelectedSlot(slot)}
                            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                              isSelected
                                ? 'bg-[#006685] text-white border-[#006685]'
                                : 'bg-white/60 text-[#3f484d] border-slate-200/50 hover:bg-white'
                            }`}
                          >
                            {slot.start_time}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setStep('payment')}
                  disabled={!selectedSlot}
                  className="w-full py-4 bg-[#006685] text-white font-bold rounded-xl hover:shadow-lg hover:shadow-sky-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {selectedSlot
                    ? `Continuer — ${formatDate(selectedSlot.date)} à ${selectedSlot.start_time}`
                    : 'Sélectionnez un créneau'}
                </button>
              </>
            )}
          </>
        )}

        {/* ── Step 2: Payment ── */}
        {step === 'payment' && (
          <>
            {/* Summary */}
            <div
              className="rounded-2xl p-5 space-y-2"
              style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}
            >
              <p className="text-sm font-bold text-[#0b1c30] mb-3">Récapitulatif</p>
              {[
                { label: 'Date', value: selectedSlot ? `${formatDate(selectedSlot.date)} à ${selectedSlot.start_time}` : '' },
                { label: 'Durée', value: `${data?.duration ?? 60} min` },
                { label: 'Type', value: sessionType === 'video' ? 'Vidéo' : sessionType === 'audio' ? 'Audio' : 'Chat' },
                { label: 'Montant', value: pract.session_price ? `${pract.session_price.toLocaleString('fr-FR')} ${pract.session_currency ?? 'XOF'}` : 'Tarif non défini' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm py-1.5 border-b border-slate-100 last:border-0">
                  <span className="text-[#6f787e]">{label}</span>
                  <span className="font-medium text-[#0b1c30]">{value}</span>
                </div>
              ))}
            </div>

            {/* Provider selection */}
            <div>
              <p className="text-sm font-bold text-[#0b1c30] mb-3">Moyen de paiement</p>
              <div className="space-y-2">
                {PROVIDERS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setProvider(p.id)}
                    className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl border transition-all ${
                      provider === p.id
                        ? 'border-[#006685] bg-[#e5eeff]'
                        : 'border-slate-200/50 bg-white/60 hover:bg-white'
                    }`}
                  >
                    <span className="text-2xl">{p.emoji}</span>
                    <span className="font-semibold text-[#0b1c30] flex-1 text-left">{p.label}</span>
                    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      provider === p.id ? 'border-[#006685] bg-[#006685]' : 'border-slate-300'
                    }`}>
                      {provider === p.id && <span className="w-2 h-2 rounded-full bg-white" />}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Phone for Wave/Orange Money */}
            {(provider === 'wave' || provider === 'orange_money') && (
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
                  Numéro de téléphone
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+221 7X XXX XX XX"
                  className="w-full px-4 py-3 bg-white/60 border border-[#bec8ce] rounded-xl text-[#0b1c30] placeholder-[#6f787e] focus:outline-none focus:border-[#006685] focus:ring-2 focus:ring-[#006685]/10 transition-all"
                />
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-700">
              ⚠️ Mode simulation — aucun débit réel ne sera effectué.
            </div>

            <button
              onClick={handleBook}
              disabled={loading}
              className="w-full py-4 bg-[#006685] text-white font-bold rounded-xl hover:shadow-lg hover:shadow-sky-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Traitement en cours...
                </span>
              ) : (
                `Payer ${pract.session_price ? `${pract.session_price.toLocaleString('fr-FR')} ${pract.session_currency ?? 'XOF'}` : ''}`
              )}
            </button>
          </>
        )}
      </main>
    </div>
  )
}
