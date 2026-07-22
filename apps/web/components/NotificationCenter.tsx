'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { NOTIFICATION_CATEGORIES, CATEGORY_LABELS, categoryOf, iconFor, colorFor, resolveNotificationRoute } from '@/lib/notifications'

interface NotifRow {
  id: string
  type: string
  title: string
  body: string
  data: Record<string, unknown> | null
  status: string
  created_at: string
  read_at: string | null
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Section 26 : historique complet, filtrable par catégorie, avec recherche,
// marquage lu/non lu et accès direct à l'élément concerné — utilisé par
// tous les profils (patient, praticien, organisation, admin, secrétaire,
// collaborateur) via une seule page par espace pointant ici avec son propre
// `basePath` (nécessaire pour résoudre les liens profil par profil, un même
// `type` de notification ne pointant pas vers la même route selon le rôle).
export default function NotificationCenter({ basePath }: { basePath: string }) {
  const router = useRouter()
  const qc = useQueryClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string>('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [detail, setDetail] = useState<NotifRow | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null))
  }, [])

  const { data: notifs = [], isLoading } = useQuery<NotifRow[]>({
    queryKey: ['notifications-history', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, type, title, body, data, status, created_at, read_at')
        .eq('user_id', userId as string)
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return (data ?? []) as unknown as NotifRow[]
    },
  })

  // Realtime : les autres écrans (ex. la clochette) peuvent aussi changer
  // l'état lu/non lu — on écoute INSERT et UPDATE, pas seulement les
  // nouvelles entrées, pour rester synchronisé sans rafraîchissement manuel.
  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`notif-history-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => void qc.invalidateQueries({ queryKey: ['notifications-history', userId] }))
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [userId, qc])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return notifs.filter(n => {
      if (category && categoryOf(n.type) !== category) return false
      if (unreadOnly && n.status === 'read') return false
      if (q && !n.title.toLowerCase().includes(q) && !n.body.toLowerCase().includes(q)) return false
      return true
    })
  }, [notifs, search, category, unreadOnly])

  const setRead = async (n: NotifRow, read: boolean) => {
    await supabase.from('notifications').update(
      read ? { status: 'read', read_at: new Date().toISOString() } : { status: 'sent', read_at: null }
    ).eq('id', n.id)
    qc.setQueryData<NotifRow[]>(['notifications-history', userId], prev =>
      (prev ?? []).map(x => x.id === n.id ? { ...x, status: read ? 'read' : 'sent', read_at: read ? new Date().toISOString() : null } : x))
  }

  const markAllRead = async () => {
    const ids = filtered.filter(n => n.status !== 'read').map(n => n.id)
    if (!ids.length) return
    await supabase.from('notifications').update({ status: 'read', read_at: new Date().toISOString() }).in('id', ids)
    qc.setQueryData<NotifRow[]>(['notifications-history', userId], prev =>
      (prev ?? []).map(x => ids.includes(x.id) ? { ...x, status: 'read', read_at: new Date().toISOString() } : x))
  }

  const openDetail = (n: NotifRow) => {
    setDetail(n)
    if (n.status !== 'read') void setRead(n, true)
  }

  const goTo = (n: NotifRow) => {
    const route = resolveNotificationRoute(n.type, n.data, basePath)
    if (n.status !== 'read') void setRead(n, true)
    if (route) router.push(route)
    setDetail(null)
  }

  const unreadCount = notifs.filter(n => n.status !== 'read').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-[#0b1c30]">Notifications</h1>
          <p className="text-sm text-[#6f787e] mt-1">{unreadCount} non lue{unreadCount > 1 ? 's' : ''} sur {notifs.length}</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="text-sm font-semibold text-[#005e7a] hover:underline">
            Tout marquer comme lu
          </button>
        )}
      </div>

      <div className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: 'rgba(255,255,255,0.60)', border: '1px solid rgba(255,255,255,0.80)' }}>
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" style={{ fontSize: '18px' }}>search</span>
            <input
              value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..."
              className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-sm text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#82d8ff]"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-[#6f787e] whitespace-nowrap">
            <input type="checkbox" checked={unreadOnly} onChange={e => setUnreadOnly(e.target.checked)} className="w-4 h-4 accent-[#82d8ff]" />
            Non lues uniquement
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setCategory('')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${category === '' ? 'bg-[#82d8ff] text-[#0b1c30]' : 'bg-white/60 text-[#6f787e] border border-slate-200'}`}>
            Toutes
          </button>
          {NOTIFICATION_CATEGORIES.map(c => (
            <button key={c.key} onClick={() => setCategory(c.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${category === c.key ? 'bg-[#82d8ff] text-[#0b1c30]' : 'bg-white/60 text-[#6f787e] border border-slate-200'}`}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.60)', border: '1px solid rgba(255,255,255,0.80)' }}>
        {isLoading ? (
          <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-[#82d8ff] border-t-transparent rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <span className="material-symbols-outlined text-4xl text-slate-300">notifications_off</span>
            <p className="text-[#6f787e] text-sm">Aucune notification</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(n => {
              const isUnread = n.status !== 'read'
              return (
                <div key={n.id} className={`flex items-start gap-3 px-5 py-4 hover:bg-slate-50/50 transition-colors ${isUnread ? 'bg-sky-50/30' : ''}`}>
                  <button onClick={() => openDetail(n)} className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${colorFor(n.type)}`}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{iconFor(n.type)}</span>
                  </button>
                  <button onClick={() => openDetail(n)} className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-semibold ${isUnread ? 'text-[#0b1c30]' : 'text-[#6f787e]'}`}>{n.title}</p>
                      {isUnread && <span className="w-2 h-2 rounded-full bg-[#82d8ff] flex-shrink-0" />}
                      <span className="text-[10px] font-bold uppercase tracking-wide text-[#6f787e] bg-slate-100 px-2 py-0.5 rounded-full">
                        {CATEGORY_LABELS[categoryOf(n.type)]}
                      </span>
                    </div>
                    <p className="text-xs text-[#6f787e] mt-0.5 line-clamp-2">{n.body}</p>
                    <p className="text-[11px] text-slate-400 mt-1">{fmtDateTime(n.created_at)}</p>
                  </button>
                  <button
                    onClick={() => void setRead(n, isUnread ? true : false)}
                    className="text-xs font-semibold text-[#005e7a] hover:underline whitespace-nowrap flex-shrink-0 mt-1"
                  >
                    {isUnread ? 'Marquer lu' : 'Marquer non lu'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${colorFor(detail.type)}`}>
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{iconFor(detail.type)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[#0b1c30]">{detail.title}</p>
                <p className="text-xs text-slate-400 mt-0.5">{fmtDateTime(detail.created_at)}</p>
              </div>
            </div>
            <p className="text-sm text-[#3f484d] whitespace-pre-line">{detail.body}</p>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setDetail(null)} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold text-[#6f787e]">
                Fermer
              </button>
              {resolveNotificationRoute(detail.type, detail.data, basePath) && (
                <button onClick={() => goTo(detail)} className="flex-1 py-2.5 rounded-lg bg-[#82d8ff] text-[#0b1c30] text-sm font-bold">
                  Ouvrir
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
