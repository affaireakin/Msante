'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import type { DailyCall } from '@daily-co/daily-js'
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { ChatMessage } from '@/types/consultation'

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function PractitionerSessionPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()

  const appointmentId = params.appointmentId as string
  const token = searchParams.get('token') ?? ''
  const roomUrl = searchParams.get('roomUrl') ?? ''
  const consultationId = searchParams.get('consultationId') ?? ''

  // ── Daily.co refs ──────────────────────────────────────────────────────────
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const callFrameRef = useRef<DailyCall | null>(null)

  // ── Realtime channel ref ───────────────────────────────────────────────────
  const channelRef = useRef<RealtimeChannel | null>(null)

  // ── State ──────────────────────────────────────────────────────────────────
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOn, setIsCameraOn] = useState(true)
  const [activeTab, setActiveTab] = useState<'notes' | 'chat'>('notes')
  const [notes, setNotes] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [sessionSeconds, setSessionSeconds] = useState(0)
  const [isEnding, setIsEnding] = useState(false)
  const [isEndingConfirmOpen, setIsEndingConfirmOpen] = useState(false)
  const [patientName, setPatientName] = useState('Patient')

  // ── Fetch patient name ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!appointmentId) return
    supabase
      .from('appointments')
      .select('users!appointments_patient_id_fkey(full_name)')
      .eq('id', appointmentId)
      .single()
      .then(({ data }) => {
        if (!data) return
        const raw = data.users as unknown
        const name =
          raw && !Array.isArray(raw)
            ? (raw as { full_name: string }).full_name
            : Array.isArray(raw) && (raw as { full_name: string }[]).length > 0
              ? (raw as { full_name: string }[])[0].full_name
              : 'Patient'
        setPatientName(name)
      })
  }, [appointmentId])

  // ── Daily.co iframe setup ──────────────────────────────────────────────────
  useEffect(() => {
    if (!videoContainerRef.current || !roomUrl || !token) return

    let callFrame: DailyCall | null = null

    async function initDaily() {
      const Daily = (await import('@daily-co/daily-js')).default
      callFrame = Daily.createFrame(videoContainerRef.current!, {
        iframeStyle: {
          width: '100%',
          height: '100%',
          border: 'none',
        },
        showLeaveButton: false,
        showFullscreenButton: false,
      })
      callFrameRef.current = callFrame
      await callFrame.join({ url: roomUrl, token })
    }

    void initDaily()

    return () => {
      if (callFrame) {
        void callFrame.destroy()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomUrl, token])

  // ── Session timer ──────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      setSessionSeconds((s) => s + 1)
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // ── Supabase Realtime chat ─────────────────────────────────────────────────
  useEffect(() => {
    if (!consultationId) return

    const channel = supabase
      .channel(`consultation:${consultationId}`)
      .on(
        'broadcast',
        { event: 'chat_message' },
        (payload: { payload: ChatMessage }) => {
          const msg = payload.payload
          setChatMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev
            return [...prev, msg]
          })
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [consultationId])

  // ── Mic toggle ─────────────────────────────────────────────────────────────
  function handleToggleMic() {
    if (!callFrameRef.current) return
    const nextMuted = !isMuted
    setIsMuted(nextMuted)
    callFrameRef.current.setLocalAudio(!nextMuted)
  }

  // ── Camera toggle ──────────────────────────────────────────────────────────
  function handleToggleCamera() {
    if (!callFrameRef.current) return
    const nextCameraOn = !isCameraOn
    setIsCameraOn(nextCameraOn)
    callFrameRef.current.setLocalVideo(nextCameraOn)
  }

  // ── Send chat message ──────────────────────────────────────────────────────
  const handleSendMessage = useCallback(async () => {
    const content = chatInput.trim()
    if (!content || !channelRef.current) return

    const msg: ChatMessage = {
      id: `prac-${Date.now()}-${Math.random()}`,
      role: 'practitioner',
      content,
      timestamp: Date.now(),
    }

    setChatMessages((prev) => [...prev, msg])
    setChatInput('')

    await channelRef.current.send({
      type: 'broadcast',
      event: 'chat_message',
      payload: msg,
    })
  }, [chatInput])

  // ── End session ────────────────────────────────────────────────────────────
  async function handleEndSession() {
    setIsEnding(true)
    setIsEndingConfirmOpen(false)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const durationMin = Math.round(sessionSeconds / 60)

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/end-consultation`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
          },
          body: JSON.stringify({
            consultationId,
            chatHistory: chatMessages,
            notes,
          }),
        }
      )

      let aiSummary = ''
      if (response.ok) {
        const body = (await response.json()) as { aiSummary?: string }
        aiSummary = body.aiSummary ?? ''
      }

      if (callFrameRef.current) {
        void callFrameRef.current.destroy()
        callFrameRef.current = null
      }

      router.push(
        `/practitioner/consultation/${appointmentId}/summary?consultationId=${consultationId}&durationMin=${durationMin}&aiSummary=${encodeURIComponent(aiSummary)}`
      )
    } catch {
      setIsEnding(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen bg-[#213145] overflow-hidden flex flex-col font-[Manrope]">
      {/* Google Fonts */}
      <link
        rel="preconnect"
        href="https://fonts.googleapis.com"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        rel="stylesheet"
      />

      {/* ── Header ── */}
      <header className="fixed top-0 w-full z-50 flex items-center justify-between px-6 py-4 bg-[#213145]/70 backdrop-blur-xl border-b border-white/10 h-[72px]">
        {/* Left: logo + secure badge */}
        <div className="flex items-center gap-4">
          <span className="text-2xl font-bold bg-gradient-to-r from-white to-sky-300 bg-clip-text text-transparent tracking-tight select-none">
            M-Santé
          </span>
          <div className="hidden md:flex items-center gap-2 bg-white/5 border border-white/15 px-3 py-1.5 rounded-full">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: '#006685', boxShadow: '0 0 8px rgba(0,102,133,0.5)' }}
            />
            <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-white/70">
              Secure Connection
            </span>
          </div>
        </div>

        {/* Center: timer */}
        <div className="text-center absolute left-1/2 -translate-x-1/2">
          <span className="block text-[11px] font-bold uppercase tracking-[0.05em] text-white/50">
            Time Elapsed
          </span>
          <span className="block text-xl font-bold tabular-nums text-[#006685]">
            {formatDuration(sessionSeconds)}
          </span>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1">
          <button
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Notifications"
          >
            <span
              className="material-symbols-outlined text-sky-300 text-2xl select-none"
              style={{ fontVariationSettings: "'FILL' 0" }}
            >
              notifications
            </span>
          </button>
          <button
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Compte"
          >
            <span
              className="material-symbols-outlined text-sky-300 text-2xl select-none"
              style={{ fontVariationSettings: "'FILL' 0" }}
            >
              account_circle
            </span>
          </button>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex flex-1 flex-col lg:flex-row gap-4 p-4 overflow-hidden pt-[72px]">
        {/* ── Left: video area ── */}
        <div className="flex-1 relative rounded-xl overflow-hidden bg-[#213145] border border-white/10">
          {/* Daily.co iframe container */}
          <div
            ref={videoContainerRef}
            className="absolute inset-0 w-full h-full"
          />

          {/* Self-view PiP placeholder */}
          <div className="absolute top-4 right-4 w-40 h-28 rounded-xl bg-[#1a2a3a] border border-white/20 flex items-center justify-center text-white/30 text-sm z-10 pointer-events-none select-none">
            Self
          </div>

          {/* Patient info overlay */}
          <div className="absolute bottom-20 left-4 z-10">
            <div className="bg-[#213145]/60 backdrop-blur-md border border-white/10 rounded-lg px-3 py-2 flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#82d8ff] flex items-center justify-center text-[#005e7a] text-xs font-bold">
                {getInitials(patientName)}
              </div>
              <div>
                <p className="text-white text-sm font-semibold leading-tight">{patientName}</p>
                <p className="text-white/60 text-[11px]">Patient</p>
              </div>
            </div>
          </div>

          {/* Floating control bar */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-[#213145]/70 backdrop-blur-xl border border-white/15 px-6 py-3 rounded-full z-10 shadow-[0_20px_40px_rgba(0,0,0,0.2)]">
            {/* Mic */}
            <button
              onClick={handleToggleMic}
              title={isMuted ? 'Activer le micro' : 'Couper le micro'}
              className="w-12 h-12 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-white transition-all duration-200"
            >
              <span
                className="material-symbols-outlined select-none"
                style={{ fontVariationSettings: "'FILL' 0" }}
              >
                {isMuted ? 'mic_off' : 'mic'}
              </span>
            </button>

            {/* Camera */}
            <button
              onClick={handleToggleCamera}
              title={isCameraOn ? 'Éteindre la caméra' : 'Allumer la caméra'}
              className="w-12 h-12 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-white transition-all duration-200"
            >
              <span
                className="material-symbols-outlined select-none"
                style={{ fontVariationSettings: "'FILL' 0" }}
              >
                {isCameraOn ? 'videocam' : 'videocam_off'}
              </span>
            </button>

            {/* Divider */}
            <div className="w-px h-8 bg-white/20" />

            {/* End session */}
            <button
              onClick={() => setIsEndingConfirmOpen(true)}
              disabled={isEnding}
              className="flex items-center gap-2 px-6 h-12 rounded-full bg-[#ba1a1a] hover:bg-[#ba1a1a]/90 text-white text-sm font-semibold transition-all duration-200 shadow-[0_0_15px_rgba(186,26,26,0.3)] disabled:opacity-60 disabled:cursor-not-allowed select-none"
            >
              <span
                className="material-symbols-outlined text-xl select-none"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                call_end
              </span>
              {isEnding ? 'Fin en cours…' : 'End Session'}
            </button>
          </div>
        </div>

        {/* ── Right sidebar ── */}
        <div className="w-full lg:w-80 flex flex-col gap-4">
          {/* Tab switcher */}
          <div className="flex items-center gap-2 bg-white/10 rounded-full p-1 border border-white/15">
            <button
              onClick={() => setActiveTab('notes')}
              className={`flex-1 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                activeTab === 'notes'
                  ? 'bg-[#006685] text-white shadow-sm'
                  : 'text-white/60 hover:text-white/80'
              }`}
            >
              Notes
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                activeTab === 'chat'
                  ? 'bg-[#006685] text-white shadow-sm'
                  : 'text-white/60 hover:text-white/80'
              }`}
            >
              Chat
            </button>
          </div>

          {/* Notes panel */}
          {activeTab === 'notes' && (
            <div className="flex-1 bg-white/10 backdrop-blur-xl rounded-xl border border-white/20 p-4 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-semibold text-base">Session Notes</h3>
                <span
                  className="material-symbols-outlined text-white/40 text-sm select-none"
                  style={{ fontVariationSettings: "'FILL' 0" }}
                >
                  edit
                </span>
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Jot down key points from the consultation here..."
                className="flex-1 bg-white/5 border border-white/20 rounded-lg p-3 text-white/80 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#006685]/50 focus:border-[#006685]/50 transition-all placeholder:text-white/30 min-h-[200px]"
              />
            </div>
          )}

          {/* Chat panel */}
          {activeTab === 'chat' && (
            <div className="flex-1 bg-white/10 backdrop-blur-xl rounded-xl border border-white/20 flex flex-col overflow-hidden min-h-0">
              {/* Chat header */}
              <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
                <span
                  className="material-symbols-outlined text-[#006685] text-sm select-none"
                  style={{ fontVariationSettings: "'FILL' 0" }}
                >
                  lock
                </span>
                <h3 className="text-white font-semibold text-sm">Secure Chat</h3>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-0">
                {chatMessages.length === 0 && (
                  <p className="text-white/30 text-xs text-center mt-4">
                    Aucun message pour l&apos;instant.
                  </p>
                )}
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-2 ${msg.role === 'practitioner' ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    {msg.role === 'patient' && (
                      <div className="w-7 h-7 rounded-full bg-[#82d8ff] shrink-0 flex items-center justify-center text-[#005e7a] text-[10px] font-bold">
                        {getInitials(patientName)}
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] py-2 px-3 rounded-lg text-sm ${
                        msg.role === 'practitioner'
                          ? 'bg-[#006685] text-white rounded-tr-none'
                          : 'bg-[#e5eeff]/20 text-white/90 border border-white/10 rounded-tl-none'
                      }`}
                    >
                      <p>{msg.content}</p>
                      <span className="text-[10px] mt-1 block opacity-60 text-right">
                        {new Date(msg.timestamp).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Chat input */}
              <div className="p-3 border-t border-white/10 flex items-center gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void handleSendMessage()
                    }
                  }}
                  placeholder="Type a message..."
                  className="flex-1 bg-white/5 border border-white/20 rounded-full px-4 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#006685]/50 focus:border-[#006685]/50 transition-all"
                />
                <button
                  onClick={() => void handleSendMessage()}
                  disabled={!chatInput.trim()}
                  className="w-8 h-8 rounded-full bg-[#006685] text-white flex items-center justify-center hover:bg-[#006685]/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-[#006685]/30"
                >
                  <span
                    className="material-symbols-outlined text-sm select-none"
                    style={{ fontVariationSettings: "'FILL' 0" }}
                  >
                    send
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── Confirm end dialog ── */}
      {isEndingConfirmOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#ffdad6] flex items-center justify-center">
                <span
                  className="material-symbols-outlined text-[#ba1a1a] text-xl select-none"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  call_end
                </span>
              </div>
              <div>
                <h3 className="font-bold text-[#0b1c30] text-base">
                  Terminer la session ?
                </h3>
                <p className="text-sm text-[#6f787e]">Cette action est irréversible.</p>
              </div>
            </div>

            <p className="text-sm text-[#3f484d] mb-6">
              La consultation sera enregistrée et un résumé IA sera généré. Êtes-vous sûr de
              vouloir terminer ?
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setIsEndingConfirmOpen(false)}
                className="flex-1 py-2.5 rounded-xl border-2 border-[#bec8ce] text-[#0b1c30] font-semibold text-sm hover:bg-slate-50 transition-colors"
              >
                Continuer
              </button>
              <button
                onClick={() => void handleEndSession()}
                disabled={isEnding}
                className="flex-1 py-2.5 rounded-xl bg-[#ba1a1a] text-white font-semibold text-sm hover:bg-[#ba1a1a]/90 transition-colors disabled:opacity-60 shadow-[0_0_12px_rgba(186,26,26,0.2)]"
              >
                Terminer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
