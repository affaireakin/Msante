'use client'
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import InternalMessaging from './InternalMessaging'

interface UserInfo { full_name: string; role: string }

interface Thread {
  id: string
  created_at: string
  closed_at: string | null
  participant_a: string
  participant_b: string
  patient: UserInfo | null
  practitioner: UserInfo | null
  last_message: string | null
  last_message_at: string | null
}

interface Message {
  id: string
  body: string | null
  attachment_name: string | null
  created_at: string
  sender_id: string
  sender: UserInfo | null
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function pairKey(a: string, b: string) {
  return a < b ? `${a}_${b}` : `${b}_${a}`
}

function SupervisionTab() {
  const [selected, setSelected] = useState<Thread | null>(null)
  const [search, setSearch] = useState('')

  const { data: threads = [], isLoading } = useQuery<Thread[]>({
    queryKey: ['admin-message-threads'],
    queryFn: async () => {
      const { data: rawThreads, error } = await supabase
        .from('message_threads')
        .select('id, created_at, closed_at, participant_a, participant_b')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      const threadRows = rawThreads ?? []
      if (threadRows.length === 0) return []

      // message_threads has no patient_id/practitioner_id — resolve each
      // participant's identity via a separate users lookup, then use role to
      // tell them apart (messaging is always a patient<->practitioner pair).
      const participantIds = [...new Set(threadRows.flatMap(t => [t.participant_a, t.participant_b]))]
      const { data: users } = await supabase
        .from('users')
        .select('id, full_name, role')
        .in('id', participantIds)
      const userMap = new Map((users ?? []).map(u => [u.id, { full_name: u.full_name, role: u.role } as UserInfo]))

      // Last message per pair — messages has no thread_id, it's matched by
      // the (sender_id, receiver_id) pair. Fetch once for all pairs, then
      // group client-side by the same normalized pair key.
      const { data: allMessages } = await supabase
        .from('messages')
        .select('sender_id, receiver_id, body, created_at')
        .in('sender_id', participantIds)
        .in('receiver_id', participantIds)
        .order('created_at', { ascending: false })

      const lastByPair = new Map<string, { body: string | null; created_at: string }>()
      for (const m of allMessages ?? []) {
        const key = pairKey(m.sender_id, m.receiver_id)
        if (!lastByPair.has(key)) lastByPair.set(key, { body: m.body, created_at: m.created_at })
      }

      return threadRows.map((t): Thread => {
        const a = userMap.get(t.participant_a) ?? null
        const b = userMap.get(t.participant_b) ?? null
        const practitioner = a?.role === 'practitioner' ? a : b?.role === 'practitioner' ? b : null
        const patient = a?.role === 'practitioner' ? b : a
        const last = lastByPair.get(pairKey(t.participant_a, t.participant_b))
        return {
          ...t,
          patient,
          practitioner,
          last_message: last?.body ?? null,
          last_message_at: last?.created_at ?? null,
        }
      })
    },
    staleTime: 30_000,
  })

  const { data: messages = [], isLoading: msgsLoading } = useQuery<Message[]>({
    queryKey: ['admin-thread-messages', selected?.id],
    enabled: !!selected,
    queryFn: async () => {
      if (!selected) return []
      const a = selected.participant_a
      const b = selected.participant_b
      const { data } = await supabase
        .from('messages')
        .select('id, body, attachment_name, created_at, sender_id, sender:sender_id(full_name, role)')
        .or(`and(sender_id.eq.${a},receiver_id.eq.${b}),and(sender_id.eq.${b},receiver_id.eq.${a})`)
        .order('created_at', { ascending: true })
      return (data ?? []) as unknown as Message[]
    },
  })

  const filtered = useMemo(() => threads.filter(t => {
    const q = search.toLowerCase()
    return (
      !q ||
      (t.patient?.full_name ?? '').toLowerCase().includes(q) ||
      (t.practitioner?.full_name ?? '').toLowerCase().includes(q)
    )
  }), [threads, search])

  const ROLE_STYLE: Record<string, string> = {
    patient:      'bg-sky-100 text-sky-700',
    practitioner: 'bg-purple-100 text-purple-700',
    admin:        'bg-amber-100 text-amber-700',
  }

  return (
    <div style={{ fontFamily: 'Manrope' }}>
      <p className="text-sm text-[#6f787e] mb-4">
        Accès lecture aux conversations patient ↔ praticien pour instruction des litiges
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4" style={{ minHeight: '65vh' }}>
        {/* Liste threads */}
        <div className="lg:col-span-2 space-y-2">
          {/* Recherche */}
          <div className="flex items-center gap-2 px-3 py-2 bg-white/70 border border-white/80 rounded-xl">
            <span className="material-symbols-outlined text-[#6f787e]" style={{ fontSize: '18px' }}>search</span>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher patient ou praticien..."
              className="flex-1 text-sm bg-transparent text-[#0b1c30] placeholder-[#6f787e] outline-none" />
          </div>

          {isLoading ? (
            [1, 2, 3, 4].map(i => <div key={i} className="h-20 rounded-xl bg-white/40 animate-pulse" />)
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center rounded-2xl" style={{ backgroundColor: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.8)' }}>
              <span className="material-symbols-outlined text-4xl text-slate-300">chat_bubble_outline</span>
              <p className="text-sm text-[#6f787e] mt-2">Aucune conversation</p>
            </div>
          ) : filtered.map(t => (
            <button key={t.id} onClick={() => setSelected(t)}
              className={`w-full text-left rounded-xl p-3.5 space-y-1.5 transition-all border-2 ${selected?.id === t.id ? 'border-[#82d8ff] bg-sky-50' : 'border-transparent bg-white/60 hover:border-slate-200'}`}
              style={{ backdropFilter: 'blur(8px)' }}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-semibold text-[#82d8ff] truncate">
                    {t.patient?.full_name ?? '—'}
                  </span>
                  <span className="text-slate-300">↔</span>
                  <span className="text-xs font-semibold text-purple-600 truncate">
                    {t.practitioner?.full_name ?? '—'}
                  </span>
                </div>
                {t.closed_at && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 whitespace-nowrap flex-shrink-0">Clôturé</span>
                )}
              </div>
              {t.last_message && (
                <p className="text-xs text-[#6f787e] line-clamp-1">{t.last_message}</p>
              )}
              {t.last_message_at && (
                <p className="text-[10px] text-slate-400">{fmtDate(t.last_message_at)}</p>
              )}
            </button>
          ))}
        </div>

        {/* Détail thread */}
        <div className="lg:col-span-3">
          {!selected ? (
            <div className="h-full rounded-2xl flex flex-col items-center justify-center text-center p-10 space-y-3"
              style={{ backgroundColor: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.8)' }}>
              <span className="material-symbols-outlined text-5xl text-slate-200">forum</span>
              <p className="text-sm text-[#6f787e]">Sélectionnez une conversation pour lire les messages</p>
              <p className="text-xs text-slate-400">Accès lecture seule — les admins ne peuvent pas envoyer de messages</p>
            </div>
          ) : (
            <div className="rounded-2xl flex flex-col h-full overflow-hidden"
              style={{ backgroundColor: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.8)', minHeight: '500px' }}>
              {/* Header */}
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#82d8ff]">{selected.patient?.full_name ?? '—'}</span>
                    <span className="text-slate-400 text-xs">↔</span>
                    <span className="text-sm font-bold text-purple-600">{selected.practitioner?.full_name ?? '—'}</span>
                  </div>
                  <p className="text-xs text-[#6f787e] mt-0.5">
                    Depuis le {fmtDate(selected.created_at)}
                    {selected.closed_at && ` · Clôturée le ${fmtDate(selected.closed_at)}`}
                  </p>
                </div>
                <button onClick={() => setSelected(null)} aria-label="Fermer" className="text-[#6f787e] hover:text-[#0b1c30]">
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
                </button>
              </div>

              {/* Notice lecture seule */}
              <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>visibility</span>
                Lecture seule — accès admin pour instruction de litige uniquement
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {msgsLoading ? (
                  [1, 2, 3].map(i => <div key={i} className="h-12 rounded-xl bg-white/40 animate-pulse" />)
                ) : messages.length === 0 ? (
                  <p className="text-xs text-[#6f787e] text-center py-8">Aucun message dans cette conversation</p>
                ) : messages.map(msg => {
                  const role = msg.sender?.role ?? 'patient'
                  const styleClass = ROLE_STYLE[role] ?? 'bg-slate-100 text-slate-600'
                  const isRight = role === 'practitioner'
                  return (
                    <div key={msg.id} className={`flex flex-col ${isRight ? 'items-end' : 'items-start'}`}>
                      <div className={`flex items-center gap-1.5 mb-1 ${isRight ? 'flex-row-reverse' : ''}`}>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${styleClass}`}>
                          {msg.sender?.full_name ?? '—'}
                        </span>
                        <span className="text-[10px] text-slate-400">{fmtDate(msg.created_at)}</span>
                      </div>
                      <div className={`max-w-xs lg:max-w-sm px-3 py-2 rounded-2xl text-sm ${
                        isRight ? 'bg-purple-50 text-[#0b1c30] rounded-tr-none' : 'bg-sky-50 text-[#0b1c30] rounded-tl-none'
                      }`}>
                        {msg.body ?? (msg.attachment_name ? `📎 ${msg.attachment_name}` : '—')}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AdminMessagesPage() {
  const [tab, setTab] = useState<'internal' | 'supervision'>('internal')

  return (
    <div className="space-y-6 max-w-6xl" style={{ fontFamily: 'Manrope' }}>
      <div>
        <h1 className="text-2xl font-black text-[#0b1c30]">Messages</h1>
        <p className="text-sm text-[#6f787e] mt-1">Messagerie interne de l&apos;équipe et supervision des échanges patient ↔ praticien</p>
      </div>

      <div className="flex gap-1 p-1 rounded-xl bg-white/60 w-fit" style={{ border: '1px solid rgba(255,255,255,0.80)' }}>
        {(['internal', 'supervision'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2 rounded-lg text-sm font-bold transition-all"
            style={{ backgroundColor: tab === t ? '#82d8ff' : 'transparent', color: tab === t ? '#fff' : '#6f787e' }}>
            {t === 'internal' ? 'Messagerie interne' : 'Supervision patients/praticiens'}
          </button>
        ))}
      </div>

      {tab === 'internal' ? <InternalMessaging /> : <SupervisionTab />}
    </div>
  )
}
