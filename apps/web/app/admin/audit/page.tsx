'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

const ACTION_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  'collaborator.invited':     { label: 'Invitation envoyée',   color: 'bg-sky-100 text-sky-700',      icon: 'mail' },
  'collaborator.suspended':   { label: 'Compte suspendu',      color: 'bg-red-100 text-red-700',      icon: 'pause_circle' },
  'collaborator.reactivated': { label: 'Compte réactivé',      color: 'bg-emerald-100 text-emerald-700', icon: 'play_circle' },
  'collaborator.role_changed':{ label: 'Rôle modifié',         color: 'bg-amber-100 text-amber-700',  icon: 'manage_accounts' },
  'collaborator.deleted':     { label: 'Compte supprimé',      color: 'bg-red-200 text-red-800',      icon: 'delete' },
}

const ACTION_KEYS = Object.keys(ACTION_LABELS)

const RESOURCE_LABELS: Record<string, string> = {
  user:       'Utilisateur',
  invitation: 'Invitation',
}

interface AuditLog {
  id: string
  action: string
  resource_type: string
  resource_id: string | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  created_at: string
  actor: { full_name: string; email: string | null } | null
}

function formatJson(val: Record<string, unknown> | null) {
  if (!val) return '—'
  return Object.entries(val).map(([k, v]) => `${k}: ${v}`).join(' · ')
}

export default function AuditPage() {
  const [action, setAction] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 25

  const { data, isLoading } = useQuery<{ logs: AuditLog[]; total: number }>({
    queryKey: ['audit-logs', action, dateFrom, dateTo, page],
    queryFn: async () => {
      let q = supabase
        .from('audit_logs')
        .select('id, action, resource_type, resource_id, old_values, new_values, created_at, actor:actor_id(full_name, email)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (action) q = q.eq('action', action)
      if (dateFrom) q = q.gte('created_at', new Date(dateFrom).toISOString())
      if (dateTo) {
        const end = new Date(dateTo)
        end.setDate(end.getDate() + 1)
        q = q.lt('created_at', end.toISOString())
      }

      const { data, count, error } = await q
      if (error) throw error
      return { logs: (data ?? []) as unknown as AuditLog[], total: count ?? 0 }
    },
  })

  const logs = data?.logs ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const resetFilters = () => { setAction(''); setDateFrom(''); setDateTo(''); setPage(0) }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-[#0b1c30]">Journal d&apos;audit</h1>
        <p className="text-sm text-[#6f787e] mt-1">Toutes les actions administratives sensibles</p>
      </div>

      {/* Filtres */}
      <div className="rounded-2xl p-4" style={{ backgroundColor: 'rgba(255,255,255,0.60)', border: '1px solid rgba(255,255,255,0.80)' }}>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs font-semibold text-[#6f787e] uppercase tracking-wide">Action</label>
            <select
              value={action}
              onChange={e => { setAction(e.target.value); setPage(0) }}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#82d8ff]"
            >
              <option value="">Toutes les actions</option>
              {ACTION_KEYS.map(k => (
                <option key={k} value={k}>{ACTION_LABELS[k].label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-[#6f787e] uppercase tracking-wide">Du</label>
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0) }}
              className="mt-1 block rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#82d8ff]" />
          </div>
          <div>
            <label className="text-xs font-semibold text-[#6f787e] uppercase tracking-wide">Au</label>
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0) }}
              className="mt-1 block rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#82d8ff]" />
          </div>
          {(action || dateFrom || dateTo) && (
            <button onClick={resetFilters}
              className="flex items-center gap-1.5 text-sm text-[#6f787e] hover:text-[#0b1c30] transition-colors py-2.5">
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
              Réinitialiser
            </button>
          )}
          <div className="ml-auto text-sm text-[#6f787e] py-2.5">
            {total} entrée{total > 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.60)', border: '1px solid rgba(255,255,255,0.80)' }}>
        {isLoading ? (
          <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-[#82d8ff] border-t-transparent rounded-full animate-spin" /></div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <span className="material-symbols-outlined text-4xl text-slate-300">history</span>
            <p className="text-[#6f787e] text-sm">Aucune entrée dans le journal</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className="bg-slate-50/50 border-b border-slate-100">
                <tr>
                  {['Date & heure', 'Acteur', 'Action', 'Ressource', 'Détails'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-[#6f787e] uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map(log => {
                  const meta = ACTION_LABELS[log.action]
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5 text-xs text-[#6f787e] whitespace-nowrap">
                        {new Date(log.created_at).toLocaleDateString('fr-FR')}
                        <span className="block text-[11px] text-slate-400">
                          {new Date(log.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-medium text-[#0b1c30]">{log.actor?.full_name ?? '—'}</p>
                        <p className="text-xs text-[#6f787e]">{log.actor?.email ?? ''}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        {meta ? (
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${meta.color}`}>
                            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>{meta.icon}</span>
                            {meta.label}
                          </span>
                        ) : (
                          <span className="text-xs text-[#6f787e]">{log.action}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-[#6f787e]">
                        <span className="font-medium">{RESOURCE_LABELS[log.resource_type] ?? log.resource_type}</span>
                        {log.resource_id && (
                          <span className="block text-[11px] text-slate-400 font-mono">{log.resource_id.slice(0, 8)}…</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-[#6f787e] max-w-[260px]">
                        {log.new_values && (
                          <p className="truncate" title={formatJson(log.new_values)}>
                            {formatJson(log.new_values)}
                          </p>
                        )}
                        {log.old_values && log.new_values && (
                          <p className="text-[11px] text-slate-400 truncate" title={`avant: ${formatJson(log.old_values)}`}>
                            avant : {formatJson(log.old_values)}
                          </p>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
            <p className="text-xs text-[#6f787e]">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} sur {total}
            </p>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40 transition-colors text-[#6f787e]">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_left</span>
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pg = Math.max(0, Math.min(totalPages - 5, page - 2)) + i
                return (
                  <button key={pg} onClick={() => setPage(pg)}
                    className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${pg === page ? 'bg-[#82d8ff] text-[#0b1c30]' : 'hover:bg-slate-100 text-[#6f787e]'}`}>
                    {pg + 1}
                  </button>
                )
              })}
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40 transition-colors text-[#6f787e]">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
