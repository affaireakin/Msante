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
  lastMessage: string
  lastAt: string
  unread: number
}

interface PatientRow { id: string; full_name: string }

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

function formatShortDate(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === yesterday.toDateString()) return 'Hier'
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
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

export default function PractitionerMessagesPage() {
  const queryClient = useQueryClient()
  const [myId, setMyId] = useState<string | null>(null)
  const [practId, setPractId] = useState<string | null>(null)
  const [activeConv, setActiveConv] = useState<ConversationPreview | null>(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [docPickerOpen, setDocPickerOpen] = useState(false)
  const [selectedDocType, setSelectedDocType] = useState<DocTypeId | null>(null)
  const [showNewConv, setShowNewConv] = useState(false)
  const [patientSearch, setPatientSearch] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setMyId(user.id) })
  }, [])

  // Fetch own practitioners.id
  useEffect(() => {
    if (!myId) return
    supabase.from('practitioners').select('id').eq('user_id', myId).single()
      .then(({ data }) => { if (data) setPractId(data.id) })
  }, [myId])

  const { data: conversations = [], isLoading: loadingConvs } = useQuery<ConversationPreview[]>({
    queryKey: ['pract-conversations', myId],
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
          lastMessage: msg.attachment_type ? `📎 ${DOC_TYPES.find(d => d.id === msg.attachment_type)?.label ?? 'Document'}` : msg.body,
          lastAt: msg.created_at,
          unread,
        })
      }
      return Array.from(map.values())
    },
  })

  // Patients available to message (from appointments)
  const { data: myPatients = [], isLoading: loadingPatients } = useQuery<PatientRow[]>({
    queryKey: ['pract-patients-picker', practId],
    enabled: !!practId && showNewConv,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('patient_id, patient:users!appointments_patient_id_fkey(id, full_name)')
        .eq('practitioner_id', practId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      const seen = new Set<string>()
      return (data ?? [])
        .filter(r => {
          const p = r.patient as unknown as PatientRow
          if (!p || seen.has(p.id)) return false
          seen.add(p.id)
          return true
        })
        .map(r => r.patient as unknown as PatientRow)
    },
  })

  const threadKey = ['pract-thread', myId, activeConv?.partnerId]
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
      .then(() => { void queryClient.invalidateQueries({ queryKey: ['pract-conversations', myId] }) })
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
      void queryClient.invalidateQueries({ queryKey: ['pract-conversations', myId] })
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

  function startConversation(patient: PatientRow) {
    // Check if conversation already exists
    const existing = conversations.find(c => c.partnerId === patient.id)
    setActiveConv(existing ?? {
      partnerId: patient.id,
      partnerName: patient.full_name,
      lastMessage: '',
      lastAt: new Date().toISOString(),
      unread: 0,
    })
    setShowNewConv(false)
    setPatientSearch('')
  }

  const filteredPatients = myPatients.filter(p =>
    p.full_name.toLowerCase().includes(patientSearch.toLowerCase())
  )

  const groups = groupByDay(messages)

  return (
    <div className="h-[calc(100vh-4rem)] flex gap-0 rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.80)' }}>

      {/* ── Sidebar: conversations ── */}
      <div className="w-80 flex-shrink-0 flex flex-col relative" style={{ backgroundColor: 'rgba(255,255,255,0.70)', borderRight: '1px solid rgba(190,200,206,0.30)' }}>

        {/* Header */}
        <div className="p-4 border-b border-slate-100/60 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#0b1c30]">Messagerie patients</h2>
            <p className="text-xs text-[#6f787e] mt-0.5">Communication sécurisée</p>
          </div>
          <button
            onClick={() => { setShowNewConv(true); setPatientSearch('') }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#006685' }}
          >
            <Icon name="add" style={{ fontSize: '16px' }} />
            Nouveau
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {loadingConvs ? (
            <div className="space-y-2 p-3">
              {[1,2,3].map(i => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center">
              <Icon name="chat_bubble_outline" style={{ fontSize: '40px', color: '#bec8ce' }} />
              <p className="text-sm text-[#6f787e] mt-2 font-semibold">Aucune conversation</p>
              <p className="text-xs text-[#bec8ce] mt-1 mb-4">Initiez le premier échange avec un patient</p>
              <button
                onClick={() => setShowNewConv(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
                style={{ backgroundColor: '#006685' }}
              >
                <Icon name="add" style={{ fontSize: '18px' }} />
                Nouveau message
              </button>
            </div>
          ) : (
            conversations.map(conv => (
              <button
                key={conv.partnerId}
                onClick={() => setActiveConv(conv)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#eff4ff]/50"
                style={{ backgroundColor: activeConv?.partnerId === conv.partnerId ? 'rgba(229,238,255,0.6)' : 'transparent' }}
              >
                <div className="w-10 h-10 rounded-full bg-[#006685] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  {getInitials(conv.partnerName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-sm font-semibold text-[#0b1c30] truncate">{conv.partnerName}</p>
                    <p className="text-[10px] text-[#6f787e] flex-shrink-0">{formatShortDate(conv.lastAt)}</p>
                  </div>
                  <p className="text-xs text-[#6f787e] truncate mt-0.5">{conv.lastMessage}</p>
                </div>
                {conv.unread > 0 && (
                  <span className="w-5 h-5 rounded-full bg-[#006685] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                    {conv.unread}
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        {/* New conversation overlay */}
        {showNewConv && (
          <div className="absolute inset-0 z-20 flex flex-col" style={{ backgroundColor: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(8px)' }}>
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100">
              <button onClick={() => setShowNewConv(false)} className="p-1 rounded-lg hover:bg-slate-100 transition-colors">
                <Icon name="arrow_back" style={{ fontSize: '20px', color: '#006685' }} />
              </button>
              <div>
                <p className="text-sm font-bold text-[#0b1c30]">Nouveau message</p>
                <p className="text-xs text-[#6f787e]">Choisir un patient</p>
              </div>
            </div>
            <div className="p-3 border-b border-slate-100/60">
              <input
                type="text"
                placeholder="Rechercher un patient..."
                value={patientSearch}
                onChange={e => setPatientSearch(e.target.value)}
                autoFocus
                className="w-full px-3 py-2 rounded-xl text-sm outline-none border"
                style={{ borderColor: '#bec8ce', color: '#0b1c30', backgroundColor: '#f8f9ff' }}
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadingPatients ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-[#006685] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredPatients.length === 0 ? (
                <div className="px-6 py-8 text-center">
                  <p className="text-sm text-[#6f787e]">
                    {patientSearch ? 'Aucun patient trouvé' : 'Aucun patient avec rendez-vous'}
                  </p>
                </div>
              ) : (
                filteredPatients.map(p => (
                  <button
                    key={p.id}
                    onClick={() => startConversation(p)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#eff4ff]/60 transition-colors border-b border-slate-50"
                  >
                    <div className="w-9 h-9 rounded-full bg-[#006685] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {getInitials(p.full_name)}
                    </div>
                    <span className="text-sm font-semibold text-[#0b1c30]">{p.full_name}</span>
                    <Icon name="chevron_right" style={{ fontSize: '18px', color: '#bec8ce', marginLeft: 'auto' }} />
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Thread ── */}
      {!activeConv ? (
        <div className="flex-1 flex items-center justify-center flex-col gap-4" style={{ backgroundColor: 'rgba(255,255,255,0.40)' }}>
          <div className="w-16 h-16 rounded-2xl bg-[#e5eeff] flex items-center justify-center">
            <Icon name="forum" style={{ fontSize: '32px', color: '#006685' }} />
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-[#0b1c30]">Sélectionnez une conversation</p>
            <p className="text-xs text-[#bec8ce] mt-1">ou cliquez sur « Nouveau » pour initier un échange</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col" style={{ backgroundColor: 'rgba(255,255,255,0.50)' }}>
          {/* Thread header */}
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100/60" style={{ backgroundColor: 'rgba(255,255,255,0.70)' }}>
            <button onClick={() => setActiveConv(null)} className="p-1 rounded-lg hover:bg-slate-100 transition-colors mr-1">
              <Icon name="arrow_back" style={{ fontSize: '18px', color: '#6f787e' }} />
            </button>
            <div className="w-9 h-9 rounded-full bg-[#006685] flex items-center justify-center text-white text-sm font-bold">
              {getInitials(activeConv.partnerName)}
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-[#0b1c30]">{activeConv.partnerName}</p>
              <p className="text-xs text-[#6f787e]">Patient</p>
            </div>
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
              <Icon name="lock" style={{ fontSize: '11px', color: '#1d7a3a' }} />
              <span className="text-[10px] font-bold text-emerald-700">Chiffré</span>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {loadingThread ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-6 h-6 border-2 border-[#006685] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                <Icon name="chat_bubble_outline" style={{ fontSize: '40px', color: '#bec8ce' }} />
                <p className="text-sm text-[#6f787e]">Aucun message pour l&apos;instant</p>
                <p className="text-xs text-[#bec8ce]">Commencez la conversation ci-dessous</p>
              </div>
            ) : (
              groups.map((group, gi) => (
                <div key={gi} className="space-y-3">
                  <div className="flex items-center gap-3 my-2">
                    <div className="flex-1 h-px bg-slate-200/60" />
                    <span className="text-[10px] text-[#6f787e] font-semibold px-2">
                      {new Date(group.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Dakar' })}
                    </span>
                    <div className="flex-1 h-px bg-slate-200/60" />
                  </div>
                  {group.items.map(msg => {
                    const isMe = msg.sender_id === myId
                    const hasDoc = !!msg.attachment_url
                    const dt = DOC_TYPES.find(d => d.id === msg.attachment_type)
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] space-y-1 ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                          {hasDoc && dt ? (
                            <div className="rounded-xl overflow-hidden border" style={{ borderColor: isMe ? 'rgba(255,255,255,0.15)' : 'rgba(226,232,240,0.8)', backgroundColor: isMe ? '#006685' : '#fff', minWidth: '200px' }}>
                              <div className="flex items-center gap-2 px-3 py-2" style={{ backgroundColor: isMe ? 'rgba(255,255,255,0.1)' : dt.bg }}>
                                <Icon name={dt.icon} style={{ fontSize: '13px', color: isMe ? '#bee9ff' : dt.color }} />
                                <span className="text-xs font-bold uppercase tracking-wide" style={{ color: isMe ? '#bee9ff' : dt.color }}>{dt.label}</span>
                              </div>
                              <div className="px-3 py-2.5 space-y-2">
                                <p className="text-sm font-medium" style={{ color: isMe ? '#fff' : '#0b1c30' }}>{msg.attachment_name}</p>
                                <button onClick={() => void handleOpenDoc(msg.attachment_url!)} className="flex items-center gap-1.5 text-xs font-bold rounded-full px-2.5 py-1" style={{ backgroundColor: isMe ? 'rgba(255,255,255,0.15)' : '#e5eeff', color: isMe ? '#bee9ff' : '#006685' }}>
                                  <Icon name="download" style={{ fontSize: '13px' }} />Télécharger
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="px-4 py-2.5 rounded-2xl text-sm" style={{ backgroundColor: isMe ? '#006685' : 'rgba(255,255,255,0.80)', color: isMe ? '#fff' : '#0b1c30', borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px' }}>
                              {msg.body}
                            </div>
                          )}
                          <p className="text-[10px] text-[#6f787e] px-1">
                            {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Dakar' })}
                            {isMe && msg.read_at && <span className="ml-1 text-emerald-600">· Lu</span>}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* Composer */}
          <div className="px-4 py-3 border-t border-slate-100/60" style={{ backgroundColor: 'rgba(255,255,255,0.70)' }}>
            {docPickerOpen && (
              <div className="mb-3 p-3 rounded-xl border border-[#d3e4fe] bg-white/80 grid grid-cols-2 gap-2">
                {DOC_TYPES.map(dt => (
                  <button key={dt.id} onClick={() => handleDocTypeSelect(dt.id)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold hover:opacity-80 transition-opacity" style={{ backgroundColor: dt.bg, color: dt.color }}>
                    <Icon name={dt.icon} style={{ fontSize: '15px' }} />
                    {dt.label}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2">
              <button onClick={() => setDocPickerOpen(v => !v)} className="flex-shrink-0 p-2.5 rounded-xl transition-colors" style={{ backgroundColor: docPickerOpen ? '#e5eeff' : 'transparent', color: '#006685' }}>
                <Icon name="attach_file" style={{ fontSize: '20px' }} />
              </button>
              <textarea
                ref={textareaRef}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder="Écrire un message... (Entrée pour envoyer)"
                className="flex-1 px-4 py-2.5 rounded-xl text-sm resize-none outline-none text-[#0b1c30] placeholder-[#6f787e] border border-[#bec8ce] focus:border-[#006685] transition-colors"
                style={{ backgroundColor: 'rgba(255,255,255,0.80)', maxHeight: '120px' }}
              />
              <button
                onClick={() => void handleSend()}
                disabled={!text.trim() || sending}
                className="flex-shrink-0 p-2.5 rounded-xl text-white transition-all disabled:opacity-40"
                style={{ backgroundColor: '#006685' }}
              >
                <Icon name="send" style={{ fontSize: '20px' }} />
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="hidden" onChange={e => void handleFileChange(e)} />
          </div>
        </div>
      )}
    </div>
  )
}
