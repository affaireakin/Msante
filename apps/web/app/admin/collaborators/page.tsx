'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

type Tab = 'invitations' | 'patients' | 'practitioners'

const COLLAB_ROLES = [
  { value: 'moderator', label: 'Modérateur' },
  { value: 'accountant', label: 'Comptable' },
  { value: 'admin', label: 'Administrateur' },
]

const STATUS_BADGE: Record<string, string> = {
  pending:  'bg-amber-100 text-amber-700',
  accepted: 'bg-emerald-100 text-emerald-700',
  expired:  'bg-slate-100 text-slate-500',
}
const STATUS_LABEL: Record<string, string> = {
  pending:  'En attente',
  accepted: 'Acceptée',
  expired:  'Expirée',
}

const VERIF_COLORS: Record<string, string> = {
  pending:      'bg-amber-100 text-amber-700',
  under_review: 'bg-blue-100 text-blue-700',
  approved:     'bg-emerald-100 text-emerald-700',
  rejected:     'bg-red-100 text-red-700',
}
const VERIF_LABELS: Record<string, string> = {
  pending:      'En attente',
  under_review: 'En revue',
  approved:     'Approuvé',
  rejected:     'Rejeté',
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'
}

export default function CollaboratorsPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('invitations')
  const [showModal, setShowModal] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('moderator')
  const [inviteError, setInviteError] = useState<string | null>(null)

  const { data: invitations = [], isLoading: loadingInv } = useQuery({
    queryKey: ['admin-invitations'],
    enabled: tab === 'invitations',
    queryFn: async () => {
      const { data } = await supabase
        .from('invitations')
        .select('id, email, role, status, created_at, expires_at')
        .order('created_at', { ascending: false })
      return data ?? []
    },
  })

  const { data: patients = [], isLoading: loadingPat } = useQuery({
    queryKey: ['admin-patients'],
    enabled: tab === 'patients',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, phone, country, created_at, onboarding_completed')
        .eq('role', 'patient')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  const { data: practitioners = [], isLoading: loadingPract } = useQuery({
    queryKey: ['admin-practitioners-collab'],
    enabled: tab === 'practitioners',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('practitioners')
        .select('id, speciality, verification_status, practitioner_type, created_at, users!user_id(full_name)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as {
        id: string
        speciality: string
        verification_status: string
        practitioner_type: string | null
        created_at: string
        users: { full_name: string } | null
      }[]
    },
  })

  const invite = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/invite-collaborator`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({ email, role }),
        }
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? "Erreur lors de l'invitation")
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-invitations'] })
      setShowModal(false)
      setEmail('')
      setRole('moderator')
      setInviteError(null)
    },
    onError: (e: Error) => setInviteError(e.message),
  })

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'invitations',   label: 'Collaborateurs invités', icon: 'mail' },
    { key: 'patients',      label: 'Patients',               icon: 'person' },
    { key: 'practitioners', label: 'Praticiens',             icon: 'medical_services' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#0b1c30]">Utilisateurs</h1>
          <p className="text-sm text-[#6f787e] mt-1">Vue consolidée des collaborateurs, patients et praticiens</p>
        </div>
        {tab === 'invitations' && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-[#006685] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-[#006685]/20 transition"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            Inviter un collaborateur
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/60 border border-white/80 max-w-lg">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all"
            style={{
              backgroundColor: tab === t.key ? '#006685' : 'transparent',
              color: tab === t.key ? '#fff' : '#6f787e',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Invitations ── */}
      {tab === 'invitations' && (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.60)', border: '1px solid rgba(255,255,255,0.80)' }}>
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-[#0b1c30]">Invitations envoyées</h2>
            <span className="text-xs text-[#6f787e]">{invitations.length} au total</span>
          </div>
          {loadingInv ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-[#006685] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50/50">
                <tr>
                  {['Email', 'Rôle', 'Statut', 'Envoyée le', 'Expire le'].map(h => (
                    <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-[#6f787e] uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(invitations as { id: string; email: string; role: string; status: string; created_at: string; expires_at: string }[]).map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-[#0b1c30] font-medium">{inv.email}</td>
                    <td className="px-6 py-4 text-sm text-[#6f787e]">{COLLAB_ROLES.find(r => r.value === inv.role)?.label ?? inv.role}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_BADGE[inv.status] ?? 'bg-slate-100 text-slate-500'}`}>
                        {STATUS_LABEL[inv.status] ?? inv.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-[#6f787e]">{new Date(inv.created_at).toLocaleDateString('fr-FR')}</td>
                    <td className="px-6 py-4 text-sm text-[#6f787e]">{new Date(inv.expires_at).toLocaleDateString('fr-FR')}</td>
                  </tr>
                ))}
                {invitations.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-[#6f787e] text-sm">Aucune invitation</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Patients ── */}
      {tab === 'patients' && (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.60)', border: '1px solid rgba(255,255,255,0.80)' }}>
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-[#0b1c30]">Patients inscrits</h2>
            <span className="text-xs text-[#6f787e]">{patients.length} au total</span>
          </div>
          {loadingPat ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-[#006685] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50/50">
                <tr>
                  {['Patient', 'Téléphone', 'Pays', 'Inscrit le', 'Onboarding'].map(h => (
                    <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-[#6f787e] uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(patients as { id: string; full_name: string; phone: string | null; country: string; created_at: string; onboarding_completed: boolean }[]).map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#e5eeff] flex items-center justify-center text-xs font-bold text-[#006685]">
                          {initials(p.full_name)}
                        </div>
                        <span className="text-sm font-medium text-[#0b1c30]">{p.full_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-[#6f787e]">{p.phone ?? '—'}</td>
                    <td className="px-6 py-4 text-sm text-[#6f787e]">{p.country}</td>
                    <td className="px-6 py-4 text-sm text-[#6f787e]">{new Date(p.created_at).toLocaleDateString('fr-FR')}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${p.onboarding_completed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {p.onboarding_completed ? 'Complété' : 'En cours'}
                      </span>
                    </td>
                  </tr>
                ))}
                {patients.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-[#6f787e] text-sm">Aucun patient inscrit</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Praticiens ── */}
      {tab === 'practitioners' && (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.60)', border: '1px solid rgba(255,255,255,0.80)' }}>
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-[#0b1c30]">Praticiens inscrits</h2>
            <span className="text-xs text-[#6f787e]">{practitioners.length} au total</span>
          </div>
          {loadingPract ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-[#006685] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50/50">
                <tr>
                  {['Praticien', 'Spécialité', 'Type', 'Vérification', 'Inscrit le'].map(h => (
                    <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-[#6f787e] uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {practitioners.map(p => {
                  const name = p.users?.full_name ?? '—'
                  const isHealthcare = !p.practitioner_type || p.practitioner_type === 'healthcare'
                  const displayName = name !== '—' && isHealthcare ? `Dr. ${name}` : name
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#006685] flex items-center justify-center text-xs font-bold text-white">
                            {initials(name)}
                          </div>
                          <span className="text-sm font-medium text-[#0b1c30]">{displayName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-[#6f787e]">{p.speciality}</td>
                      <td className="px-6 py-4 text-sm text-[#6f787e]">
                        {p.practitioner_type === 'wellness' ? 'Bien-être' : 'Santé'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${VERIF_COLORS[p.verification_status] ?? 'bg-slate-100 text-slate-500'}`}>
                          {VERIF_LABELS[p.verification_status] ?? p.verification_status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-[#6f787e]">{new Date(p.created_at).toLocaleDateString('fr-FR')}</td>
                    </tr>
                  )
                })}
                {practitioners.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-[#6f787e] text-sm">Aucun praticien inscrit</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Invite Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#0b1c30]">Inviter un collaborateur</h3>
              <button onClick={() => { setShowModal(false); setInviteError(null) }} className="text-[#6f787e] hover:text-[#0b1c30] transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-[#0b1c30]">Email</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#bec8ce] px-4 py-3 text-sm focus:outline-none focus:border-[#006685] focus:ring-2 focus:ring-[#006685]/10"
                  placeholder="collaborateur@email.com"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-[#0b1c30] mb-2 block">Rôle</label>
                <div className="space-y-2">
                  {COLLAB_ROLES.map(r => (
                    <label key={r.value} className="flex items-center gap-3 cursor-pointer group">
                      <input type="radio" name="role" value={r.value} checked={role === r.value} onChange={() => setRole(r.value)} className="accent-[#006685]" />
                      <span className="text-sm text-[#3f484d] group-hover:text-[#0b1c30]">{r.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              {inviteError && <p className="text-red-500 text-sm">{inviteError}</p>}
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => { setShowModal(false); setInviteError(null) }}
                className="flex-1 border border-[#bec8ce] text-[#6f787e] rounded-xl py-2.5 text-sm font-semibold hover:bg-slate-50 transition">
                Annuler
              </button>
              <button onClick={() => invite.mutate({ email, role })} disabled={!email || invite.isPending}
                className="flex-1 bg-[#006685] text-white rounded-xl py-2.5 text-sm font-semibold hover:shadow-lg hover:shadow-[#006685]/20 transition disabled:opacity-50">
                {invite.isPending ? 'Envoi...' : "Envoyer l'invitation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
