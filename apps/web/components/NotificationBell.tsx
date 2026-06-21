'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Notif {
  id: string
  type: string
  title: string
  body: string
  status: string
  created_at: string
}

const TYPE_ICON: Record<string, string> = {
  new_message:           'chat_bubble',
  conversation_closed:   'lock',
  appointment_confirmed: 'calendar_month',
  appointment_reminder:  'alarm',
  appointment_cancelled: 'event_busy',
  prescription_created:  'receipt_long',
  payment_success:       'payments',
  payment_failed:        'money_off',
}

const TYPE_COLOR: Record<string, string> = {
  new_message:           'text-[#006685] bg-sky-50',
  conversation_closed:   'text-[#6f787e] bg-slate-100',
  appointment_confirmed: 'text-emerald-700 bg-emerald-50',
  appointment_reminder:  'text-amber-700 bg-amber-50',
  appointment_cancelled: 'text-[#ba1a1a] bg-red-50',
  prescription_created:  'text-purple-700 bg-purple-50',
  payment_success:       'text-emerald-700 bg-emerald-50',
  payment_failed:        'text-[#ba1a1a] bg-red-50',
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'À l\'instant'
  if (m < 60) return `il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `il y a ${h}h`
  return `il y a ${Math.floor(h / 24)}j`
}

export default function NotificationBell({ userId }: { userId: string }) {
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const unread = notifs.filter(n => n.status !== 'read').length

  const fetchNotifs = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('id, type, title, body, status, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)
    setNotifs((data ?? []) as Notif[])
  }

  useEffect(() => {
    if (!userId) return
    void fetchNotifs()

    const channel = supabase
      .channel(`notifs-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, () => { void fetchNotifs() })
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const markAllRead = async () => {
    const ids = notifs.filter(n => n.status !== 'read').map(n => n.id)
    if (!ids.length) return
    await supabase.from('notifications').update({ status: 'read', read_at: new Date().toISOString() }).in('id', ids)
    setNotifs(prev => prev.map(n => ({ ...n, status: 'read' })))
  }

  const markOneRead = async (id: string) => {
    await supabase.from('notifications').update({ status: 'read', read_at: new Date().toISOString() }).eq('id', id)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, status: 'read' } : n))
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(o => !o); if (!open && unread > 0) void markAllRead() }}
        className="relative w-9 h-9 flex items-center justify-center rounded-full bg-white/60 border border-slate-200/50 text-[#6f787e] hover:bg-white transition-colors"
      >
        <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>notifications</span>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-[10px] font-bold text-white bg-[#ba1a1a]">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 rounded-2xl shadow-2xl overflow-hidden z-50"
          style={{ backgroundColor: 'rgba(255,255,255,0.98)', border: '1px solid rgba(226,232,240,0.6)', backdropFilter: 'blur(20px)' }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="text-sm font-bold text-[#0b1c30]">Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-[#006685] font-semibold hover:underline">
                Tout marquer lu
              </button>
            )}
          </div>

          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
            {notifs.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <span className="material-symbols-outlined text-3xl text-slate-300">notifications_off</span>
                <p className="text-xs text-[#6f787e]">Aucune notification</p>
              </div>
            ) : notifs.map(n => {
              const icon = TYPE_ICON[n.type] ?? 'notifications'
              const color = TYPE_COLOR[n.type] ?? 'text-[#006685] bg-sky-50'
              const isUnread = n.status !== 'read'
              return (
                <button
                  key={n.id}
                  onClick={() => void markOneRead(n.id)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors ${isUnread ? 'bg-sky-50/30' : ''}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${color}`}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-xs font-semibold truncate ${isUnread ? 'text-[#0b1c30]' : 'text-[#6f787e]'}`}>{n.title}</p>
                      {isUnread && <span className="w-2 h-2 rounded-full bg-[#006685] flex-shrink-0 mt-1" />}
                    </div>
                    <p className="text-xs text-[#6f787e] mt-0.5 line-clamp-2">{n.body}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
