'use client'
import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span className="material-symbols-outlined" style={style}>{name}</span>
}

interface InternalMessage {
  id: string
  sender_id: string
  receiver_id: string
  body: string | null
  attachment_url: string | null
  attachment_name: string | null
  linked_ticket_id: string | null
  linked_dispute_id: string | null
  read_at: string | null
  created_at: string
  sender_name: string
}

interface ConversationPreview {
  partnerId: string
  partnerName: string
  partnerRole: string
  lastMessage: string
  lastAt: string
  unread: number
}

interface DirectoryUser { id: string; full_name: string; role: string }

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', organization_admin: 'Org. admin', organization_member: 'Membre org.', secretary: 'Secrétaire',
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'
}

function formatShortDate(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export default function InternalMessaging() {
  const queryClient = useQueryClient()
  const [myId, setMyId] = useState<string | null>(null)
  const [activeConv, setActiveConv] = useState<ConversationPreview | null>(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [showNewConv, setShowNewConv] = useState(false)
  const [directorySearch, setDirectorySearch] = useState('')
  const [linkPicker, setLinkPicker] = useState<'none' | 'ticket' | 'dispute'>('none')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setMyId(user.id) })
  }, [])

  useEffect(() => {
    if (!myId) return
    const channel = supabase
      .channel(`internal-messages-${myId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'internal_messages', filter: `sender_id=eq.${myId}` },
        () => { void queryClient.invalidateQueries({ queryKey: ['internal-conversations', myId] }); void queryClient.invalidateQueries({ queryKey: ['internal-thread', myId, activeConv?.partnerId] }) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'internal_messages', filter: `receiver_id=eq.${myId}` },
        () => { void queryClient.invalidateQueries({ queryKey: ['internal-conversations', myId] }); void queryClient.invalidateQueries({ queryKey: ['internal-thread', myId, activeConv?.partnerId] }) })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [myId, activeConv?.partnerId, queryClient])

  const { data: conversations = [], isLoading: loadingConvs } = useQuery<ConversationPreview[]>({
    queryKey: ['internal-conversations', myId],
    enabled: !!myId,
    queryFn: async () => {
      const { data: msgs, error } = await supabase
        .from('internal_messages')
        .select('id, sender_id, receiver_id, body, read_at, created_at, sender:sender_id(full_name, role), receiver:receiver_id(full_name, role)')
        .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error

      const map = new Map<string, ConversationPreview>()
      for (const m of (msgs ?? []) as unknown as { id: string; sender_id: string; receiver_id: string; body: string | null; read_at: string | null; created_at: string; sender: { full_name: string; role: string } | null; receiver: { full_name: string; role: string } | null }[]) {
        const isMe = m.sender_id === myId
        const partner = isMe ? m.receiver : m.sender
        if (!partner || map.has(isMe ? m.receiver_id : m.sender_id)) continue
        const partnerId = isMe ? m.receiver_id : m.sender_id
        const unread = (msgs ?? []).filter((x) => x.sender_id === partnerId && x.receiver_id === myId && !x.read_at).length
        map.set(partnerId, {
          partnerId, partnerName: partner.full_name, partnerRole: partner.role,
          lastMessage: m.body ?? '📎 Pièce jointe', lastAt: m.created_at, unread,
        })
      }
      return Array.from(map.values())
    },
  })

  const { data: directory = [], isLoading: loadingDirectory } = useQuery<DirectoryUser[]>({
    queryKey: ['internal-directory', myId],
    enabled: showNewConv && !!myId,
    queryFn: async () => {
      const { data: me } = await supabase.from('users').select('role, organization_id').eq('id', myId!).single()

      // M-Santé staff can message anyone in this directory; an organization
      // account only sees the wider staff plus its own org's people, not
      // every other organization's collaborators too.
      let query = supabase.from('users').select('id, full_name, role, organization_id')
      if (me?.role === 'admin') {
        query = query.in('role', ['admin', 'organization_admin', 'organization_member', 'secretary'])
      } else {
        query = query.or(`role.eq.admin,organization_id.eq.${me?.organization_id}`)
      }
      const { data, error } = await query.order('full_name')
      if (error) throw error
      return (data ?? []).filter(u => u.id !== myId)
    },
  })

  const threadKey = ['internal-thread', myId, activeConv?.partnerId]
  const { data: messages = [], isLoading: loadingThread } = useQuery<InternalMessage[]>({
    queryKey: threadKey,
    enabled: !!myId && !!activeConv,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('internal_messages')
        .select('id, sender_id, receiver_id, body, attachment_url, attachment_name, linked_ticket_id, linked_dispute_id, read_at, created_at, sender:sender_id(full_name)')
        .or(`and(sender_id.eq.${myId},receiver_id.eq.${activeConv!.partnerId}),and(sender_id.eq.${activeConv!.partnerId},receiver_id.eq.${myId})`)
        .order('created_at', { ascending: true })
        .limit(200)
      if (error) throw error
      return (data ?? []).map((m) => ({ ...m, sender_name: (m as unknown as { sender: { full_name: string } | null }).sender?.full_name ?? '—' })) as unknown as InternalMessage[]
    },
  })

  useEffect(() => {
    if (!myId || !activeConv) return
    supabase.from('internal_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('sender_id', activeConv.partnerId).eq('receiver_id', myId).is('read_at', null)
      .then(() => { void queryClient.invalidateQueries({ queryKey: ['internal-conversations', myId] }) })
  }, [myId, activeConv?.partnerId, messages.length, queryClient])

  useEffect(() => {
    if (messages.length > 0) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
  }, [messages.length])

  const { data: openTickets = [] } = useQuery<{ id: string; title: string }[]>({
    queryKey: ['internal-link-tickets'],
    enabled: linkPicker === 'ticket',
    queryFn: async () => {
      const { data } = await supabase.from('tickets').select('id, title').not('status', 'in', '("valide","deploye")').order('created_at', { ascending: false }).limit(50)
      return data ?? []
    },
  })
  const { data: openDisputes = [] } = useQuery<{ id: string; case_number: string; reason: string }[]>({
    queryKey: ['internal-link-disputes'],
    enabled: linkPicker === 'dispute',
    queryFn: async () => {
      const { data } = await supabase.from('disputes').select('id, case_number, reason').not('status', 'in', '("resolved","closed")').order('created_at', { ascending: false }).limit(50)
      return data ?? []
    },
  })

  const sendMutation = useMutation({
    mutationFn: async (payload: { body?: string; attachmentUrl?: string; attachmentName?: string; linkedTicketId?: string; linkedDisputeId?: string }) => {
      const { error } = await supabase.from('internal_messages').insert({
        sender_id: myId, receiver_id: activeConv!.partnerId,
        body: payload.body ?? null,
        attachment_url: payload.attachmentUrl ?? null, attachment_name: payload.attachmentName ?? null,
        linked_ticket_id: payload.linkedTicketId ?? null, linked_dispute_id: payload.linkedDisputeId ?? null,
      })
      if (error) throw error
      await supabase.from('notifications').insert({
        user_id: activeConv!.partnerId, type: 'internal_message', title: 'Nouveau message interne',
        body: payload.body?.slice(0, 80) ?? '📎 Pièce jointe', channel: 'push', data: { sender_id: myId },
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: threadKey })
      void queryClient.invalidateQueries({ queryKey: ['internal-conversations', myId] })
    },
  })

  const handleSend = async () => {
    const trimmed = text.trim()
    if (!trimmed || sending || !activeConv) return
    setText(''); setSending(true)
    await sendMutation.mutateAsync({ body: trimmed })
    setSending(false)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeConv) return
    e.target.value = ''
    setSending(true)
    try {
      const path = `${myId}/${Date.now()}_${file.name}`
      const { error } = await supabase.storage.from('internal-message-attachments').upload(path, file)
      if (error) throw error
      await sendMutation.mutateAsync({ attachmentUrl: path, attachmentName: file.name })
    } catch {
      alert('Impossible d\'envoyer le fichier.')
    } finally {
      setSending(false)
    }
  }

  const handleOpenAttachment = async (path: string) => {
    const { data } = await supabase.storage.from('internal-message-attachments').createSignedUrl(path, 3600)
    if (data) window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  const startConversation = (u: DirectoryUser) => {
    const existing = conversations.find(c => c.partnerId === u.id)
    setActiveConv(existing ?? { partnerId: u.id, partnerName: u.full_name, partnerRole: u.role, lastMessage: '', lastAt: new Date().toISOString(), unread: 0 })
    setShowNewConv(false); setDirectorySearch('')
  }

  const filteredDirectory = directory.filter(u => u.full_name.toLowerCase().includes(directorySearch.toLowerCase()))

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-16rem)] md:h-[calc(100vh-16rem)] gap-0 rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.80)' }}>
      {/* Sidebar */}
      <div className={`${activeConv ? 'hidden md:flex' : 'flex'} w-full md:w-80 flex-shrink-0 flex-col relative`} style={{ backgroundColor: 'rgba(255,255,255,0.70)', borderRight: '1px solid rgba(190,200,206,0.30)' }}>
        <div className="p-4 border-b border-slate-100/60 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#0b1c30]">Messagerie interne</h2>
            <p className="text-xs text-[#6f787e] mt-0.5">Équipe admin & organisations</p>
          </div>
          <button onClick={() => setShowNewConv(true)} className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-white" style={{ backgroundColor: '#82d8ff' }}>
            <Icon name="add" style={{ fontSize: '16px' }} />
            Nouveau
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingConvs ? (
            <div className="space-y-2 p-3">{[1, 2, 3].map(i => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}</div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center">
              <Icon name="forum" style={{ fontSize: '40px', color: '#bec8ce' }} />
              <p className="text-sm text-[#6f787e] mt-2 font-semibold">Aucune conversation</p>
            </div>
          ) : conversations.map(conv => (
            <button key={conv.partnerId} onClick={() => setActiveConv(conv)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#eff4ff]/50 transition-colors"
              style={{ backgroundColor: activeConv?.partnerId === conv.partnerId ? 'rgba(229,238,255,0.6)' : 'transparent' }}>
              <div className="w-10 h-10 rounded-full bg-[#82d8ff] flex items-center justify-center text-[#0b1c30] text-sm font-bold flex-shrink-0">
                {getInitials(conv.partnerName)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-sm font-semibold text-[#0b1c30] truncate">{conv.partnerName}</p>
                  <p className="text-[10px] text-[#6f787e] flex-shrink-0">{formatShortDate(conv.lastAt)}</p>
                </div>
                <p className="text-[10px] text-[#82d8ff] font-semibold uppercase">{ROLE_LABELS[conv.partnerRole] ?? conv.partnerRole}</p>
                <p className="text-xs text-[#6f787e] truncate mt-0.5">{conv.lastMessage}</p>
              </div>
              {conv.unread > 0 && (
                <span className="w-5 h-5 rounded-full bg-[#82d8ff] text-[#0b1c30] text-[10px] font-bold flex items-center justify-center flex-shrink-0">{conv.unread}</span>
              )}
            </button>
          ))}
        </div>

        {showNewConv && (
          <div className="absolute inset-0 z-20 flex flex-col" style={{ backgroundColor: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(8px)' }}>
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100">
              <button onClick={() => setShowNewConv(false)} className="p-1 rounded-lg hover:bg-slate-100"><Icon name="arrow_back" style={{ fontSize: '20px', color: '#82d8ff' }} /></button>
              <p className="text-sm font-bold text-[#0b1c30]">Nouveau message</p>
            </div>
            <div className="p-3 border-b border-slate-100/60">
              <input value={directorySearch} onChange={e => setDirectorySearch(e.target.value)} autoFocus placeholder="Rechercher..."
                className="w-full px-3 py-2 rounded-xl text-sm outline-none border" style={{ borderColor: '#bec8ce', color: '#0b1c30', backgroundColor: '#f8f9ff' }} />
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadingDirectory ? (
                <div className="flex items-center justify-center py-8"><div className="w-5 h-5 border-2 border-[#82d8ff] border-t-transparent rounded-full animate-spin" /></div>
              ) : filteredDirectory.map(u => (
                <button key={u.id} onClick={() => startConversation(u)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#eff4ff]/60 border-b border-slate-50">
                  <div className="w-9 h-9 rounded-full bg-[#82d8ff] flex items-center justify-center text-[#0b1c30] text-sm font-bold flex-shrink-0">{getInitials(u.full_name)}</div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-[#0b1c30] block truncate">{u.full_name}</span>
                    <span className="text-[10px] text-[#82d8ff] font-semibold uppercase">{ROLE_LABELS[u.role] ?? u.role}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Thread */}
      {!activeConv ? (
        <div className="hidden md:flex flex-1 items-center justify-center flex-col gap-4" style={{ backgroundColor: 'rgba(255,255,255,0.40)' }}>
          <div className="w-16 h-16 rounded-2xl bg-[#e5eeff] flex items-center justify-center"><Icon name="forum" style={{ fontSize: '32px', color: '#82d8ff' }} /></div>
          <p className="text-sm font-bold text-[#0b1c30]">Sélectionnez une conversation</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col" style={{ backgroundColor: 'rgba(255,255,255,0.50)' }}>
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100/60" style={{ backgroundColor: 'rgba(255,255,255,0.70)' }}>
            <button onClick={() => setActiveConv(null)} className="p-1 rounded-lg hover:bg-slate-100 md:hidden"><Icon name="arrow_back" style={{ fontSize: '18px', color: '#6f787e' }} /></button>
            <div className="w-9 h-9 rounded-full bg-[#82d8ff] flex items-center justify-center text-[#0b1c30] text-sm font-bold">{getInitials(activeConv.partnerName)}</div>
            <div className="flex-1">
              <p className="text-sm font-bold text-[#0b1c30]">{activeConv.partnerName}</p>
              <p className="text-xs text-[#82d8ff] font-semibold uppercase">{ROLE_LABELS[activeConv.partnerRole] ?? activeConv.partnerRole}</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {loadingThread ? (
              <div className="flex items-center justify-center h-full"><div className="w-6 h-6 border-2 border-[#82d8ff] border-t-transparent rounded-full animate-spin" /></div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                <Icon name="chat_bubble_outline" style={{ fontSize: '40px', color: '#bec8ce' }} />
                <p className="text-sm text-[#6f787e]">Aucun message — commencez la conversation</p>
              </div>
            ) : messages.map(msg => {
              const isMe = msg.sender_id === myId
              const timeStr = new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] space-y-1`}>
                    {(msg.linked_ticket_id || msg.linked_dispute_id) && (
                      <div className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full w-fit" style={{ backgroundColor: '#fff8e1', color: '#705d00' }}>
                        <Icon name={msg.linked_ticket_id ? 'confirmation_number' : 'gavel'} style={{ fontSize: '12px' }} />
                        {msg.linked_ticket_id ? 'Ticket lié' : 'Litige lié'}
                      </div>
                    )}
                    {msg.attachment_url ? (
                      <button onClick={() => void handleOpenAttachment(msg.attachment_url!)}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-2xl text-sm"
                        style={{ backgroundColor: isMe ? '#82d8ff' : 'rgba(255,255,255,0.80)', color: isMe ? '#fff' : '#0b1c30' }}>
                        <Icon name="attach_file" style={{ fontSize: '16px' }} />
                        {msg.attachment_name}
                      </button>
                    ) : (
                      <div className="px-4 py-2.5 text-sm rounded-2xl" style={{ backgroundColor: isMe ? '#82d8ff' : 'rgba(255,255,255,0.80)', color: isMe ? '#fff' : '#0b1c30' }}>
                        {msg.body}
                      </div>
                    )}
                    <p className={`text-[10px] text-[#6f787e] px-1 ${isMe ? 'text-right' : ''}`}>{timeStr}</p>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          {linkPicker !== 'none' && (
            <div className="mx-4 mb-2 p-3 rounded-xl border border-[#d3e4fe] bg-white/90 max-h-40 overflow-y-auto">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-[#0b1c30]">{linkPicker === 'ticket' ? 'Lier un ticket' : 'Lier un litige'}</p>
                <button onClick={() => setLinkPicker('none')}><Icon name="close" style={{ fontSize: '16px', color: '#6f787e' }} /></button>
              </div>
              {linkPicker === 'ticket' ? openTickets.map(t => (
                <button key={t.id} onClick={() => { sendMutation.mutate({ body: `🔗 ${t.title}`, linkedTicketId: t.id }); setLinkPicker('none') }}
                  className="w-full text-left px-2 py-1.5 rounded-lg text-xs text-[#0b1c30] hover:bg-slate-50">{t.title}</button>
              )) : openDisputes.map(d => (
                <button key={d.id} onClick={() => { sendMutation.mutate({ body: `🔗 ${d.case_number} — ${d.reason}`, linkedDisputeId: d.id }); setLinkPicker('none') }}
                  className="w-full text-left px-2 py-1.5 rounded-lg text-xs text-[#0b1c30] hover:bg-slate-50">{d.case_number} — {d.reason}</button>
              ))}
            </div>
          )}

          <div className="px-4 py-3 border-t border-slate-100/60 flex items-end gap-2" style={{ backgroundColor: 'rgba(255,255,255,0.70)' }}>
            <button onClick={() => setLinkPicker(v => v === 'ticket' ? 'none' : 'ticket')} className="p-2.5 rounded-xl text-[#82d8ff]" title="Lier un ticket">
              <Icon name="confirmation_number" style={{ fontSize: '20px' }} />
            </button>
            <button onClick={() => setLinkPicker(v => v === 'dispute' ? 'none' : 'dispute')} className="p-2.5 rounded-xl text-[#82d8ff]" title="Lier un litige">
              <Icon name="gavel" style={{ fontSize: '20px' }} />
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="p-2.5 rounded-xl text-[#82d8ff]" title="Joindre un fichier">
              <Icon name="attach_file" style={{ fontSize: '20px' }} />
            </button>
            <textarea value={text} onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend() } }}
              rows={1} placeholder="Écrire un message..."
              className="flex-1 px-4 py-2.5 rounded-xl text-sm resize-none outline-none text-[#0b1c30] placeholder-[#6f787e] border border-[#bec8ce] focus:border-[#82d8ff]"
              style={{ backgroundColor: 'rgba(255,255,255,0.80)', maxHeight: '120px' }} />
            <button onClick={() => void handleSend()} disabled={!text.trim() || sending}
              className="p-2.5 rounded-xl text-white disabled:opacity-40" style={{ backgroundColor: '#82d8ff' }}>
              <Icon name="send" style={{ fontSize: '20px' }} />
            </button>
            <input ref={fileInputRef} type="file" className="hidden" onChange={e => void handleFileChange(e)} />
          </div>
        </div>
      )}
    </div>
  )
}
