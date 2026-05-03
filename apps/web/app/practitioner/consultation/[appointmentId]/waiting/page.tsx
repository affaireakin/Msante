'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface AppointmentInfo {
  patientName: string
  scheduledAt: string
  durationMin: number
  type: string
}

export default function PractitionerWaitingRoom() {
  const params = useParams()
  const router = useRouter()
  const appointmentId = params.appointmentId as string

  const [appointment, setAppointment] = useState<AppointmentInfo | null>(null)
  const [patientConnected, setPatientConnected] = useState(false)
  const [consultationId, setConsultationId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)

  useEffect(() => {
    let channel: RealtimeChannel | null = null

    async function init() {
      setIsLoading(true)
      setError(null)

      // Fetch appointment info with patient name
      const { data, error: fetchError } = await supabase
        .from('appointments')
        .select(`
          scheduled_at,
          duration_min,
          type,
          users!appointments_patient_id_fkey (
            full_name
          )
        `)
        .eq('id', appointmentId)
        .single()

      if (fetchError || !data) {
        setError('Impossible de charger les informations du rendez-vous.')
        setIsLoading(false)
        return
      }

      const rawUsers = data.users as unknown
      const usersData =
        rawUsers && !Array.isArray(rawUsers)
          ? (rawUsers as { full_name: string })
          : Array.isArray(rawUsers) && (rawUsers as { full_name: string }[]).length > 0
            ? (rawUsers as { full_name: string }[])[0]
            : null
      setAppointment({
        patientName: usersData?.full_name ?? 'Patient',
        scheduledAt: data.scheduled_at as string,
        durationMin: (data.duration_min as number) ?? 60,
        type: (data.type as string) ?? 'video',
      })

      // Check if consultation row already exists (patient already joined)
      const { data: existingConsultation } = await supabase
        .from('consultations')
        .select('id')
        .eq('appointment_id', appointmentId)
        .maybeSingle()

      if (existingConsultation) {
        setPatientConnected(true)
        setConsultationId(existingConsultation.id)
      }

      setIsLoading(false)

      // Subscribe to new consultation inserts for this appointment
      channel = supabase
        .channel(`consultation-waiting-${appointmentId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'consultations',
            filter: `appointment_id=eq.${appointmentId}`,
          },
          (payload) => {
            const newConsultation = payload.new as { id: string }
            setPatientConnected(true)
            setConsultationId(newConsultation.id)
          }
        )
        .subscribe()
    }

    void init()

    return () => {
      if (channel) {
        void supabase.removeChannel(channel)
      }
    }
  }, [appointmentId])

  async function handleStart() {
    if (!consultationId) return
    setIsStarting(true)
    setError(null)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/join-consultation`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
          },
          body: JSON.stringify({ consultationId }),
        }
      )

      if (!response.ok) {
        const errBody = (await response.json()) as { message?: string }
        throw new Error(errBody.message ?? 'Erreur lors du démarrage de la consultation.')
      }

      const joinData = (await response.json()) as {
        practitionerToken: string
        roomUrl: string
        consultationId: string
      }

      router.push(
        `/practitioner/consultation/${appointmentId}/session?token=${joinData.practitionerToken}&roomUrl=${encodeURIComponent(joinData.roomUrl)}&consultationId=${joinData.consultationId}`
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.')
      setIsStarting(false)
    }
  }

  const formattedDate = appointment
    ? new Date(appointment.scheduledAt).toLocaleString('fr-FR', {
        dateStyle: 'long',
        timeStyle: 'short',
      })
    : ''

  const typeLabel: Record<string, string> = {
    video: 'Vidéo',
    audio: 'Audio',
    chat: 'Chat',
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8f9ff] to-[#eff4ff] flex flex-col font-[Manrope]">
      {/* Google Fonts */}
      <link
        href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        rel="stylesheet"
      />

      {/* Header */}
      <header className="fixed top-0 w-full z-50 flex items-center justify-between px-6 py-4 bg-white/70 backdrop-blur-xl border-b border-sky-100/20 shadow-[0_8px_32px_0_rgba(130,216,255,0.08)]">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[#006685] text-3xl select-none">
            medical_services
          </span>
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-[#0b1c30] leading-none">
              M-Santé
            </h1>
            <p className="text-xs text-slate-500 font-medium">Clinical Portal</p>
          </div>
          <div className="ml-3 flex items-center gap-1.5 bg-[#e5eeff]/50 border border-[#d3e4fe] px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[#006685] inline-block" />
            <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#006685]">
              Portail Praticien
            </span>
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1">
          <button className="p-2 rounded-full hover:bg-sky-50/50 transition-colors" aria-label="Notifications">
            <span className="material-symbols-outlined text-sky-500 text-2xl select-none">
              notifications
            </span>
          </button>
          <button className="p-2 rounded-full hover:bg-sky-50/50 transition-colors" aria-label="Compte">
            <span className="material-symbols-outlined text-sky-500 text-2xl select-none">
              account_circle
            </span>
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="pt-[88px] flex-1 flex items-center justify-center p-6">
        <div className="bg-white/60 backdrop-blur-2xl rounded-2xl border border-white/80 shadow-xl shadow-sky-900/5 p-8 w-full max-w-lg">
          {/* Section header */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-[#0b1c30] mb-1">Salle d&apos;attente</h2>
            <p className="text-sm text-[#6f787e]">Préparez-vous pour la consultation</p>
          </div>

          {isLoading ? (
            /* Loading skeleton */
            <div className="space-y-3 animate-pulse">
              <div className="h-4 bg-[#d3e4fe] rounded-full w-3/4" />
              <div className="h-4 bg-[#d3e4fe] rounded-full w-1/2" />
              <div className="h-4 bg-[#d3e4fe] rounded-full w-2/3" />
            </div>
          ) : (
            <>
              {/* Appointment info card */}
              {appointment && (
                <div className="bg-[#eff4ff]/80 rounded-xl p-4 border border-[#d3e4fe]/50 mb-6 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[#006685] text-xl select-none">
                      person
                    </span>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#6f787e]">
                        Patient
                      </p>
                      <p className="text-sm font-semibold text-[#0b1c30]">
                        {appointment.patientName}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[#006685] text-xl select-none">
                      schedule
                    </span>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#6f787e]">
                        Date &amp; heure
                      </p>
                      <p className="text-sm font-semibold text-[#0b1c30]">{formattedDate}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[#006685] text-xl select-none">
                      timer
                    </span>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#6f787e]">
                        Durée
                      </p>
                      <p className="text-sm font-semibold text-[#0b1c30]">
                        {appointment.durationMin} minutes
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[#006685] text-xl select-none">
                      videocam
                    </span>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#6f787e]">
                        Type
                      </p>
                      <p className="text-sm font-semibold text-[#0b1c30]">
                        {typeLabel[appointment.type] ?? appointment.type}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Status badge */}
              <div className="flex justify-center mb-6">
                {patientConnected ? (
                  <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium px-4 py-2 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    Patient connecté
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium px-4 py-2 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-amber-400 inline-block animate-pulse" />
                    En attente du patient…
                  </div>
                )}
              </div>

              {/* Error */}
              {error && (
                <p className="text-sm text-[#ba1a1a] text-center mb-4">{error}</p>
              )}

              {/* Start button */}
              <button
                onClick={() => void handleStart()}
                disabled={!patientConnected || !consultationId || isStarting}
                className="w-full py-3 rounded-xl bg-[#006685] text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#005575] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_16px_rgba(0,102,133,0.2)]"
              >
                <span className="material-symbols-outlined text-xl select-none">video_call</span>
                {!patientConnected
                  ? 'En attente du patient…'
                  : isStarting
                    ? 'Démarrage…'
                    : 'Démarrer la consultation'}
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
