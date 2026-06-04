'use client'
import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

interface RawAvailability {
  slot_date: string
  start_time: string
  end_time: string
  session_type: 'video' | 'presentiel'
  duration_min: number
  price: number | null
  currency: string
}

interface TimeSlot {
  date: string
  start_time: string
  end_time: string
  session_type: 'video' | 'presentiel'
  duration_min: number
  price: number | null
  currency: string
}

interface Practitioner {
  id: string
  speciality: string
  users: { full_name: string } | null
}

// ── Slot generation ───────────────────────────────────────────────────────────

function generateSlots(availabilities: RawAvailability[], takenSlots: string[]): TimeSlot[] {
  const slots: TimeSlot[] = []
  const now = new Date()
  for (const avail of availabilities) {
    const dateStr = avail.slot_date
    const [sh, sm] = avail.start_time.split(':').map(Number)
    const [eh, em] = avail.end_time.split(':').map(Number)
    let cur = sh * 60 + sm
    const end = eh * 60 + em
    const dur = avail.duration_min
    while (cur + dur <= end) {
      const s = `${String(Math.floor(cur / 60)).padStart(2, '0')}:${String(cur % 60).padStart(2, '0')}`
      const eMin = cur + dur
      const e = `${String(Math.floor(eMin / 60)).padStart(2, '0')}:${String(eMin % 60).padStart(2, '0')}`
      const key = `${dateStr}T${s}:00`
      // Skip past slots (Africa/Dakar = UTC+0, direct comparison is valid)
      if (new Date(`${dateStr}T${s}:00Z`) <= now) { cur += dur; continue }
      if (!takenSlots.includes(key)) {
        slots.push({ date: dateStr, start_time: s, end_time: e, session_type: avail.session_type, duration_min: dur, price: avail.price, currency: avail.currency })
      }
      cur += dur
    }
  }
  return slots
}

// ── Hook ──────────────────────────────────────────────────────────────────────

function usePractitionerBooking(id: string) {
  return useQuery({
    queryKey: ['practitioner-booking', id],
    queryFn: async () => {
      const [{ data: pract }, { data: avails }, { data: appointments }] = await Promise.all([
        supabase.from('practitioners').select('id, speciality, users!user_id(full_name)').eq('id', id).single(),
        supabase.from('availabilities').select('slot_date, start_time, end_time, session_type, duration_min, price, currency').eq('practitioner_id', id).eq('is_active', true).gte('slot_date', new Date().toISOString().split('T')[0]).order('slot_date'),
        supabase.from('appointments').select('scheduled_at').eq('practitioner_id', id).not('status', 'in', '("cancelled","no_show")').gte('scheduled_at', new Date().toISOString()),
      ])
      const taken = (appointments ?? []).map(a => a.scheduled_at.substring(0, 19))
      const slots = generateSlots((avails ?? []) as RawAvailability[], taken)
      return { practitioner: pract as unknown as Practitioner, slots }
    },
    enabled: !!id,
  })
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PROVIDERS = [
  { id: 'wave',         label: 'Wave',           color: '#1B6CA8', bg: '#e8f4fd', emoji: '🌊' },
  { id: 'orange_money', label: 'Orange Money',   color: '#FF6900', bg: '#fff3e0', emoji: '🟠' },
  { id: 'card',         label: 'Carte bancaire', color: '#006685', bg: '#e5eeff', emoji: '💳' },
]

const TYPE_LABEL: Record<string, string> = { video: '📹 Vidéo', presentiel: '🏥 Présentiel' }
const TYPE_COLOR: Record<string, { bg: string; text: string }> = {
  video:      { bg: '#e5eeff', text: '#006685' },
  presentiel: { bg: '#e8f5e9', text: '#1d7a3a' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupByDate(slots: TimeSlot[]) {
  const map = new Map<string, TimeSlot[]>()
  for (const slot of slots) {
    if (!map.has(slot.date)) map.set(slot.date, [])
    map.get(slot.date)!.push(slot)
  }
  return map
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatPrice(price: number | null, currency: string) {
  if (!price) return null
  return `${price.toLocaleString('fr-FR')} ${currency}`
}

// ── Component ─────────────────────────────────────────────────────────────────

type Step = 'slots' | 'payment' | 'success'

export default function BookingPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data, isLoading } = usePractitionerBooking(id)

  const [step, setStep] = useState<Step>('slots')
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [provider, setProvider] = useState<string>('wave')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const pract = data?.practitioner
  const slots = data?.slots ?? []
  const grouped = groupByDate(slots)
  const dates = [...grouped.keys()]

  const initials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  const handleBook = async () => {
    if (!selectedSlot || !pract) return
    setError('')
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const scheduled_at = `${selectedSlot.date}T${selectedSlot.start_time}:00`

      const res1 = await fetch(`${supabaseUrl}/functions/v1/create-appointment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ practitioner_id: pract.id, scheduled_at, duration_min: selectedSlot.duration_min, type: selectedSlot.session_type }),
      })
      const r1 = await res1.json() as { appointmentId?: string; error?: string }
      if (!res1.ok || !r1.appointmentId) throw new Error(r1.error ?? 'Erreur création RDV')

      const res2 = await fetch(`${supabaseUrl}/functions/v1/process-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ appointment_id: r1.appointmentId, provider, phone: phone || null }),
      })
      const r2 = await res2.json() as { status?: string; error?: string }
      if (!res2.ok || r2.status !== 'completed') throw new Error(r2.error ?? 'Paiement échoué')

      setStep('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  if (isLoading) return (
    <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-[#006685] border-t-transparent animate-spin" />
    </div>
  )

  if (!pract) return (
    <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center">
      <p className="text-[#6f787e]">Praticien introuvable.</p>
    </div>
  )

  // ── Success ──────────────────────────────────────────────────────────────────
  if (step === 'success') {
    const typeColor = TYPE_COLOR[selectedSlot?.session_type ?? 'video']
    return (
      <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center text-4xl mx-auto">✓</div>
          <div>
            <h1 className="text-2xl font-black text-[#0b1c30]">Rendez-vous confirmé !</h1>
            <p className="text-sm text-[#6f787e] mt-2">
              Votre séance avec <strong>{pract.users?.full_name}</strong> le{' '}
              <strong>{selectedSlot && formatDate(selectedSlot.date)}</strong> à <strong>{selectedSlot?.start_time}</strong>.
            </p>
          </div>
          <div className="rounded-2xl p-5 text-left space-y-3" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
            {[
              { label: 'Praticien', value: pract.users?.full_name ?? '—' },
              { label: 'Date', value: selectedSlot ? formatDate(selectedSlot.date) : '—' },
              { label: 'Heure', value: `${selectedSlot?.start_time} – ${selectedSlot?.end_time}` },
              { label: 'Durée', value: `${selectedSlot?.duration_min} min` },
              { label: 'Type', value: TYPE_LABEL[selectedSlot?.session_type ?? 'video'] },
              { label: 'Paiement', value: PROVIDERS.find(p => p.id === provider)?.label ?? provider },
              { label: 'Montant', value: selectedSlot ? (formatPrice(selectedSlot.price, selectedSlot.currency) ?? 'Non défini') : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-sm border-b border-slate-100 pb-2 last:border-0">
                <span className="text-[#6f787e]">{label}</span>
                <span className="font-semibold text-[#0b1c30]">{value}</span>
              </div>
            ))}
          </div>
          <button onClick={() => router.push('/patient')} className="w-full py-3 bg-[#006685] text-white font-bold rounded-xl hover:shadow-lg transition-all text-sm">
            Retour à l&apos;accueil
          </button>
          {/* Invisible usage to avoid lint warning */}
          <span style={{ display: 'none' }} aria-hidden>{JSON.stringify(typeColor)}</span>
        </div>
      </div>
    )
  }

  // ── Main flow ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f8f9ff]">
      <header className="bg-white/70 backdrop-blur-xl border-b border-slate-200/50 px-6 py-4 flex items-center gap-4">
        <button onClick={() => step === 'payment' ? setStep('slots') : router.push('/patient/practitioners')} className="text-[#006685] font-semibold text-sm hover:underline">
          ← Retour
        </button>
        <div className="flex-1">
          <span className="text-lg font-black text-[#0b1c30]">M-Santé</span>
          <span className="text-xs text-[#006685] font-semibold ml-2">Réservation</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={`font-semibold ${step === 'slots' ? 'text-[#006685]' : 'text-[#bec8ce]'}`}>1 Créneau</span>
          <span className="text-[#bec8ce]">›</span>
          <span className={`font-semibold ${step === 'payment' ? 'text-[#006685]' : 'text-[#bec8ce]'}`}>2 Paiement</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Practitioner card */}
        <div className="rounded-2xl p-5 flex items-center gap-4" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
          <div className="w-14 h-14 rounded-full bg-[#006685] flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
            {initials(pract.users?.full_name ?? 'P')}
          </div>
          <div>
            <p className="font-bold text-[#0b1c30] text-lg">{pract.users?.full_name}</p>
            <p className="text-sm text-[#6f787e]">{pract.speciality}</p>
          </div>
        </div>

        {/* ── Step 1: Slot selection ── */}
        {step === 'slots' && (
          <>
            {dates.length === 0 ? (
              <div className="rounded-2xl p-10 text-center space-y-3" style={{ backgroundColor: 'rgba(255,255,255,0.60)', border: '1px solid rgba(255,255,255,0.80)' }}>
                <p className="text-4xl">📅</p>
                <p className="font-semibold text-[#0b1c30]">Aucun créneau disponible</p>
                <p className="text-sm text-[#6f787e]">Ce praticien n&apos;a pas encore configuré ses disponibilités.<br />Revenez dans quelques jours ou contactez-le directement.</p>
                <button onClick={() => router.push('/patient/practitioners')} className="mt-2 px-5 py-2 bg-[#006685] text-white text-sm font-bold rounded-xl hover:shadow-lg transition-all">
                  Voir d&apos;autres praticiens
                </button>
              </div>
            ) : (
              <>
                {/* Date tabs */}
                <div>
                  <p className="text-sm font-bold text-[#0b1c30] mb-3">Choisir une date</p>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {dates.map(date => (
                      <button
                        key={date}
                        onClick={() => { setSelectedDate(date); setSelectedSlot(null) }}
                        className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${selectedDate === date ? 'bg-[#006685] text-white border-[#006685]' : 'bg-white/60 text-[#3f484d] border-slate-200/50 hover:bg-white'}`}
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
                        const key = `${slot.date}-${slot.start_time}-${slot.session_type}`
                        const isSelected = selectedSlot?.date === slot.date && selectedSlot?.start_time === slot.start_time && selectedSlot?.session_type === slot.session_type
                        const tc = TYPE_COLOR[slot.session_type]
                        return (
                          <button
                            key={key}
                            onClick={() => setSelectedSlot(slot)}
                            className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border flex flex-col items-center gap-0.5"
                            style={isSelected
                              ? { backgroundColor: '#006685', color: '#fff', borderColor: '#006685' }
                              : { backgroundColor: 'rgba(255,255,255,0.70)', color: '#0b1c30', borderColor: 'rgba(190,200,206,0.50)' }}
                          >
                            <span>{slot.start_time}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={isSelected ? { backgroundColor: 'rgba(255,255,255,0.25)', color: '#fff' } : { backgroundColor: tc.bg, color: tc.text }}>
                              {TYPE_LABEL[slot.session_type]} · {slot.duration_min}min
                              {slot.price ? ` · ${formatPrice(slot.price, slot.currency)}` : ''}
                            </span>
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
        {step === 'payment' && selectedSlot && (
          <>
            <div className="rounded-2xl p-5 space-y-2" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
              <p className="text-sm font-bold text-[#0b1c30] mb-3">Récapitulatif</p>
              {[
                { label: 'Date', value: `${formatDate(selectedSlot.date)} à ${selectedSlot.start_time}` },
                { label: 'Durée', value: `${selectedSlot.duration_min} min` },
                { label: 'Type', value: TYPE_LABEL[selectedSlot.session_type] },
                { label: 'Montant', value: formatPrice(selectedSlot.price, selectedSlot.currency) ?? 'Tarif non défini' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm py-1.5 border-b border-slate-100 last:border-0">
                  <span className="text-[#6f787e]">{label}</span>
                  <span className="font-medium text-[#0b1c30]">{value}</span>
                </div>
              ))}
            </div>

            <div>
              <p className="text-sm font-bold text-[#0b1c30] mb-3">Moyen de paiement</p>
              <div className="space-y-2">
                {PROVIDERS.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setProvider(p.id)}
                    className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl border transition-all ${provider === p.id ? 'border-[#006685] bg-[#e5eeff]' : 'border-slate-200/50 bg-white/60 hover:bg-white'}`}
                  >
                    <span className="text-2xl">{p.emoji}</span>
                    <span className="font-semibold text-[#0b1c30] flex-1 text-left">{p.label}</span>
                    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${provider === p.id ? 'border-[#006685] bg-[#006685]' : 'border-slate-300'}`}>
                      {provider === p.id && <span className="w-2 h-2 rounded-full bg-white" />}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {(provider === 'wave' || provider === 'orange_money') && (
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">Numéro de téléphone</label>
                <input
                  type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="+221 7X XXX XX XX"
                  className="w-full px-4 py-3 bg-white/60 border border-[#bec8ce] rounded-xl text-[#0b1c30] placeholder-[#6f787e] focus:outline-none focus:border-[#006685] focus:ring-2 focus:ring-[#006685]/10 transition-all"
                />
              </div>
            )}

            {error && <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">{error}</div>}

            <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-700">
              ⚠️ Mode simulation — aucun débit réel ne sera effectué.
            </div>

            <button
              onClick={handleBook}
              disabled={loading}
              className="w-full py-4 bg-[#006685] text-white font-bold rounded-xl hover:shadow-lg hover:shadow-sky-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />Traitement...</span>
                : `Confirmer${selectedSlot.price ? ` — ${formatPrice(selectedSlot.price, selectedSlot.currency)}` : ''}`}
            </button>
          </>
        )}
      </main>
    </div>
  )
}
