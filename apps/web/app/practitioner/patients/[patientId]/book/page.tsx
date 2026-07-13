'use client'
import { useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  generateSlots, groupByDate, formatDate, formatDateLong,
  type ConsultationType, type WeeklyAvail, type BlockedPeriod, type BookingSettings, type TimeSlot,
} from '@/lib/availabilitySlots'

function Icon({ name, size = 18, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-symbols-outlined" style={{ fontSize: `${size}px`, color, lineHeight: 1 }}>{name}</span>
}

function useBookingForPatientData(patientId: string) {
  return useQuery({
    queryKey: ['pract-book-for-patient', patientId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')

      const [{ data: pract }, { data: patient }] = await Promise.all([
        supabase.from('practitioners').select('id, session_price, session_currency').eq('user_id', user.id).single(),
        supabase.from('users').select('id, full_name').eq('id', patientId).single(),
      ])
      if (!pract) throw new Error('Profil praticien introuvable')
      if (!patient) throw new Error('Patient introuvable')

      const [types, weekly, blocked, settings, appointments] = await Promise.all([
        supabase.from('consultation_types').select('id, name, duration_min, price, currency, color, description, mode').eq('practitioner_id', pract.id).eq('is_active', true).order('sort_order'),
        supabase.from('weekly_availabilities').select('day_of_week, specific_date, start_time, end_time, consultation_type_ids, is_active, location:practitioner_locations(name, address, city, is_teleconsult)').eq('practitioner_id', pract.id).eq('is_active', true),
        supabase.from('blocked_periods').select('start_date, end_date, start_time, end_time').eq('practitioner_id', pract.id).gte('end_date', new Date().toISOString().split('T')[0]),
        supabase.from('practitioner_booking_settings').select('min_booking_delay_h, max_booking_days_ahead, buffer_between_min, auto_confirm').eq('practitioner_id', pract.id).maybeSingle(),
        supabase.from('appointments').select('scheduled_at').eq('practitioner_id', pract.id).not('status', 'in', '("cancelled","no_show")').gte('scheduled_at', new Date().toISOString()),
      ])

      const defaultSettings: BookingSettings = { min_booking_delay_h: 0, max_booking_days_ahead: 60, buffer_between_min: 0, auto_confirm: true }
      const effectiveSettings: BookingSettings = settings.data ? { ...defaultSettings, ...settings.data } : defaultSettings
      const taken = (appointments.data ?? []).map(a => (a.scheduled_at as string).substring(0, 19))
      const slots = generateSlots(
        (weekly.data ?? []) as unknown as WeeklyAvail[],
        (types.data ?? []) as ConsultationType[],
        (blocked.data ?? []) as BlockedPeriod[],
        taken,
        effectiveSettings,
      )

      return {
        practitionerId: pract.id as string,
        patient: patient as { id: string; full_name: string },
        types: (types.data ?? []) as ConsultationType[],
        slots,
      }
    },
    enabled: !!patientId,
    staleTime: 0,
  })
}

type Step = 'type' | 'slot' | 'confirm' | 'success'

export default function PractitionerBookForPatientPage() {
  const { patientId } = useParams<{ patientId: string }>()
  const router = useRouter()
  const { data, isLoading, error } = useBookingForPatientData(patientId)

  const [step, setStep] = useState<Step>('type')
  const [selectedType, setSelectedType] = useState<ConsultationType | null>(null)
  const [selectedMode, setSelectedMode] = useState<'presentiel' | 'video' | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [loading, setLoading] = useState(false)
  const [bookingError, setBookingError] = useState('')

  const allSlots = data?.slots ?? []
  const types = data?.types ?? []

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

  function selectType(t: ConsultationType) {
    setSelectedType(t)
    if (t.mode === 'presentiel') setSelectedMode('presentiel')
    else if (t.mode === 'video') setSelectedMode('video')
    else setSelectedMode(null)
    setStep('slot')
  }

  async function handleConfirm() {
    if (!selectedSlot || !data) return
    setBookingError(''); setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/auth/login'); return }

      const scheduled_at = `${selectedSlot.date}T${selectedSlot.start_time}:00Z`
      const type = selectedMode === 'video' ? 'video' : 'audio'

      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-practitioner-appointment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          practitioner_id: data.practitionerId,
          patient_id: data.patient.id,
          scheduled_at,
          duration_min: selectedSlot.type.duration_min,
          type,
          service_id: selectedSlot.type.id,
        }),
      })
      const body = await res.json() as { error?: string }
      if (!res.ok) { setBookingError(body.error ?? 'Erreur lors de la création du rendez-vous'); setLoading(false); return }
      setStep('success')
    } catch {
      setBookingError('Erreur réseau, réessayez.')
    } finally {
      setLoading(false)
    }
  }

  if (isLoading) {
    return <div className="max-w-2xl mx-auto p-6"><div className="h-40 bg-slate-100 rounded-xl animate-pulse" /></div>
  }
  if (error || !data) {
    return <div className="max-w-2xl mx-auto p-6 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">Erreur : {(error as Error)?.message}</div>
  }

  if (step === 'success') {
    return (
      <div className="max-w-lg mx-auto p-6">
        <div className="rounded-2xl p-10 text-center space-y-4" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
            <Icon name="check_circle" size={32} color="#1d7a3a" />
          </div>
          <h2 className="text-xl font-bold text-[#0b1c30]">Rendez-vous programmé</h2>
          <p className="text-sm text-[#6f787e]">
            Le RDV avec {data.patient.full_name} le {selectedSlot ? formatDateLong(selectedSlot.date) : ''} à {selectedSlot?.start_time} a été confirmé et le patient a été notifié.
          </p>
          <button onClick={() => router.push(`/practitioner/patients/${patientId}/journey`)}
            className="w-full py-3 rounded-xl text-sm font-bold text-white" style={{ backgroundColor: '#82d8ff' }}>
            Retour à la fiche patient
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => {
          if (step === 'slot') setStep('type')
          else if (step === 'confirm') setStep('slot')
          else router.push(`/practitioner/patients/${patientId}/journey`)
        }} className="text-[#82d8ff] font-semibold text-sm hover:underline flex items-center gap-1">
          ← Retour
        </button>
        <div>
          <h1 className="text-xl font-bold text-[#0b1c30]">Planifier un RDV</h1>
          <p className="text-sm text-[#6f787e]">Pour {data.patient.full_name}</p>
        </div>
      </div>

      {/* Step 1: type */}
      {step === 'type' && (
        <div className="space-y-3">
          {types.length === 0 ? (
            <div className="rounded-2xl p-10 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.60)', border: '1px solid rgba(255,255,255,0.80)' }}>
              <Icon name="event_busy" size={36} color="#cbd5e1" />
              <p className="font-semibold text-[#0b1c30] mt-3">Aucun type de consultation configuré</p>
              <p className="text-sm text-[#6f787e] mt-1">Configurez vos types de consultation dans Disponibilités.</p>
            </div>
          ) : types.map(t => (
            <button key={t.id} onClick={() => selectType(t)}
              className="w-full text-left rounded-xl p-4 flex items-center gap-3 transition-all hover:shadow-md"
              style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
              <div className="w-3 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#0b1c30]">{t.name}</p>
                <p className="text-xs text-[#6f787e]">{t.duration_min} min{t.price ? ` · ${t.price.toLocaleString('fr-FR')} ${t.currency}` : ''}</p>
              </div>
              <Icon name="chevron_right" size={20} color="#6f787e" />
            </button>
          ))}
        </div>
      )}

      {/* Step 2: slot */}
      {step === 'slot' && (
        <div className="space-y-4">
          {selectedType?.mode === 'both' && (
            <div className="grid grid-cols-2 gap-2">
              {(['video', 'presentiel'] as const).map(m => (
                <button key={m} onClick={() => setSelectedMode(m)}
                  className="py-2.5 rounded-xl text-sm font-semibold border transition-all"
                  style={{ borderColor: selectedMode === m ? '#82d8ff' : '#e2e8f0', backgroundColor: selectedMode === m ? '#e5eeff' : 'transparent', color: selectedMode === m ? '#82d8ff' : '#6f787e' }}>
                  {m === 'video' ? '📹 Téléconsultation' : '🏥 Présentiel'}
                </button>
              ))}
            </div>
          )}

          {dates.length === 0 ? (
            <div className="rounded-2xl p-10 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.60)', border: '1px solid rgba(255,255,255,0.80)' }}>
              <p className="text-sm text-[#6f787e]">Aucun créneau disponible pour ce type de consultation.</p>
            </div>
          ) : (
            <>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {dates.map(d => (
                  <button key={d} onClick={() => setSelectedDate(d)}
                    className="px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0"
                    style={selectedDate === d ? { backgroundColor: '#82d8ff', color: '#fff' } : { backgroundColor: 'rgba(255,255,255,0.60)', color: '#3f484d', border: '1px solid rgba(190,200,206,0.40)' }}>
                    {formatDate(d)}
                  </button>
                ))}
              </div>
              {selectedDate && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {(grouped.get(selectedDate) ?? []).filter(s => !s.taken).map(s => (
                    <button key={s.start_time} onClick={() => { setSelectedSlot(s); setStep('confirm') }}
                      className="py-2.5 rounded-xl text-sm font-semibold border transition-all hover:border-[#82d8ff]"
                      style={{ borderColor: '#e2e8f0', color: '#0b1c30' }}>
                      {s.start_time}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Step 3: confirm */}
      {step === 'confirm' && selectedSlot && (
        <div className="space-y-4">
          <div className="rounded-2xl p-5 space-y-3" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
            {[
              { label: 'Patient', value: data.patient.full_name },
              { label: 'Type', value: selectedSlot.type.name },
              { label: 'Date', value: formatDateLong(selectedSlot.date) },
              { label: 'Heure', value: `${selectedSlot.start_time} – ${selectedSlot.end_time}` },
              { label: 'Mode', value: selectedMode === 'video' ? '📹 Téléconsultation' : '🏥 Présentiel' },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between text-sm">
                <span className="text-[#6f787e]">{row.label}</span>
                <span className="font-semibold text-[#0b1c30]">{row.value}</span>
              </div>
            ))}
          </div>

          {bookingError && <p className="text-sm text-[#ba1a1a] bg-red-50 rounded-lg px-3 py-2">{bookingError}</p>}

          <button onClick={() => void handleConfirm()} disabled={loading}
            className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{ backgroundColor: '#82d8ff' }}>
            {loading ? 'Création…' : 'Confirmer le rendez-vous'}
          </button>
        </div>
      )}
    </div>
  )
}
