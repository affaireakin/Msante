'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface AppointmentInfo {
  practitionerName: string
  speciality: string
  scheduledAt: string
  durationMin: number
  type: string
}

export default function PatientWaitingRoom() {
  const params = useParams()
  const router = useRouter()
  const appointmentId = params.appointmentId as string

  const [appointment, setAppointment] = useState<AppointmentInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isJoining, setIsJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      setIsLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('appointments')
        .select(`
          scheduled_at,
          duration_min,
          type,
          practitioners!inner (
            speciality,
            users!user_id ( full_name )
          )
        `)
        .eq('id', appointmentId)
        .single()

      if (fetchError || !data) {
        setError('Impossible de charger les informations du rendez-vous.')
        setIsLoading(false)
        return
      }

      const pract = data.practitioners as unknown as {
        speciality: string
        users: { full_name: string }
      }

      setAppointment({
        practitionerName: pract?.users?.full_name ?? 'Praticien',
        speciality: pract?.speciality ?? '',
        scheduledAt: data.scheduled_at as string,
        durationMin: (data.duration_min as number) ?? 60,
        type: (data.type as string) ?? 'video',
      })

      setIsLoading(false)
    }

    void init()
  }, [appointmentId])

  async function handleJoin() {
    setIsJoining(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-consultation-room`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
          },
          body: JSON.stringify({ appointmentId }),
        }
      )

      if (!response.ok) {
        const errBody = (await response.json()) as { message?: string }
        throw new Error(errBody.message ?? 'Erreur lors de la connexion à la salle.')
      }

      const body = (await response.json()) as {
        patientToken: string
        roomUrl: string
        consultationId: string
      }

      router.push(
        `/patient/consultation/${appointmentId}/session?token=${body.patientToken}&roomUrl=${encodeURIComponent(body.roomUrl)}&consultationId=${body.consultationId}`
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.')
      setIsJoining(false)
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
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[#006685] text-3xl select-none">
            favorite
          </span>
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-[#0b1c30] leading-none">
              M-Santé
            </h1>
            <p className="text-xs text-slate-500 font-medium">Espace Patient</p>
          </div>
          <div className="ml-3 flex items-center gap-1.5 bg-[#e5eeff]/50 border border-[#d3e4fe] px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[#006685] inline-block" />
            <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#006685]">
              Consultation
            </span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="pt-[88px] flex-1 flex items-center justify-center p-6">
        <div className="bg-white/60 backdrop-blur-2xl rounded-2xl border border-white/80 shadow-xl shadow-sky-900/5 p-8 w-full max-w-lg">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-[#0b1c30] mb-1">Salle d&apos;attente</h2>
            <p className="text-sm text-[#6f787e]">Préparez-vous pour votre consultation</p>
          </div>

          {isLoading ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-4 bg-[#d3e4fe] rounded-full w-3/4" />
              <div className="h-4 bg-[#d3e4fe] rounded-full w-1/2" />
              <div className="h-4 bg-[#d3e4fe] rounded-full w-2/3" />
            </div>
          ) : (
            <>
              {/* Appointment info */}
              {appointment && (
                <div className="bg-[#eff4ff]/80 rounded-xl p-4 border border-[#d3e4fe]/50 mb-6 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[#006685] text-xl select-none">
                      medical_services
                    </span>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#6f787e]">
                        Praticien
                      </p>
                      <p className="text-sm font-semibold text-[#0b1c30]">
                        {appointment.practitionerName}
                      </p>
                      {appointment.speciality && (
                        <p className="text-xs text-[#6f787e]">{appointment.speciality}</p>
                      )}
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

              {/* Tips */}
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-6 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-amber-700 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm select-none">tips_and_updates</span>
                  Avant de rejoindre
                </p>
                {[
                  'Assurez-vous d\'être dans un endroit calme et privé',
                  'Vérifiez votre connexion internet et votre caméra',
                  'Ayez votre liste de questions prête',
                ].map((tip) => (
                  <p key={tip} className="text-xs text-amber-700 flex items-start gap-2">
                    <span className="material-symbols-outlined text-sm mt-0.5 select-none">check_circle</span>
                    {tip}
                  </p>
                ))}
              </div>

              {/* Disclaimer */}
              <p className="text-[11px] text-[#6f787e] text-center mb-4">
                Cet outil ne remplace pas un professionnel de santé en cas d&apos;urgence.
                Appelez le <strong>15</strong> ou le <strong>+221 33 823 8020</strong>.
              </p>

              {error && (
                <p className="text-sm text-[#ba1a1a] text-center mb-4">{error}</p>
              )}

              <button
                onClick={() => void handleJoin()}
                disabled={isJoining}
                className="w-full py-3 rounded-xl bg-[#006685] text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#005575] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_16px_rgba(0,102,133,0.2)]"
              >
                <span className="material-symbols-outlined text-xl select-none">video_call</span>
                {isJoining ? 'Connexion en cours…' : 'Rejoindre la consultation'}
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
