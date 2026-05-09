'use client'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type Role = 'all' | 'patient' | 'practitioner' | 'admin'

interface UserRow {
  id: string
  full_name: string
  role: string
  country: string | null
  onboarding_completed: boolean
  created_at: string
}

const PAGE_SIZE = 10

function useUsers(role: Role, search: string, page: number) {
  return useQuery({
    queryKey: ['admin-users', role, search, page],
    queryFn: async () => {
      let query = supabase
        .from('users')
        .select('id, full_name, role, country, onboarding_completed, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (role !== 'all') query = query.eq('role', role)
      if (search.trim()) query = query.ilike('full_name', `%${search.trim()}%`)

      const { data, count, error } = await query
      if (error) throw error
      return { users: (data ?? []) as UserRow[], total: count ?? 0 }
    },
    staleTime: 30_000,
  })
}

function InviteAdminModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Session expirée, reconnectez-vous.'); setLoading(false); return }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const res = await fetch(`${supabaseUrl}/functions/v1/invite-admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ email, full_name: fullName }),
    })

    const json = await res.json() as { success?: boolean; error?: string }
    if (!res.ok || json.error) {
      setError(json.error ?? 'Erreur lors de l\'invitation')
    } else {
      setSuccess(true)
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-2xl p-8 flex flex-col gap-5"
        style={{
          backgroundColor: 'rgba(255,255,255,0.97)',
          boxShadow: '0 20px 60px rgba(0,102,133,0.15)',
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-[#0b1c30]">Inviter un administrateur</h2>
            <p className="text-sm text-[#6f787e] mt-0.5">Supabase enverra un lien de connexion sécurisé</p>
          </div>
          <button onClick={onClose} className="text-[#6f787e] hover:text-[#0b1c30] text-xl leading-none">✕</button>
        </div>

        {success ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-3xl">✓</div>
            <div>
              <p className="font-semibold text-[#0b1c30]">Invitation envoyée !</p>
              <p className="text-sm text-[#6f787e] mt-1"><strong>{email}</strong> recevra un lien pour créer son mot de passe.</p>
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-[#006685] text-white font-bold rounded-xl text-sm hover:shadow-lg hover:shadow-sky-500/20 transition-all"
            >
              Fermer
            </button>
          </div>
        ) : (
          <form onSubmit={handleInvite} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Nom complet</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Prénom Nom"
                className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] placeholder-[#6f787e] focus:outline-none focus:border-[#006685] focus:ring-2 focus:ring-[#006685]/10 transition-all text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Email administrateur</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
                className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] placeholder-[#6f787e] focus:outline-none focus:border-[#006685] focus:ring-2 focus:ring-[#006685]/10 transition-all text-sm"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="bg-[#e5eeff] rounded-xl px-4 py-3 text-xs text-[#005e7a]">
              🔐 Un email avec un lien sécurisé sera envoyé. Le compte sera créé avec le rôle <strong>admin</strong>.
            </div>

            <div className="flex gap-3 mt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-medium text-[#6f787e] hover:bg-slate-50 transition-all"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 bg-[#006685] text-white font-bold rounded-xl text-sm hover:shadow-lg hover:shadow-sky-500/20 transition-all disabled:opacity-50"
              >
                {loading ? 'Envoi...' : 'Envoyer l\'invitation'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    admin: 'bg-purple-100 text-purple-700',
    practitioner: 'bg-sky-100 text-sky-700',
    patient: 'bg-emerald-100 text-emerald-700',
  }
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors[role] ?? 'bg-gray-100 text-gray-600'}`}>
      {role}
    </span>
  )
}

// Debounce timer stored outside component to avoid closure issues
let debounceTimer: ReturnType<typeof setTimeout> | undefined

export default function UsersPage() {
  const [role, setRole] = useState<Role>('all')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(0)
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null)
  const [showInvite, setShowInvite] = useState(false)

  const handleSearch = (value: string) => {
    setSearch(value)
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => { setDebouncedSearch(value); setPage(0) }, 300)
  }

  const { data, isLoading } = useUsers(role, debouncedSearch, page)
  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE)

  const filters: { label: string; value: Role }[] = [
    { label: 'Tous', value: 'all' },
    { label: 'Patients', value: 'patient' },
    { label: 'Praticiens', value: 'practitioner' },
    { label: 'Admins', value: 'admin' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1c30]">Utilisateurs</h1>
          <p className="text-sm text-[#6f787e] mt-1">{data?.total ?? 0} utilisateurs au total</p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#006685] text-white text-sm font-bold rounded-xl hover:shadow-lg hover:shadow-sky-500/20 transition-all"
        >
          <span className="text-base leading-none">+</span>
          Inviter un admin
        </button>
      </div>

      {showInvite && <InviteAdminModal onClose={() => setShowInvite(false)} />}

      {/* Filters + Search */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex gap-2">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => { setRole(f.value); setPage(0) }}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                role === f.value
                  ? 'bg-[#006685] text-white'
                  : 'bg-white/60 text-[#3f484d] border border-slate-200/50 hover:bg-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Rechercher par nom..."
          className="px-4 py-2 rounded-full text-sm bg-white/60 border border-slate-200/50 outline-none text-[#0b1c30] placeholder-[#6f787e] focus:border-[#006685] transition-colors"
        />
      </div>

      {/* Table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          backgroundColor: 'rgba(255,255,255,0.60)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.80)',
          boxShadow: '0 10px 30px -10px rgba(0,102,133,0.05)',
        }}
      >
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100/60">
              <th className="text-left px-6 py-4 text-xs font-bold text-[#006685] uppercase tracking-widest">Utilisateur</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-[#006685] uppercase tracking-widest">Rôle</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-[#006685] uppercase tracking-widest">Pays</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-[#006685] uppercase tracking-widest">Onboarding</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-[#006685] uppercase tracking-widest">Inscrit le</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-50/60">
                  {Array.from({ length: 5 }).map((__, j) => (
                    <td key={j} className="px-6 py-4">
                      <div className="h-4 bg-slate-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : (data?.users ?? []).map((user) => (
              <tr
                key={user.id}
                onClick={() => setSelectedUser(user)}
                className="border-b border-slate-50/60 hover:bg-white/40 cursor-pointer transition-colors"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#006685] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {initials(user.full_name)}
                    </div>
                    <span className="text-sm font-medium text-[#0b1c30]">{user.full_name}</span>
                  </div>
                </td>
                <td className="px-6 py-4"><RoleBadge role={user.role} /></td>
                <td className="px-6 py-4 text-sm text-[#6f787e]">{user.country ?? '—'}</td>
                <td className="px-6 py-4">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    user.onboarding_completed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {user.onboarding_completed ? 'Complété' : 'En cours'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-[#6f787e]">
                  {new Date(user.created_at).toLocaleDateString('fr-FR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100/60">
          <p className="text-sm text-[#6f787e]">
            Affichage {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, data?.total ?? 0)} sur {data?.total ?? 0}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 rounded-lg text-sm border border-slate-200/50 disabled:opacity-40 hover:bg-white transition-colors"
            >
              ←
            </button>
            <span className="px-3 py-1.5 text-sm text-[#0b1c30]">{page + 1} / {totalPages || 1}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 rounded-lg text-sm border border-slate-200/50 disabled:opacity-40 hover:bg-white transition-colors"
            >
              →
            </button>
          </div>
        </div>
      </div>

      {/* Sheet slide-out profil */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setSelectedUser(null)} />
          <div
            className="relative w-96 h-full p-8 flex flex-col gap-6 overflow-y-auto"
            style={{ backgroundColor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)' }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#0b1c30]">Profil utilisateur</h2>
              <button onClick={() => setSelectedUser(null)} className="text-[#6f787e] hover:text-[#0b1c30] text-xl">✕</button>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-[#006685] flex items-center justify-center text-white text-2xl font-bold">
                {initials(selectedUser.full_name)}
              </div>
              <div>
                <p className="text-lg font-semibold text-[#0b1c30]">{selectedUser.full_name}</p>
                <RoleBadge role={selectedUser.role} />
              </div>
            </div>
            <div className="space-y-4">
              {[
                { label: 'ID', value: selectedUser.id.slice(0, 8) + '…' },
                { label: 'Pays', value: selectedUser.country ?? '—' },
                { label: 'Onboarding', value: selectedUser.onboarding_completed ? 'Complété' : 'En cours' },
                {
                  label: 'Inscrit le',
                  value: new Date(selectedUser.created_at).toLocaleDateString('fr-FR', {
                    day: '2-digit', month: 'long', year: 'numeric',
                  }),
                },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between py-3 border-b border-slate-100">
                  <span className="text-sm text-[#6f787e]">{label}</span>
                  <span className="text-sm font-medium text-[#0b1c30]">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
