'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

const ROLES = [
  { value: 'admin', label: 'Administrateur' },
  { value: 'moderator', label: 'Modérateur' },
  { value: 'accountant', label: 'Comptable' },
  { value: 'practitioner', label: 'Praticien' },
]

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  accepted: 'bg-emerald-100 text-emerald-700',
  expired: 'bg-slate-100 text-slate-500',
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'En attente',
  accepted: 'Acceptée',
  expired: 'Expirée',
}

export default function CollaboratorsPage() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('moderator')
  const [inviteError, setInviteError] = useState<string | null>(null)

  const { data: invitations = [], isLoading } = useQuery({
    queryKey: ['invitations'],
    queryFn: async () => {
      const { data } = await supabase
        .from('invitations')
        .select('id, email, role, status, created_at, expires_at')
        .order('created_at', { ascending: false })
      return data ?? []
    },
  })

  const invite = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/invite-collaborator`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ email, role }),
        }
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? "Erreur lors de l'invitation")
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invitations'] })
      setShowModal(false)
      setEmail('')
      setRole('moderator')
      setInviteError(null)
    },
    onError: (e: Error) => setInviteError(e.message),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Collaborateurs</h1>
          <p className="text-slate-500 text-sm mt-1">Gérez les invitations et accès à la plateforme</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-[#006685] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#005470] transition"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          Inviter un collaborateur
        </button>
      </div>

      <div className="bg-white/60 backdrop-blur-md border border-white/80 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Invitations</h2>
          <span className="text-xs text-slate-400">{invitations.length} au total</span>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-[#006685] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50/50">
              <tr>
                {['Email', 'Rôle', 'Statut', 'Envoyée le', 'Expire le'].map(h => (
                  <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invitations.map((inv: any) => (
                <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 text-sm text-slate-800 font-medium">{inv.email}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{ROLES.find(r => r.value === inv.role)?.label ?? inv.role}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_BADGE[inv.status] ?? 'bg-slate-100 text-slate-500'}`}>
                      {STATUS_LABEL[inv.status] ?? inv.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {new Date(inv.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {new Date(inv.expires_at).toLocaleDateString('fr-FR')}
                  </td>
                </tr>
              ))}
              {invitations.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-sm">
                    Aucune invitation pour le moment
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Inviter un collaborateur</h3>
              <button
                onClick={() => { setShowModal(false); setInviteError(null) }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-700">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="collaborateur@email.com"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-2 block">Rôle</label>
                <div className="space-y-2">
                  {ROLES.map(r => (
                    <label key={r.value} className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="radio"
                        name="role"
                        value={r.value}
                        checked={role === r.value}
                        onChange={() => setRole(r.value)}
                        className="text-sky-600"
                      />
                      <span className="text-sm text-slate-700 group-hover:text-slate-900">{r.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              {inviteError && <p className="text-red-500 text-sm">{inviteError}</p>}
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setShowModal(false); setInviteError(null) }}
                className="flex-1 border border-slate-200 text-slate-700 rounded-lg py-2.5 text-sm font-semibold hover:bg-slate-50 transition"
              >
                Annuler
              </button>
              <button
                onClick={() => invite.mutate({ email, role })}
                disabled={!email || invite.isPending}
                className="flex-1 bg-[#006685] text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-[#005470] transition disabled:opacity-50"
              >
                {invite.isPending ? 'Envoi...' : "Envoyer l'invitation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
