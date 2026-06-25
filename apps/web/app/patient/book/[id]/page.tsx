'use client'
import { useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConsultationType {
  id: string; name: string; duration_min: number
  price: number | null; currency: string; color: string
  description: string | null; mode: 'presentiel' | 'video' | 'both'
}
interface WeeklyAvail {
  day_of_week: number; start_time: string; end_time: string
  consultation_type_ids: string[]; is_active: boolean
  location?: { name: string; address: string | null; city: string | null; is_teleconsult: boolean } | null
}
interface BlockedPeriod { start_date: string; end_date: string; start_time: string | null; end_time: string | null }
interface BookingSettings { min_booking_delay_h: number; max_booking_days_ahead: number; buffer_between_min: number; auto_confirm: boolean }

interface TimeSlot {
  date: string          // YYYY-MM-DD
  start_time: string   // HH:MM
  end_time: string
  type: ConsultationType
  location: WeeklyAvail['location']
  taken: boolean
}

// ─── Slot generation ──────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, '0') }

function generateSlots(
  weekly: WeeklyAvail[],
  types: ConsultationType[],
  blocked: BlockedPeriod[],
  taken: string[],
  settings: BookingSettings,
): TimeSlot[] {
  const slots: TimeSlot[] = []
  const now = new Date()
  const minDelay = settings.min_booking_delay_h * 60 * 60 * 1000
  const earliest = new Date(now.getTime() + minDelay)
  const latest = new Date(now)
  latest.setDate(latest.getDate() + settings.max_booking_days_ahead)

  // Use local date string to avoid UTC-vs-local day mismatch
  function localDateStr(d: Date) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }

  // Build blocked set
  const blockedDates = new Set<string>()
  for (const b of blocked) {
    const d = new Date(b.start_date + 'T00:00:00')
    const end = new Date(b.end_date + 'T00:00:00')
    while (d <= end) {
      blockedDates.add(localDateStr(d))
      d.setDate(d.getDate() + 1)
    }
  }

  // Walk each day in window
  const cursor = new Date(earliest)
  cursor.setHours(0, 0, 0, 0)
  while (cursor <= latest) {
    const dateStr = localDateStr(cursor)
    const dow = cursor.getDay()

    if (!blockedDates.has(dateStr)) {
      const daySlots = weekly.filter(w => w.is_active && w.day_of_week === dow)
      for (const avail of daySlots) {
        const availTypes = types.filter(t => avail.consultation_type_ids.includes(t.id))
        if (availTypes.length === 0) continue

        for (const ctype of availTypes) {
          const [sh, sm] = avail.start_time.split(':').map(Number)
          const [eh, em] = avail.end_time.split(':').map(Number)
          let cur = sh * 60 + sm
          const endMin = eh * 60 + em
          const dur = ctype.duration_min + settings.buffer_between_min

          while (cur + ctype.duration_min <= endMin) {
            const startStr = `${pad(Math.floor(cur / 60))}:${pad(cur % 60)}`
            const endMin2 = cur + ctype.duration_min
            const endStr = `${pad(Math.floor(endMin2 / 60))}:${pad(endMin2 % 60)}`
            const slotDt = new Date(`${dateStr}T${startStr}:00`)
            const takenKey = `${dateStr}T${startStr}:00`

            if (slotDt >= earliest) {
              slots.push({ date: dateStr, start_time: startStr, end_time: endStr, type: ctype, location: avail.location ?? null, taken: taken.includes(takenKey) })
            }
            cur += dur
          }
        }
      }
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return slots
}

// ─── Data hook ────────────────────────────────────────────────────────────────

function useBookingData(practId: string) {
  return useQuery({
    queryKey: ['booking-v2', practId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const patientId = user?.id ?? null

      const [
        { data: pract },
        { data: types },
        { data: weekly },
        { data: blocked },
        { data: settings },
        { data: appointments },
        { data: patientBlock },
      ] = await Promise.all([
        supabase.from('practitioners').select('id, speciality, accepting_new_patients, users!user_id(full_name)').eq('id', practId).single(),
        supabase.from('consultation_types').select('id, name, duration_min, price, currency, color, description, mode').eq('practitioner_id', practId).eq('is_active', true).order('sort_order'),
        supabase.from('weekly_availabilities').select('day_of_week, start_time, end_time, consultation_type_ids, is_active, location:practitioner_locations(name, address, city, is_teleconsult)').eq('practitioner_id', practId).eq('is_active', true),
        supabase.from('blocked_periods').select('start_date, end_date, start_time, end_time').eq('practitioner_id', practId).gte('end_date', new Date().toISOString().split('T')[0]),
        supabase.from('practitioner_booking_settings').select('min_booking_delay_h, max_booking_days_ahead, buffer_between_min, auto_confirm').eq('practitioner_id', practId).maybeSingle(),
        supabase.from('appointments').select('scheduled_at').eq('practitioner_id', practId).not('status', 'in', '("cancelled","no_show")').gte('scheduled_at', new Date().toISOString()),
        patientId
          ? supabase.from('practitioner_patient_blocks').select('reason, cooldown_until').eq('practitioner_id', practId).eq('patient_id', patientId).is('unblocked_at', null).maybeSingle()
          : Promise.resolve({ data: null }),
      ])

      const practData = pract as unknown as { id: string; speciality: string; accepting_new_patients: boolean; users: { full_name: string } | null }

      // Patient bloqué par ce praticien
      if (patientBlock) {
        return { pract: practData, types: [], slots: [], autoConfirm: false, blocked: true, blockReason: (patientBlock as { reason: string; cooldown_until: string | null }).reason, blockUntil: (patientBlock as { reason: string; cooldown_until: string | null }).cooldown_until }
      }

      // Praticien n'accepte plus de nouveaux patients
      if (practData && practData.accepting_new_patients === false) {
        return { pract: practData, types: [], slots: [], autoConfirm: false, blocked: true, blockReason: 'Ce praticien n\'accepte plus de nouveaux patients pour le moment.', blockUntil: null }
      }

      const defaultSettings: BookingSettings = { min_booking_delay_h: 2, max_booking_days_ahead: 60, buffer_between_min: 0, auto_confirm: true }
      const effectiveSettings: BookingSettings = settings ? { ...defaultSettings, ...settings } : defaultSettings
      const taken = (appointments ?? []).map(a => (a.scheduled_at as string).substring(0, 19))
      const slots = generateSlots(
        (weekly ?? []) as unknown as WeeklyAvail[],
        (types ?? []) as ConsultationType[],
        (blocked ?? []) as BlockedPeriod[],
        taken,
        effectiveSettings,
      )

      return {
        pract: practData,
        types: (types ?? []) as ConsultationType[],
        slots,
        autoConfirm: effectiveSettings.auto_confirm,
        blocked: false,
        blockReason: null,
        blockUntil: null,
      }
    },
    enabled: !!practId,
    staleTime: 0,
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupByDate(slots: TimeSlot[]) {
  const map = new Map<string, TimeSlot[]>()
  for (const s of slots) {
    if (!map.has(s.date)) map.set(s.date, [])
    map.get(s.date)!.push(s)
  }
  return map
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatDateLong(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

const PROVIDERS = [
  { id: 'wave',         label: 'Wave',           color: '#1B6CA8', bg: '#e8f4fd', icon: '🌊' },
  { id: 'orange_money', label: 'Orange Money',   color: '#FF6900', bg: '#fff3e0', icon: '🟠' },
  { id: 'card',         label: 'Carte bancaire', color: '#006685', bg: '#e5eeff', icon: '💳' },
]

type Step = 'type' | 'slot' | 'confirm' | 'payment' | 'success'

// ─── Component ────────────────────────────────────────────────────────────────

export default function BookingPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data, isLoading, error } = useBookingData(id)

  const [step, setStep] = useState<Step>('type')
  const [selectedType, setSelectedType] = useState<ConsultationType | null>(null)
  const [selectedMode, setSelectedMode] = useState<'presentiel' | 'video' | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [provider, setProvider] = useState('wave')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [bookingError, setBookingError] = useState('')

  // Blocage patient
  if (data?.blocked) {
    return (
      <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center p-6" style={{ fontFamily: 'Manrope' }}>
        <div className="bg-white rounded-2xl p-10 max-w-md w-full text-center space-y-5 shadow-xl">
          <div className="w-16 h-16 rounded-full bg-[#ffdad6] flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-[#ba1a1a]" style={{ fontSize: '32px' }}>block</span>
          </div>
          <h2 className="text-xl font-black text-[#0b1c30]">Réservation impossible</h2>
          <p className="text-sm text-[#6f787e]">{data.blockReason}</p>
          {data.blockUntil && (
            <p className="text-xs text-[#6f787e] bg-slate-50 rounded-xl px-4 py-2">
              Jusqu&apos;au {new Date(data.blockUntil).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          )}
          <button onClick={() => router.back()} className="w-full py-3 rounded-xl bg-[#006685] text-white font-semibold text-sm">
            Retour
          </button>
        </div>
      </div>
    )
  }

  const allSlots = data?.slots ?? []
  const types = data?.types ?? []

  // Filter slots by selected type and mode
  const filteredSlots = useMemo(() => {
    if (!selectedType) return []
    return allSlots.filter(s => {
      if (s.type.id !== selectedType.id) return false
      if (selectedMode === 'video' && s.location && !s.location.is_teleconsult) return false
      if (selectedMode === 'presentiel' && s.location?.is_teleconsult) return false
      return true
    })
  }, [allSlots, selectedType, selectedMode])

  const grouped = useMemo(() => groupByDate(filteredSlots), [filteredSlots])
  const dates = [...grouped.keys()]

  const initials = (n: string) => n.split(' ').map(x => x[0]).join('').toUpperCase().slice(0, 2)

  function selectType(t: ConsultationType) {
    setSelectedType(t)
    if (t.mode === 'presentiel') { setSelectedMode('presentiel'); setStep('slot') }
    else if (t.mode === 'video') { setSelectedMode('video'); setStep('slot') }
    else { setSelectedMode(null); setStep('slot') } // both → show mode selector in slot step
  }

  const handleBook = async () => {
    if (!selectedSlot || !data?.pract) return
    setBookingError(''); setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }

      const scheduled_at = `${selectedSlot.date}T${selectedSlot.start_time}:00`

      // Server-side double-booking check — catches race conditions and stale UI data
      const { count: conflictCount } = await supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('practitioner_id', data.pract.id)
        .eq('scheduled_at', scheduled_at)
        .not('status', 'in', '("cancelled","no_show")')

      if ((conflictCount ?? 0) > 0) {
        setBookingError('Ce créneau vient d\'être réservé. Veuillez choisir un autre horaire.')
        setSelectedSlot(null)
        setStep('slot')
        setLoading(false)
        return
      }

      const type = selectedMode === 'video' ? 'video' : 'audio'

      const { data: appt, error: apptErr } = await supabase.from('appointments').insert({
        patient_id: session.user.id,
        practitioner_id: data.pract.id,
        scheduled_at,
        duration_min: selectedSlot.type.duration_min,
        type,
        status: data.autoConfirm ? 'confirmed' : 'pending',
      }).select('id').single()

      if (apptErr || !appt) throw new Error(apptErr?.message ?? 'Erreur création RDV')
      setStep('success')
    } catch (e) {
      setBookingError(e instanceof Error ? e.message : 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) return (
    <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-[#006685] border-t-transparent animate-spin" />
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center space-y-4 shadow-xl">
        <span className="material-symbols-outlined text-[#ba1a1a] text-5xl">error</span>
        <p className="font-bold text-[#0b1c30]">Erreur de chargement</p>
        <p className="text-sm text-[#6f787e]">{(error as Error).message}</p>
        <button onClick={() => router.back()} className="w-full py-3 rounded-xl bg-[#006685] text-white font-semibold text-sm">Retour</button>
      </div>
    </div>
  )

  const pract = data?.pract
  if (!pract) return (
    <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center">
      <p className="text-[#6f787e]">Praticien introuvable.</p>
    </div>
  )

  // ── Success ───────────────────────────────────────────────────────────────
  if (step === 'success') return (
    <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center text-4xl mx-auto shadow-sm">✓</div>
        <div>
          <h1 className="text-2xl font-black text-[#0b1c30]">Rendez-vous {data?.autoConfirm ? 'confirmé' : 'en attente de validation'} !</h1>
          <p className="text-sm text-[#6f787e] mt-2">
            {data?.autoConfirm
              ? <>Votre séance avec <strong>{pract.users?.full_name}</strong> le <strong>{selectedSlot && formatDateLong(selectedSlot.date)}</strong> à <strong>{selectedSlot?.start_time}</strong> est confirmée.</>
              : <>Votre demande a été envoyée. Le praticien confirmera dans les 24h.</>}
          </p>
        </div>
        <div className="rounded-2xl p-5 text-left space-y-2.5" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
          {[
            { label: 'Praticien',        value: pract.users?.full_name ?? '—' },
            { label: 'Type',             value: selectedType?.name ?? '—' },
            { label: 'Mode',             value: selectedMode === 'video' ? '📹 Téléconsultation' : '🏥 Présentiel' },
            { label: 'Date',             value: selectedSlot ? formatDateLong(selectedSlot.date) : '—' },
            { label: 'Heure',            value: `${selectedSlot?.start_time} – ${selectedSlot?.end_time}` },
            { label: 'Durée',            value: `${selectedSlot?.type.duration_min} min` },
            { label: 'Tarif',            value: selectedSlot?.type.price ? `${selectedSlot.type.price.toLocaleString('fr-FR')} ${selectedSlot.type.currency}` : 'Non défini' },
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
      </div>
    </div>
  )

  // ── Step indicators ───────────────────────────────────────────────────────
  const STEPS: { key: Step; label: string }[] = [
    { key: 'type',    label: '1 Type' },
    { key: 'slot',    label: '2 Créneau' },
    { key: 'confirm', label: '3 Confirmation' },
    { key: 'payment', label: '4 Paiement' },
  ]

  return (
    <div className="-mx-4 md:-mx-8 min-h-screen bg-[#f8f9ff]">
      {/* Header */}
      <header className="bg-white/70 backdrop-blur-xl border-b border-slate-200/50 px-4 sm:px-6 py-4 flex items-center gap-4 sticky top-0 z-20">
        <button onClick={() => {
          if (step === 'slot') setStep('type')
          else if (step === 'confirm') setStep('slot')
          else if (step === 'payment') setStep('confirm')
          else router.push('/patient/practitioners')
        }} className="text-[#006685] font-semibold text-sm hover:underline flex items-center gap-1">
          ← Retour
        </button>
        <div className="flex-1">
          <span className="text-lg font-black text-[#0b1c30]">M-Santé</span>
          <span className="text-xs text-[#006685] font-semibold ml-2">Réservation</span>
        </div>
        <div className="hidden sm:flex items-center gap-1 text-xs">
          {STEPS.map((s, i) => (
            <span key={s.key} className="flex items-center gap-1">
              <span className={`font-semibold ${step === s.key ? 'text-[#006685]' : 'text-[#bec8ce]'}`}>{s.label}</span>
              {i < STEPS.length - 1 && <span className="text-[#bec8ce]">›</span>}
            </span>
          ))}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6">
        {/* Practitioner card */}
        <div className="rounded-2xl p-5 flex items-center gap-4" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
          <div className="w-14 h-14 rounded-full bg-[#006685] flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
            {initials(pract.users?.full_name ?? 'P')}
          </div>
          <div>
            <p className="font-bold text-[#0b1c30] text-lg">{pract.users?.full_name}</p>
            <p className="text-sm text-[#6f787e] capitalize">{pract.speciality}</p>
          </div>
        </div>

        {/* ── STEP 1 : Choisir un type ─────────────────────────────────── */}
        {step === 'type' && (
          <div className="space-y-4">
            <p className="font-bold text-[#0b1c30]">Quel type de consultation souhaitez-vous ?</p>
            {types.length === 0 ? (
              <div className="rounded-2xl p-10 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.60)', border: '1px solid rgba(255,255,255,0.80)' }}>
                <p className="text-4xl mb-3">📅</p>
                <p className="font-semibold text-[#0b1c30]">Aucun créneau disponible</p>
                <p className="text-sm text-[#6f787e] mt-1">Ce praticien n&apos;a pas encore configuré ses disponibilités.</p>
                <button onClick={() => router.push('/patient/practitioners')} className="mt-4 px-5 py-2 bg-[#006685] text-white text-sm font-bold rounded-xl">Voir d&apos;autres praticiens</button>
              </div>
            ) : (
              <div className="space-y-2">
                {types.map(t => (
                  <button key={t.id} onClick={() => selectType(t)}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl border transition-all hover:shadow-md text-left"
                    style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
                    <div className="w-4 h-12 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[#0b1c30]">{t.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-slate-400">{t.duration_min} min</span>
                        {t.price && <span className="text-xs font-semibold text-[#006685]">{t.price.toLocaleString('fr-FR')} {t.currency}</span>}
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `${t.color}15`, color: t.color }}>
                          {t.mode === 'both' ? '🏥 + 📹' : t.mode === 'video' ? '📹 Vidéo' : '🏥 Présentiel'}
                        </span>
                      </div>
                      {t.description && <p className="text-xs text-slate-400 mt-1 truncate">{t.description}</p>}
                    </div>
                    <svg className="w-5 h-5 text-slate-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2 : Choisir un créneau ──────────────────────────────── */}
        {step === 'slot' && selectedType && (
          <div className="space-y-5">
            {/* Type recap */}
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: `${selectedType.color}10`, border: `1px solid ${selectedType.color}30` }}>
              <div className="w-2 h-8 rounded-full" style={{ backgroundColor: selectedType.color }} />
              <div>
                <p className="text-sm font-bold text-[#0b1c30]">{selectedType.name}</p>
                <p className="text-xs text-slate-400">{selectedType.duration_min} min{selectedType.price ? ` · ${selectedType.price.toLocaleString('fr-FR')} ${selectedType.currency}` : ''}</p>
              </div>
            </div>

            {/* Mode selector si 'both' — optionnel, filtre les créneaux */}
            {selectedType.mode === 'both' && (
              <div>
                <p className="text-sm font-bold text-[#0b1c30] mb-2">
                  Mode de consultation{' '}
                  <span className="text-xs font-normal text-slate-400">(optionnel)</span>
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { value: 'presentiel' as const, label: 'Présentiel',      icon: '🏥', desc: 'En cabinet' },
                    { value: 'video'      as const, label: 'Téléconsultation', icon: '📹', desc: 'En ligne'  },
                  ]).map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setSelectedMode(selectedMode === opt.value ? null : opt.value)}
                      className="flex flex-col items-center gap-1.5 p-4 rounded-2xl border transition-all"
                      style={selectedMode === opt.value
                        ? { backgroundColor: '#e5eeff', borderColor: '#006685', color: '#006685' }
                        : { backgroundColor: 'rgba(255,255,255,0.70)', borderColor: 'rgba(190,200,206,0.50)', color: '#3f484d' }}
                    >
                      <span className="text-2xl">{opt.icon}</span>
                      <span className="font-bold text-sm">{opt.label}</span>
                      <span className="text-xs opacity-70">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Créneaux — toujours visibles dès qu'un type est sélectionné */}
            {dates.length === 0 ? (
              <div className="rounded-2xl p-10 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.60)', border: '1px solid rgba(255,255,255,0.80)' }}>
                <p className="text-4xl mb-3">📅</p>
                <p className="font-semibold text-[#0b1c30]">Aucun créneau disponible</p>
                <p className="text-sm text-[#6f787e] mt-1">Ce praticien n&apos;a pas encore de disponibilités configurées.</p>
              </div>
            ) : (
              <>
                <div>
                  <p className="text-sm font-bold text-[#0b1c30] mb-2">Choisir une date</p>
                  <div className="flex gap-2 overflow-x-auto pb-2 w-full min-w-0">
                    {dates.slice(0, 14).map(d => (
                      <button
                        key={d}
                        onClick={() => { setSelectedDate(d); setSelectedSlot(null) }}
                        className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${selectedDate === d ? 'bg-[#006685] text-white border-[#006685]' : 'bg-white/60 text-[#3f484d] border-slate-200/50 hover:bg-white'}`}
                      >
                        {formatDate(d)}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedDate && (
                  <div>
                    <p className="text-sm font-bold text-[#0b1c30] mb-2">
                      Créneaux disponibles — {formatDateLong(selectedDate)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(grouped.get(selectedDate) ?? []).map(slot => {
                        const key = `${slot.date}-${slot.start_time}`
                        const isSel = selectedSlot?.date === slot.date && selectedSlot?.start_time === slot.start_time
                        return (
                          <button
                            key={key}
                            onClick={() => { if (!slot.taken) setSelectedSlot(slot) }}
                            disabled={slot.taken}
                            title={slot.taken ? 'Créneau déjà réservé' : undefined}
                            className="px-4 py-3 rounded-xl text-sm font-semibold transition-all border flex flex-col items-center gap-0.5"
                            style={slot.taken
                              ? { backgroundColor: '#f1f5f9', color: '#94a3b8', borderColor: '#e2e8f0', cursor: 'not-allowed' }
                              : isSel
                              ? { backgroundColor: '#006685', color: '#fff', borderColor: '#006685' }
                              : { backgroundColor: 'rgba(255,255,255,0.70)', color: '#0b1c30', borderColor: 'rgba(190,200,206,0.50)' }}
                          >
                            <span className={`font-bold ${slot.taken ? 'line-through opacity-60' : ''}`}>{slot.start_time}</span>
                            {slot.taken
                              ? <span className="text-[9px] text-slate-400">Réservé</span>
                              : slot.location && <span className="text-[10px] opacity-70">{slot.location.name}</span>
                            }
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => { if (selectedSlot) setStep('confirm') }}
                  disabled={!selectedSlot}
                  className="w-full py-4 bg-[#006685] text-white font-bold rounded-xl hover:shadow-lg hover:shadow-sky-500/20 transition-all disabled:opacity-40"
                >
                  {selectedSlot
                    ? `Continuer — ${formatDate(selectedSlot.date)} à ${selectedSlot.start_time}`
                    : 'Sélectionnez un créneau'}
                </button>
              </>
            )}
          </div>
        )}

        {/* ── STEP 3 : Confirmation ─────────────────────────────────────── */}
        {step === 'confirm' && selectedSlot && (
          <div className="space-y-5">
            <p className="font-bold text-[#0b1c30]">Récapitulatif de votre réservation</p>
            <div className="rounded-2xl p-5 space-y-2.5" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
              {[
                { label: 'Type de consultation', value: selectedSlot.type.name },
                { label: 'Mode', value: selectedMode === 'video' ? '📹 Téléconsultation' : '🏥 Présentiel' },
                { label: 'Date', value: formatDateLong(selectedSlot.date) },
                { label: 'Heure', value: `${selectedSlot.start_time} – ${selectedSlot.end_time}` },
                { label: 'Durée', value: `${selectedSlot.type.duration_min} min` },
                ...(selectedSlot.location && !selectedSlot.location.is_teleconsult ? [{ label: 'Lieu', value: [selectedSlot.location.name, selectedSlot.location.address, selectedSlot.location.city].filter(Boolean).join(', ') }] : []),
                { label: 'Tarif', value: selectedSlot.type.price ? `${selectedSlot.type.price.toLocaleString('fr-FR')} ${selectedSlot.type.currency}` : 'Tarif non défini' },
                { label: 'Statut', value: data?.autoConfirm ? '✓ Confirmation automatique' : '⏳ En attente de validation praticien' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm py-1.5 border-b border-slate-100 last:border-0">
                  <span className="text-[#6f787e]">{label}</span>
                  <span className="font-medium text-[#0b1c30] text-right max-w-[60%]">{value}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep('slot')} className="flex-1 py-3 border border-slate-200 rounded-xl text-sm text-slate-500 hover:bg-slate-50">
                Modifier
              </button>
              {selectedSlot.type.price ? (
                <button onClick={() => setStep('payment')} className="flex-1 py-3 bg-[#006685] text-white font-bold rounded-xl hover:shadow-lg transition-all text-sm">
                  Passer au paiement →
                </button>
              ) : (
                <button onClick={handleBook} disabled={loading} className="flex-1 py-3 bg-[#006685] text-white font-bold rounded-xl hover:shadow-lg transition-all text-sm disabled:opacity-50">
                  {loading ? 'Confirmation…' : 'Confirmer le rendez-vous'}
                </button>
              )}
            </div>
            {bookingError && <p className="text-sm text-red-500 text-center">{bookingError}</p>}
          </div>
        )}

        {/* ── STEP 4 : Paiement ─────────────────────────────────────────── */}
        {step === 'payment' && selectedSlot && (
          <div className="space-y-5">
            <div className="rounded-2xl p-4" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#6f787e]">Total à régler</span>
                <span className="text-xl font-black text-[#0b1c30]">{selectedSlot.type.price?.toLocaleString('fr-FR')} {selectedSlot.type.currency}</span>
              </div>
            </div>

            <div>
              <p className="text-sm font-bold text-[#0b1c30] mb-2">Moyen de paiement</p>
              <div className="space-y-2">
                {PROVIDERS.map(p => (
                  <button key={p.id} onClick={() => setProvider(p.id)}
                    className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl border transition-all ${provider === p.id ? 'border-[#006685] bg-[#e5eeff]' : 'border-slate-200/50 bg-white/60 hover:bg-white'}`}>
                    <span className="text-2xl">{p.icon}</span>
                    <span className="font-semibold text-[#0b1c30] flex-1 text-left">{p.label}</span>
                    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${provider === p.id ? 'border-[#006685] bg-[#006685]' : 'border-slate-300'}`}>
                      {provider === p.id && <span className="w-2 h-2 rounded-full bg-white" />}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {(provider === 'wave' || provider === 'orange_money') && (
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">Numéro de téléphone</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+221 7X XXX XX XX"
                  className="w-full px-4 py-3 bg-white/60 border border-[#bec8ce] rounded-xl text-[#0b1c30] placeholder-[#6f787e] focus:outline-none focus:border-[#006685] transition-all" />
              </div>
            )}

            <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-700">
              ⚠️ Mode simulation — aucun débit réel ne sera effectué.
            </div>

            {bookingError && <p className="text-sm text-red-500 text-center">{bookingError}</p>}

            <button onClick={handleBook} disabled={loading}
              className="w-full py-4 bg-[#006685] text-white font-bold rounded-xl hover:shadow-lg hover:shadow-sky-500/20 transition-all disabled:opacity-50 text-sm">
              {loading
                ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />Traitement...</span>
                : `Confirmer — ${selectedSlot.type.price?.toLocaleString('fr-FR')} ${selectedSlot.type.currency}`}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
