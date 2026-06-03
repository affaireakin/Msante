'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import {
  LiveKitRoom,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  useTracks,
  useLocalParticipant,
} from '@livekit/components-react'
import '@livekit/components-styles'
import { Track } from 'livekit-client'
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { ChatMessage } from '@/types/consultation'

function formatDuration(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

// ── Video area (must be inside LiveKitRoom context) ───────────────────────────

function VideoArea({
  isMuted, isCameraOn, onToggleMic, onToggleCamera, onLeave,
  sessionSeconds, practitionerName, isLeaveOpen, setIsLeaveOpen,
}: {
  isMuted: boolean; isCameraOn: boolean
  onToggleMic: () => void; onToggleCamera: () => void
  onLeave: () => void; sessionSeconds: number; practitionerName: string
  isLeaveOpen: boolean; setIsLeaveOpen: (v: boolean) => void
}) {
  const { localParticipant } = useLocalParticipant()
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
  ])

  useEffect(() => {
    localParticipant.setMicrophoneEnabled(!isMuted)
  }, [isMuted, localParticipant])

  useEffect(() => {
    localParticipant.setCameraEnabled(isCameraOn)
  }, [isCameraOn, localParticipant])

  return (
    <div className="relative w-full h-full bg-[#1a2a3a] rounded-xl overflow-hidden border border-white/10">
      <GridLayout tracks={tracks} style={{ height: '100%' }}>
        <ParticipantTile />
      </GridLayout>
      <RoomAudioRenderer />

      {/* Praticien badge bas gauche */}
      <div className="absolute bottom-20 left-4 z-10">
        <div className="bg-[#213145]/70 backdrop-blur-md border border-white/10 rounded-lg px-3 py-2 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#82d8ff] flex items-center justify-center text-[#005e7a] text-xs font-bold">
            {initials(practitionerName)}
          </div>
          <div>
            <p className="text-white text-sm font-semibold leading-tight">{practitionerName}</p>
            <p className="text-white/60 text-[11px]">Praticien</p>
          </div>
        </div>
      </div>

      {/* Timer overlay haut centre */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 text-center">
        <span className="block text-[10px] font-bold uppercase tracking-widest text-white/50">Durée</span>
        <span className="block text-lg font-black tabular-nums text-[#82d8ff]">{formatDuration(sessionSeconds)}</span>
      </div>

      {/* Contrôles bas */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-[#213145]/80 backdrop-blur-xl border border-white/15 px-6 py-3 rounded-full z-10 shadow-xl">
        <button
          onClick={onToggleMic}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isMuted ? 'bg-[#ba1a1a]/70 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
        >
          <span className="material-symbols-outlined select-none">{isMuted ? 'mic_off' : 'mic'}</span>
        </button>
        <button
          onClick={onToggleCamera}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${!isCameraOn ? 'bg-[#ba1a1a]/70 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
        >
          <span className="material-symbols-outlined select-none">{isCameraOn ? 'videocam' : 'videocam_off'}</span>
        </button>
        <div className="w-px h-8 bg-white/20" />
        <button
          onClick={() => setIsLeaveOpen(true)}
          className="flex items-center gap-2 px-6 h-12 rounded-full bg-[#ba1a1a] hover:bg-[#ba1a1a]/80 text-white text-sm font-semibold transition-all shadow-[0_0_20px_rgba(186,26,26,0.4)]"
        >
          <span className="material-symbols-outlined text-xl select-none">call_end</span>
          Quitter
        </button>
      </div>

      {/* Modal quitter */}
      {isLeaveOpen && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-bold text-[#0b1c30] text-base mb-1">Quitter la consultation ?</h3>
            <p className="text-sm text-[#6f787e] mb-5">La session restera active côté praticien.</p>
            <div className="flex gap-3">
              <button onClick={() => setIsLeaveOpen(false)} className="flex-1 py-2.5 rounded-xl border-2 border-[#bec8ce] text-[#0b1c30] font-semibold text-sm hover:bg-slate-50 transition-colors">
                Continuer
              </button>
              <button onClick={onLeave} className="flex-1 py-2.5 rounded-xl bg-[#ba1a1a] text-white font-semibold text-sm hover:bg-[#ba1a1a]/90 transition-colors">
                Quitter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PatientSessionPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()

  const appointmentId = params.appointmentId as string
  const token = searchParams.get('token') ?? ''
  const roomUrl = searchParams.get('roomUrl') ?? ''
  const consultationId = searchParams.get('consultationId') ?? ''

  const channelRef = useRef<RealtimeChannel | null>(null)

  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOn, setIsCameraOn] = useState(true)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [sessionSeconds, setSessionSeconds] = useState(0)
  const [practitionerName, setPractitionerName] = useState('Praticien')
  const [isLeaveOpen, setIsLeaveOpen] = useState(false)

  // Fetch practitioner name
  useEffect(() => {
    if (!appointmentId) return
    supabase
      .from('appointments')
      .select('practitioners!inner(users!user_id(full_name))')
      .eq('id', appointmentId)
      .single()
      .then(({ data }) => {
        if (!data) return
        const pract = data.practitioners as unknown as { users: { full_name: string } }
        setPractitionerName(pract?.users?.full_name ?? 'Praticien')
      })
  }, [appointmentId])

  // Session timer
  useEffect(() => {
    const id = setInterval(() => setSessionSeconds(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // Supabase Realtime chat
  useEffect(() => {
    if (!consultationId) return
    const channel = supabase
      .channel(`consultation:${consultationId}`)
      .on('broadcast', { event: 'chat_message' }, (payload: { payload: ChatMessage }) => {
        const msg = payload.payload
        setChatMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
      })
      .subscribe()
    channelRef.current = channel
    return () => { void supabase.removeChannel(channel) }
  }, [consultationId])

  const handleSendMessage = useCallback(async () => {
    const content = chatInput.trim()
    if (!content || !channelRef.current) return
    const msg: ChatMessage = { id: `pat-${Date.now()}-${Math.random()}`, role: 'patient', content, timestamp: Date.now() }
    setChatMessages(prev => [...prev, msg])
    setChatInput('')
    await channelRef.current.send({ type: 'broadcast', event: 'chat_message', payload: msg })
  }, [chatInput])

  const handleLeave = () => router.push('/patient/appointments')

  if (!token || !roomUrl) {
    return (
      <div className="h-screen bg-[#213145] flex items-center justify-center">
        <p className="text-white/60 font-[Manrope]">Chargement de la salle…</p>
      </div>
    )
  }

  return (
    <div className="h-screen bg-[#213145] overflow-hidden flex flex-col font-[Manrope]">
      <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&display=swap" rel="stylesheet" />
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" rel="stylesheet" />

      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-6 py-3 bg-[#213145]/70 backdrop-blur-xl border-b border-white/10 h-[60px]">
        <span className="text-lg font-black tracking-tighter bg-gradient-to-r from-white to-sky-300 bg-clip-text text-transparent">M-Santé</span>
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1 rounded-full">
          <div className="w-6 h-6 rounded-full bg-[#82d8ff] flex items-center justify-center text-[#005e7a] text-[10px] font-bold">{initials(practitionerName)}</div>
          <span className="text-[11px] text-white/70">{practitionerName}</span>
        </div>
      </header>

      {/* Main */}
      <main className="flex flex-1 gap-4 p-4 overflow-hidden">
        {/* LiveKit video */}
        <LiveKitRoom
          serverUrl={roomUrl}
          token={token}
          connect
          className="flex-1 relative"
        >
          <VideoArea
            isMuted={isMuted}
            isCameraOn={isCameraOn}
            onToggleMic={() => setIsMuted(m => !m)}
            onToggleCamera={() => setIsCameraOn(c => !c)}
            onLeave={handleLeave}
            sessionSeconds={sessionSeconds}
            practitionerName={practitionerName}
            isLeaveOpen={isLeaveOpen}
            setIsLeaveOpen={setIsLeaveOpen}
          />
        </LiveKitRoom>

        {/* Chat */}
        <div className="w-72 flex flex-col">
          <div className="flex-1 bg-white/5 backdrop-blur-xl rounded-xl border border-white/15 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#006685] text-base select-none">lock</span>
              <h3 className="text-white font-semibold text-sm">Chat sécurisé</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 min-h-0">
              {chatMessages.length === 0 && (
                <p className="text-white/30 text-xs text-center mt-4">Aucun message pour l&apos;instant.</p>
              )}
              {chatMessages.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === 'patient' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] py-2 px-3 rounded-xl text-sm ${msg.role === 'patient' ? 'bg-[#006685] text-white rounded-tr-sm' : 'bg-white/10 text-white/90 border border-white/10 rounded-tl-sm'}`}>
                    <p>{msg.content}</p>
                    <span className="text-[10px] mt-0.5 block opacity-50 text-right">
                      {new Date(msg.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-white/10 flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSendMessage() } }}
                placeholder="Message…"
                className="flex-1 bg-white/5 border border-white/15 rounded-full px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-[#006685]/50"
              />
              <button
                onClick={() => void handleSendMessage()}
                disabled={!chatInput.trim()}
                className="w-8 h-8 rounded-full bg-[#006685] text-white flex items-center justify-center hover:bg-[#006685]/80 transition-colors disabled:opacity-30"
              >
                <span className="material-symbols-outlined text-sm select-none">send</span>
              </button>
            </div>
          </div>
          <p className="text-[10px] text-white/25 text-center mt-2 leading-relaxed px-2">
            Urgence : <strong className="text-white/40">15</strong> · SOS Amitié : <strong className="text-white/40">+221 33 823 8020</strong>
          </p>
        </div>
      </main>
    </div>
  )
}
