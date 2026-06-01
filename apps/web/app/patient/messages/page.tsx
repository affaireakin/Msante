'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span className="material-symbols-outlined" style={style}>{name}</span>
}

type DocTypeId = 'analyse' | 'ordonnance' | 'compte_rendu' | 'imagerie' | 'autre'

const DOC_TYPES: { id: DocTypeId; label: string; icon: string; color: string; bg: string }[] = [
  { id: 'analyse',      label: 'Résultat d\'analyse',  icon: 'science',       color: '#1d7a3a', bg: '#e8f5e9' },
  { id: 'ordonnance',   label: 'Ordonnance',            icon: 'medication',    color: '#705d00', bg: '#fff8e1' },
  { id: 'compte_rendu', label: 'Compte-rendu médical',  icon: 'description',   color: '#006685', bg: '#e5eeff' },
  { id: 'imagerie',     label: 'Imagerie médicale',     icon: 'radiology',     color: '#5c5f61', bg: '#e0e3e5' },
  { id: 'autre',        label: 'Autre document',        icon: 'attach_file',   color: '#6f787e', bg: '#f1f5f9' },
]

interface Message {
  id: string
  sender_id: string
  receiver_id: string
  body: string
  attachment_url: string | null
  attachment_name: string | null
  attachment_type: DocTypeId | null
  read_at: string | null
  created_at: string
}

interface ConversationPreview {
  partnerId: string
  partnerName: string
  partnerSpeciality: string
  lastMessage: string
  lastAt: string
  unread: number
  isDoc: boolean
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

function formatShortDate(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === yesterday.toDateString()) return 'Hier'
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function formatDateHeader(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return "Aujourd'hui"
  if (d.toDateString() === yesterday.toDateString()) return 'Hier'
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function groupByDay(messages: Message[]) {
  const groups: { date: string; items: Message[] }[] = []
  let lastDate = ''
  for (const m of messages) {
    const d = new Date(m.created_at).toDateString()
    if (d !== lastDate) { groups.push({ date: m.created_at, items: [m] }); lastDate = d }
    else groups[groups.length - 1].items.push(m)
  }
  return groups
}

function toStoragePath(urlOrPath: string): string {
  const marker = '/message-attachments/'
  const idx = urlOrPath.indexOf(marker)
  return idx >= 0 ? urlOrPath.slice(idx + marker.length) : urlOrPath
}

function DocCard({ msg, isMe, onOpen }: { msg: Message; isMe: boolean; onOpen: (path: string) => void }) {
  const dt = DOC_TYPES.find(d => d.id === msg.attachment_type) ?? DOC_TYPES[4]
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        border: isMe ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(226,232,240,0.8)',
        backgroundColor: isMe ? 'rgba(255,255,255,0.08)' : '#ffffff',
        minWidth: '220px',
        maxWidth: '300px',
      }}
    >
      {/* Type badge */}
      <div className="flex items-center gap-2 px-3 py-2" style={{ backgroundColor: isMe ? 'rgba(255,255,255,0.06)' : dt.bg }}>
        <Icon name={dt.icon} style={{ fontSize: '14px', color: isMe ? '#bee9ff' : dt.color }} />
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: isMe ? '#bee9ff' : dt.color, fontFamily: 'Manrope' }}>
          {dt.label}
        </span>
      </div>
      {/* File info */}
      <div className="px-3 py-3 space-y-2">
        <div className="flex items-start gap-2">
          <Icon name="picture_as_pdf" style={{ fontSize: '20px', color: isMe ? 'rgba(255,255,255,0.6)' : '#6f787e', flexShrink: 0, marginTop: '2px' }} />
          <span className="text-sm font-semibold leading-snug" style={{ color: isMe ? '#fff' : '#0b1c30', fontFamily: 'Manrope', wordBreak: 'break-word' }}>
            {msg.attachment_name ?? 'Document'}
          </span>
        </div>
        {msg.attachment_url && (
          <button
            onClick={() => onOpen(msg.attachment_url!)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-opacity hover:opacity-80"
            style={{ backgroundColor: isMe ? 'rgba(255,255,255,0.15)' : '#e5eeff', color: isMe ? '#bee9ff' : '#006685', fontFamily: 'Manrope' }}
          >
            <Icon name="download" style={{ fontSize: '14px' }} />
            Télécharger
          </button>
        )}
      </div>
    </div>
  )
}

export default function PatientMessagesPage() {
  const queryClient = useQueryClient()
  const [myId, setMyId] = useState<string | null>(null)
  const [activeConv, setActiveConv] = useState<ConversationPreview | null>(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [docPickerOpen, setDocPickerOpen] = useState(false)
  const [selectedDocType, setSelectedDocType] = useState<DocTypeId | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setMyId(user.id) })
  }, [])

  // Conversations list — enriched with practitioner speciality
  const { data: conversations = [], isLoading: loadingConvs } = useQuery<ConversationPreview[]>({
    queryKey: ['web-patient-conversations', myId],
    enabled: !!myId,
    refetchInterval: 10_000,
    queryFn: async () => {
      const { data: msgs, error } = await supabase
        .from('messages')
        .select('id, sender_id, receiver_id, body, attachment_type, read_at, created_at, sender:users!messages_sender_id_fkey(id, full_name), receiver:users!messages_receiver_id_fkey(id, full_name)')
        .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error

      const partnerIds = new Set<string>()
      for (const msg of (msgs ?? [])) {
        const pid = msg.sender_id === myId ? msg.receiver_id : msg.sender_id
        partnerIds.add(pid)
      }

      const { data: practData } = await supabase
        .from('practitioners')
        .select('user_id, speciality')
        .in('user_id', Array.from(partnerIds))
      const specialityMap = new Map((practData ?? []).map(p => [p.user_id, p.speciality as string]))

      const map = new Map<string, ConversationPreview>()
      for (const msg of (msgs ?? [])) {
        const isMe = msg.sender_id === myId
        const partner = isMe
          ? (msg.receiver as unknown as { id: string; full_name: string })
          : (msg.sender as unknown as { id: string; full_name: string })
        if (!partner || map.has(partner.id)) continue
        const unread = (msgs ?? []).filter(m => m.sender_id === partner.id && m.receiver_id === myId && !m.read_at).length
        map.set(partner.id, {
          partnerId: partner.id,
          partnerName: partner.full_name,
          partnerSpeciality: specialityMap.get(partner.id) ?? 'Professionnel de santé',
          lastMessage: msg.attachment_type ? `📎 ${DOC_TYPES.find(d => d.id === msg.attachment_type)?.label ?? 'Document'}` : msg.body,
          lastAt: msg.created_at,
          unread,
          isDoc: !!msg.attachment_type,
        })
      }
      return Array.from(map.values())
    },
  })

  // Active thread
  const threadKey = ['web-patient-thread', myId, activeConv?.partnerId]
  const { data: messages = [], isLoading: loadingThread } = useQuery<Message[]>({
    queryKey: threadKey,
    enabled: !!myId && !!activeConv,
    refetchInterval: 5_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('id, sender_id, receiver_id, body, attachment_url, attachment_name, attachment_type, read_at, created_at')
        .or(`and(sender_id.eq.${myId},receiver_id.eq.${activeConv!.partnerId}),and(sender_id.eq.${activeConv!.partnerId},receiver_id.eq.${myId})`)
        .order('created_at', { ascending: true })
        .limit(100)
      if (error) throw error
      return (data ?? []) as Message[]
    },
  })

  useEffect(() => {
    if (!myId || !activeConv) return
    supabase.from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('sender_id', activeConv.partnerId).eq('receiver_id', myId).is('read_at', null)
      .then(() => { void queryClient.invalidateQueries({ queryKey: ['web-patient-conversations', myId] }) })
  }, [myId, activeConv?.partnerId, messages.length])

  useEffect(() => {
    if (messages.length > 0) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
  }, [messages.length, activeConv?.partnerId])

  const sendMutation = useMutation({
    mutationFn: async (payload: { body: string; attachmentUrl?: string; attachmentName?: string; attachmentType?: DocTypeId }) => {
      const { error } = await supabase.from('messages').insert({
        sender_id: myId,
        receiver_id: activeConv!.partnerId,
        body: payload.body,
        attachment_url: payload.attachmentUrl ?? null,
        attachment_name: payload.attachmentName ?? null,
        attachment_type: payload.attachmentType ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: threadKey })
      void queryClient.invalidateQueries({ queryKey: ['web-patient-conversations', myId] })
    },
  })

  const handleOpenDoc = useCallback(async (urlOrPath: string) => {
    const path = toStoragePath(urlOrPath)
    const { data, error } = await supabase.storage.from('message-attachments').createSignedUrl(path, 3600)
    if (error || !data) { alert('Impossible d\'ouvrir le document.'); return }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }, [])

  const handleSend = useCallback(async () => {
    const trimmed = text.trim()
    if (!trimmed || sending || !activeConv) return
    setText('')
    setSending(true)
    await sendMutation.mutateAsync({ body: trimmed })
    setSending(false)
    setTimeout(() => textareaRef.current?.focus(), 50)
  }, [text, sending, activeConv, sendMutation])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend() }
  }

  const handleDocTypeSelect = (typeId: DocTypeId) => {
    setSelectedDocType(typeId)
    setDocPickerOpen(false)
    setTimeout(() => fileInputRef.current?.click(), 100)
  }

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeConv || !selectedDocType) return
    e.target.value = ''
    setSending(true)
    try {
      const filePath = `messages/${myId}/${Date.now()}_${file.name}`
      const { error: uploadErr } = await supabase.storage.from('message-attachments').upload(filePath, file, { upsert: false })
      if (uploadErr) throw uploadErr
      await sendMutation.mutateAsync({ body: file.name, attachmentUrl: filePath, attachmentName: file.name, attachmentType: selectedDocType })
    } catch {
      alert('Impossible d\'envoyer le document.')
    } finally {
      setSending(false)
      setSelectedDocType(null)
    }
  }, [myId, activeConv, selectedDocType, sendMutation])

  const grouped = groupByDay(messages)
  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0)

  return (
    <div className="h-[calc(100vh-8rem)] flex rounded-2xl overflow-hidden shadow-sm" style={{ border: '1px solid rgba(226,232,240,0.5)', backgroundColor: 'rgba(255,255,255,0.60)' }}>

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept=".pdf,image/*" className="hidden" onChange={handleFileChange} />

      {/* ── Left panel: conversation list ──────────────────────────── */}
      <div className="w-72 flex-shrink-0 flex flex-col" style={{ borderRight: '1px solid rgba(226,232,240,0.5)' }}>
        <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(226,232,240,0.4)' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-[#0b1c30]" style={{ fontFamily: 'Manrope' }}>Mes praticiens</h2>
            {totalUnread > 0 && (
              <span className="w-6 h-6 rounded-full bg-[#006685] text-white text-xs font-bold flex items-center justify-center">
                {totalUnread}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 mt-1">
            <Icon name="lock" style={{ fontSize: '11px', color: '#1d7a3a' }} />
            <span className="text-xs font-semibold text-[#1d7a3a]" style={{ fontFamily: 'Manrope' }}>Messagerie médicale sécurisée</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingConvs ? (
            <div className="flex items-center justify-center h-24">
              <div className="w-5 h-5 border-2 border-[#006685] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-6 py-10 text-center">
              <div className="w-12 h-12 rounded-xl bg-[#e5eeff] flex items-center justify-center">
                <Icon name="forum" style={{ fontSize: '24px', color: '#006685' }} />
              </div>
              <p className="text-sm font-semibold text-[#0b1c30]" style={{ fontFamily: 'Manrope' }}>Aucune conversation</p>
              <p className="text-xs text-[#6f787e] leading-5" style={{ fontFamily: 'Manrope' }}>
                Les échanges avec vos praticiens apparaîtront ici après votre premier rendez-vous.
              </p>
            </div>
          ) : (
            conversations.map(conv => (
              <button
                key={conv.partnerId}
                onClick={() => setActiveConv(conv)}
                className="w-full text-left flex items-start gap-3 px-4 py-4 transition-colors"
                style={{
                  borderBottom: '1px solid rgba(226,232,240,0.35)',
                  backgroundColor: activeConv?.partnerId === conv.partnerId
                    ? '#e5eeff'
                    : conv.unread > 0 ? 'rgba(0,102,133,0.03)' : 'transparent',
                }}
              >
                <div className="w-10 h-10 rounded-xl bg-[#e5eeff] flex items-center justify-center flex-shrink-0 text-sm font-bold text-[#006685]" style={{ fontFamily: 'Manrope' }}>
                  {getInitials(conv.partnerName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1 mb-0.5">
                    <span className={`text-sm truncate ${conv.unread > 0 ? 'font-bold' : 'font-semibold'} text-[#0b1c30]`} style={{ fontFamily: 'Manrope' }}>
                      {conv.partnerName}
                    </span>
                    <span className="text-xs text-[#6f787e] flex-shrink-0" style={{ fontFamily: 'Manrope' }}>
                      {formatShortDate(conv.lastAt)}
                    </span>
                  </div>
                  <p className="text-xs text-[#6f787e] mb-1 truncate" style={{ fontFamily: 'Manrope' }}>
                    {conv.partnerSpeciality}
                  </p>
                  <p className={`text-xs truncate ${conv.unread > 0 ? 'text-[#0b1c30] font-medium' : 'text-[#6f787e]'}`} style={{ fontFamily: 'Manrope' }}>
                    {conv.lastMessage}
                  </p>
                </div>
                {conv.unread > 0 && (
                  <span className="w-5 h-5 rounded-full bg-[#006685] text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-1">
                    {conv.unread > 9 ? '9+' : conv.unread}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Right panel: thread ────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {!activeConv ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
            <div className="w-16 h-16 rounded-2xl bg-[#e5eeff] flex items-center justify-center">
              <Icon name="chat_bubble_outline" style={{ fontSize: '32px', color: '#006685' }} />
            </div>
            <div>
              <p className="text-base font-bold text-[#0b1c30]" style={{ fontFamily: 'Manrope' }}>
                Sélectionnez un praticien
              </p>
              <p className="text-sm text-[#6f787e] mt-1 max-w-xs" style={{ fontFamily: 'Manrope' }}>
                Échangez des messages et des documents médicaux en toute sécurité.
              </p>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl mt-2" style={{ backgroundColor: '#fff8e1', border: '1px solid rgba(226,192,0,0.2)' }}>
              <Icon name="info" style={{ fontSize: '14px', color: '#705d00' }} />
              <p className="text-xs text-[#705d00]" style={{ fontFamily: 'Manrope' }}>
                En cas d'urgence médicale, appelez le <strong>15</strong> (SAMU)
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="flex items-center gap-3 px-6 py-3.5" style={{ borderBottom: '1px solid rgba(226,232,240,0.5)', backgroundColor: 'rgba(255,255,255,0.80)' }}>
              <div className="w-10 h-10 rounded-xl bg-[#e5eeff] flex items-center justify-center text-sm font-bold text-[#006685]" style={{ fontFamily: 'Manrope' }}>
                {getInitials(activeConv.partnerName)}
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-[#0b1c30]" style={{ fontFamily: 'Manrope' }}>{activeConv.partnerName}</p>
                <p className="text-xs text-[#6f787e]" style={{ fontFamily: 'Manrope' }}>{activeConv.partnerSpeciality}</p>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ backgroundColor: '#e8f5e9' }}>
                <Icon name="lock" style={{ fontSize: '12px', color: '#1d7a3a' }} />
                <span className="text-xs font-bold text-[#1d7a3a]" style={{ fontFamily: 'Manrope' }}>Canal sécurisé</span>
              </div>
            </div>

            {/* Medical disclaimer */}
            <div className="flex items-center gap-2 px-6 py-2.5" style={{ backgroundColor: '#fff8e1', borderBottom: '1px solid rgba(226,192,0,0.15)' }}>
              <Icon name="info" style={{ fontSize: '14px', color: '#705d00' }} />
              <p className="text-xs text-[#705d00]" style={{ fontFamily: 'Manrope' }}>
                Cet espace est réservé aux échanges médicaux avec votre praticien. Ne communiquez pas d'informations sensibles en dehors de ce cadre.
              </p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-1">
              {loadingThread ? (
                <div className="flex items-center justify-center h-20">
                  <div className="w-5 h-5 border-2 border-[#006685] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : grouped.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-sm text-[#6f787e]" style={{ fontFamily: 'Manrope' }}>
                    Aucun message. Envoyez votre premier message ou document médical.
                  </p>
                </div>
              ) : (
                grouped.map(group => (
                  <div key={group.date}>
                    {/* Date separator */}
                    <div className="flex items-center gap-3 my-5">
                      <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(226,232,240,0.6)' }} />
                      <span className="text-xs text-[#6f787e] px-2 capitalize" style={{ fontFamily: 'Manrope' }}>
                        {formatDateHeader(group.date)}
                      </span>
                      <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(226,232,240,0.6)' }} />
                    </div>

                    <div className="space-y-3">
                      {group.items.map(msg => {
                        const isMe = msg.sender_id === myId
                        return (
                          <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            {msg.attachment_url ? (
                              <div>
                                <DocCard msg={msg} isMe={isMe} onOpen={handleOpenDoc} />
                                <p className={`text-xs mt-1 ${isMe ? 'text-right' : ''} text-[#6f787e]`} style={{ fontFamily: 'Manrope' }}>
                                  {formatTime(msg.created_at)}
                                </p>
                              </div>
                            ) : (
                              <div
                                className="max-w-sm lg:max-w-md px-4 py-3"
                                style={{
                                  backgroundColor: isMe ? '#006685' : '#ffffff',
                                  border: isMe ? 'none' : '1px solid rgba(226,232,240,0.7)',
                                  borderRadius: '16px',
                                  borderBottomRightRadius: isMe ? '4px' : '16px',
                                  borderBottomLeftRadius: isMe ? '16px' : '4px',
                                }}
                              >
                                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: isMe ? '#fff' : '#0b1c30', fontFamily: 'Manrope' }}>
                                  {msg.body}
                                </p>
                                <p className={`text-xs mt-1.5 ${isMe ? 'text-right text-white/50' : 'text-[#6f787e]'}`} style={{ fontFamily: 'Manrope' }}>
                                  {formatTime(msg.created_at)}
                                </p>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input area */}
            <div className="px-6 py-4" style={{ borderTop: '1px solid rgba(226,232,240,0.5)', backgroundColor: 'rgba(255,255,255,0.85)' }}>
              {/* Textarea */}
              <div className="flex items-end gap-3 mb-3">
                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Votre message..."
                  rows={2}
                  className="flex-1 resize-none rounded-xl px-4 py-3 text-sm outline-none transition-all"
                  style={{
                    maxHeight: '120px',
                    backgroundColor: '#f8f9ff',
                    border: '1px solid rgba(226,232,240,0.8)',
                    color: '#0b1c30',
                    fontFamily: 'Manrope',
                  }}
                  onFocus={e => (e.target.style.borderColor = 'rgba(0,102,133,0.4)')}
                  onBlur={e => (e.target.style.borderColor = 'rgba(226,232,240,0.8)')}
                />
                <button
                  onClick={() => void handleSend()}
                  disabled={!text.trim() || sending}
                  className="h-11 px-5 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
                  style={{
                    backgroundColor: text.trim() && !sending ? '#006685' : '#e5eeff',
                    color: text.trim() && !sending ? '#fff' : '#006685',
                    fontFamily: 'Manrope',
                    cursor: text.trim() && !sending ? 'pointer' : 'not-allowed',
                    flexShrink: 0,
                  }}
                >
                  {sending
                    ? <div className="w-4 h-4 border-2 border-[#006685] border-t-transparent rounded-full animate-spin" />
                    : <><Icon name="send" style={{ fontSize: '16px' }} /> Envoyer</>
                  }
                </button>
              </div>

              {/* Document attach row */}
              <div className="flex items-center justify-between">
                <div className="relative">
                  <button
                    onClick={() => setDocPickerOpen(p => !p)}
                    disabled={sending}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
                    style={{
                      backgroundColor: docPickerOpen ? '#e5eeff' : 'rgba(0,102,133,0.05)',
                      border: '1px solid rgba(0,102,133,0.20)',
                      color: '#006685',
                      fontFamily: 'Manrope',
                    }}
                  >
                    <Icon name="attach_file" style={{ fontSize: '16px' }} />
                    Joindre un document médical
                    <Icon name={docPickerOpen ? 'expand_less' : 'expand_more'} style={{ fontSize: '16px' }} />
                  </button>

                  {/* Doc type dropdown */}
                  {docPickerOpen && (
                    <div
                      className="absolute bottom-full left-0 mb-2 w-72 rounded-xl overflow-hidden shadow-xl z-10"
                      style={{ border: '1px solid rgba(226,232,240,0.8)', backgroundColor: '#ffffff' }}
                    >
                      <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(226,232,240,0.5)', backgroundColor: '#f8f9ff' }}>
                        <p className="text-xs font-bold text-[#0b1c30]" style={{ fontFamily: 'Manrope' }}>Type de document</p>
                        <p className="text-xs text-[#6f787e]" style={{ fontFamily: 'Manrope' }}>PDF ou image · max 10 Mo</p>
                      </div>
                      {DOC_TYPES.map(dt => (
                        <button
                          key={dt.id}
                          onClick={() => handleDocTypeSelect(dt.id)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                          style={{ borderBottom: '1px solid rgba(226,232,240,0.4)' }}
                        >
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: dt.bg }}>
                            <Icon name={dt.icon} style={{ fontSize: '16px', color: dt.color }} />
                          </div>
                          <span className="text-sm font-semibold text-[#0b1c30]" style={{ fontFamily: 'Manrope' }}>{dt.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <p className="text-xs text-[#6f787e]" style={{ fontFamily: 'Manrope' }}>
                  Urgence médicale : <strong>15</strong> (SAMU)
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
