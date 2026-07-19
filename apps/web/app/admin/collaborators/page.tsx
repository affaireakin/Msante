'use client'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

type Tab = 'team' | 'invitations' | 'patients' | 'practitioners' | 'secretaries'

const COLLAB_ROLES = [
  { value: 'admin',      label: 'Administrateur', description: 'Accès complet : validation praticiens, gestion utilisateurs, workflows, paiements.' },
  { value: 'moderator',  label: 'Modérateur',     description: 'Validation praticiens, modération contenus, résolution litiges. Pas d\'accès finances.' },
  { value: 'accountant', label: 'Comptable',      description: 'Lecture seule sur paiements, réconciliation financière et exports comptables.' },
  { value: 'readonly',   label: 'Lecture seule',  description: 'Consultation du tableau de bord et des statistiques uniquement. Aucune action.' },
]

const ROLE_BADGE: Record<string, string> = {
  admin:      'bg-purple-100 text-purple-700',
  moderator:  'bg-sky-100 text-sky-700',
  accountant: 'bg-amber-100 text-amber-700',
  readonly:   'bg-slate-100 text-slate-600',
  practitioner:'bg-emerald-100 text-emerald-700',
}

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

interface TeamMember {
  id: string
  full_name: string
  email: string | null
  sub_role: string | null
  admin_role_id: string | null
  status: string
  created_at: string
}

function isSuperAdmin(m: Pick<TeamMember, 'sub_role' | 'admin_role_id'>): boolean {
  return !m.sub_role && !m.admin_role_id
}

export default function CollaboratorsPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('team')
  const [showModal, setShowModal] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('moderator')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [editRole, setEditRole] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<TeamMember | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [viewerIsSuperAdmin, setViewerIsSuperAdmin] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setCurrentUserId(user.id)
      const { data } = await supabase.from('users').select('sub_role, admin_role_id').eq('id', user.id).single()
      if (data) setViewerIsSuperAdmin(isSuperAdmin(data))
    })
  }, [])

  // ── Équipe admin ──────────────────────────────────────────────────────────
  const { data: team = [], isLoading: loadingTeam } = useQuery<TeamMember[]>({
    queryKey: ['admin-team'],
    enabled: tab === 'team',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, sub_role, admin_role_id, status, created_at')
        .eq('role', 'admin')
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as TeamMember[]
    },
  })

  async function logAudit(
    action: string,
    resource_type: string,
    resource_id: string,
    old_values?: Record<string, unknown> | null,
    new_values?: Record<string, unknown> | null,
  ) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('audit_logs').insert({
      actor_id: user.id,
      action,
      resource_type,
      resource_id,
      old_values: old_values ?? null,
      new_values: new_values ?? null,
    })
  }

  const suspendMutation = useMutation({
    mutationFn: async ({ id, suspend, member }: { id: string; suspend: boolean; member: TeamMember }) => {
      const { error } = await supabase
        .from('users')
        .update({ status: suspend ? 'suspended' : 'active' })
        .eq('id', id)
      if (error) throw error
      await logAudit(
        suspend ? 'collaborator.suspended' : 'collaborator.reactivated',
        'user', id,
        { status: member.status },
        { status: suspend ? 'suspended' : 'active' },
      )
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-team'] }),
  })

  const changeRoleMutation = useMutation({
    mutationFn: async ({ id, sub_role }: { id: string; sub_role: string }) => {
      const prev = editingMember?.sub_role ?? null
      const { error } = await supabase.from('users').update({ sub_role }).eq('id', id)
      if (error) throw error
      await logAudit('collaborator.role_changed', 'user', id, { sub_role: prev }, { sub_role })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-team'] })
      setEditingMember(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (member: TeamMember) => {
      await supabase.from('users').delete().eq('id', member.id)
      await logAudit('collaborator.deleted', 'user', member.id, { email: member.email, sub_role: member.sub_role }, null)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-team'] })
      setConfirmDelete(null)
    },
  })

  // ── Invitations ───────────────────────────────────────────────────────────
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

  // ── Patients ──────────────────────────────────────────────────────────────
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

  // ── Praticiens ────────────────────────────────────────────────────────────
  const { data: practitioners = [], isLoading: loadingPract } = useQuery({
    queryKey: ['admin-practitioners-collab'],
    enabled: tab === 'practitioners',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('practitioners')
        .select('id, speciality, verification_status, practitioner_type, created_at, users!user_id(full_name)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as {
        id: string; speciality: string; verification_status: string
        practitioner_type: string | null; created_at: string
        users: { full_name: string } | null
      }[]
    },
  })

  // ── Secrétaires (invitées par un praticien indépendant, hors RBAC org) ──────
  interface PractSecretary {
    id: string
    user_id: string
    status: 'pending' | 'active' | 'revoked' | 'rejected'
    created_at: string
    user: { full_name: string; email: string | null } | null
    practitioner: { speciality: string; users: { full_name: string } | null } | null
  }

  const { data: secretaries = [], isLoading: loadingSec } = useQuery<PractSecretary[]>({
    queryKey: ['admin-practitioner-secretaries'],
    enabled: tab === 'secretaries',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('practitioner_secretaries')
        .select(`
          id, user_id, status, created_at,
          user:user_id(full_name, email),
          practitioner:practitioner_id(speciality, users!practitioners_user_id_fkey(full_name))
        `)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as PractSecretary[]
    },
  })

  const notifySecretary = async (sec: PractSecretary, title: string, body: string) => {
    try {
      await supabase.from('notifications').insert({
        user_id: sec.user_id, type: 'secretary_status_change', title, body, channel: 'push', data: {},
      })
    } catch {
      // best-effort — the admin action itself already succeeded
    }
  }

  const toggleSecretaryStatus = useMutation({
    mutationFn: async (sec: PractSecretary) => {
      const newStatus = sec.status === 'active' ? 'revoked' : 'active'
      const { error } = await supabase.from('practitioner_secretaries').update({ status: newStatus }).eq('id', sec.id)
      if (error) throw error
      await logAudit(
        newStatus === 'revoked' ? 'secretary.revoked' : 'secretary.reactivated',
        'practitioner_secretary', sec.id,
        { status: sec.status }, { status: newStatus },
      )
      await notifySecretary(sec,
        newStatus === 'revoked' ? 'Accès révoqué' : 'Accès réactivé',
        newStatus === 'revoked' ? 'Votre accès secrétaire a été révoqué par un administrateur.' : 'Votre accès secrétaire a été réactivé.')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-practitioner-secretaries'] }),
  })

  const decideSecretary = useMutation({
    mutationFn: async ({ sec, decision }: { sec: PractSecretary; decision: 'active' | 'rejected' }) => {
      const { error } = await supabase.from('practitioner_secretaries').update({ status: decision }).eq('id', sec.id)
      if (error) throw error
      await logAudit(
        decision === 'active' ? 'secretary.approved' : 'secretary.rejected',
        'practitioner_secretary', sec.id,
        { status: 'pending' }, { status: decision },
      )
      await notifySecretary(sec,
        decision === 'active' ? 'Compte secrétaire validé ✓' : 'Demande de secrétaire refusée',
        decision === 'active'
          ? 'Votre accès secrétaire a été validé par un administrateur. Vous pouvez maintenant vous connecter.'
          : 'Votre demande d\'accès secrétaire a été refusée par un administrateur.')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-practitioner-secretaries'] }),
  })

  // ── Invite mutation ───────────────────────────────────────────────────────
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
      await logAudit('collaborator.invited', 'invitation', email, null, { email, role })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-invitations'] })
      setShowModal(false); setEmail(''); setRole('moderator'); setInviteError(null)
    },
    onError: (e: Error) => setInviteError(e.message),
  })

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'team',         label: 'Équipe admin',          icon: 'group' },
    { key: 'invitations',  label: 'Invitations',            icon: 'mail' },
    { key: 'patients',     label: 'Patients',               icon: 'person' },
    { key: 'practitioners',label: 'Praticiens',             icon: 'medical_services' },
    { key: 'secretaries',  label: 'Secrétaires',            icon: 'support_agent' },
  ]

  const roleLabel = (r: string | null) => COLLAB_ROLES.find(c => c.value === r)?.label ?? (r ?? 'Admin')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-[#0b1c30]">Utilisateurs</h1>
          <p className="text-sm text-[#6f787e] mt-1">Gestion de l&apos;équipe, patients et praticiens</p>
        </div>
        {(tab === 'invitations' || tab === 'team') && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-[#82d8ff] text-[#0b1c30] px-4 py-2.5 rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-[#82d8ff]/20 transition flex-shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            Inviter un collaborateur
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/60 border border-white/80 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap px-2"
            style={{ backgroundColor: tab === t.key ? '#82d8ff' : 'transparent', color: tab === t.key ? '#fff' : '#6f787e' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Équipe admin ── */}
      {tab === 'team' && (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.60)', border: '1px solid rgba(255,255,255,0.80)' }}>
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-[#0b1c30]">Membres de l&apos;équipe</h2>
            <span className="text-xs text-[#6f787e]">{team.length} membre{team.length > 1 ? 's' : ''}</span>
          </div>
          {loadingTeam ? (
            <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-[#82d8ff] border-t-transparent rounded-full animate-spin" /></div>
          ) : team.length === 0 ? (
            <div className="px-6 py-12 text-center space-y-3">
              <p className="text-[#6f787e] text-sm">Aucun membre trouvé.</p>
              <p className="text-xs text-[#6f787e]">Votre compte apparaîtra ici une fois que la table <code>public.users</code> contient bien votre entrée avec <code>role = &apos;admin&apos;</code>.</p>
              {currentUserId && (
                <button
                  onClick={() => setEditingMember({ id: currentUserId, full_name: 'Moi (admin)', email: null, sub_role: 'admin', admin_role_id: null, status: 'active', created_at: new Date().toISOString() })}
                  className="mx-auto flex items-center gap-2 px-4 py-2 bg-[#82d8ff] text-[#0b1c30] text-sm font-semibold rounded-xl hover:shadow-md transition"
                >
                  Modifier mon rôle
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {team.map(member => {
                const isSelf = member.id === currentUserId
                const targetIsSuper = isSuperAdmin(member)
                // Only a true super admin may act on a fellow admin account; never on yourself
                // (prevents accidental self-lockout) — backstopped by a DB trigger regardless.
                const canManage = viewerIsSuperAdmin && !isSelf
                const guardTitle = isSelf
                  ? 'Vous ne pouvez pas effectuer cette action sur votre propre compte'
                  : !viewerIsSuperAdmin
                    ? 'Seul un administrateur général peut gérer un compte administrateur'
                    : undefined
                return (
                <div key={member.id} className="flex items-center gap-3 px-6 py-4 hover:bg-slate-50/50 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-[#82d8ff] flex items-center justify-center text-[#0b1c30] text-sm font-bold flex-shrink-0">
                    {initials(member.full_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-[#0b1c30] truncate">{member.full_name || '—'}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ROLE_BADGE[member.sub_role ?? 'admin'] ?? 'bg-slate-100 text-slate-600'}`}>
                        {roleLabel(member.sub_role ?? 'admin')}
                      </span>
                      {targetIsSuper && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Administrateur général</span>
                      )}
                      {member.status === 'suspended' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Suspendu</span>
                      )}
                    </div>
                    <p className="text-xs text-[#6f787e] mt-0.5">{member.email ?? '—'}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => { setEditingMember(member); setEditRole(member.sub_role ?? 'admin') }}
                      disabled={!canManage}
                      title={guardTitle}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#82d8ff] text-[#82d8ff] text-xs font-semibold hover:bg-[#82d8ff] hover:text-[#0b1c30] transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[#82d8ff]"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>edit</span>
                      Modifier rôle
                    </button>
                    <button
                      onClick={() => suspendMutation.mutate({ id: member.id, suspend: member.status === 'active', member })}
                      disabled={!canManage || suspendMutation.isPending}
                      title={guardTitle}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors disabled:opacity-40"
                      style={{ borderColor: member.status === 'suspended' ? '#1d7a3a' : '#705d00', color: member.status === 'suspended' ? '#1d7a3a' : '#705d00' }}
                    >
                      {member.status === 'suspended' ? 'Réactiver' : 'Suspendre'}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(member)}
                      disabled={!canManage}
                      title={guardTitle}
                      className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-[#6f787e] hover:text-[#ba1a1a] disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                    </button>
                  </div>
                </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Invitations ── */}
      {tab === 'invitations' && (
        <div className="rounded-2xl overflow-hidden overflow-x-auto" style={{ backgroundColor: 'rgba(255,255,255,0.60)', border: '1px solid rgba(255,255,255,0.80)' }}>
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-[#0b1c30]">Invitations envoyées</h2>
            <span className="text-xs text-[#6f787e]">{invitations.length} au total</span>
          </div>
          {loadingInv ? (
            <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-[#82d8ff] border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <table className="w-full min-w-[600px]">
              <thead className="bg-slate-50/50">
                <tr>{['Email', 'Rôle', 'Statut', 'Envoyée le', 'Expire le'].map(h => (
                  <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-[#6f787e] uppercase tracking-wide">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(invitations as { id: string; email: string; role: string; status: string; created_at: string; expires_at: string }[]).map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-[#0b1c30] font-medium">{inv.email}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${ROLE_BADGE[inv.role] ?? 'bg-slate-100 text-slate-600'}`}>
                        {COLLAB_ROLES.find(r => r.value === inv.role)?.label ?? inv.role}
                      </span>
                    </td>
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
        <div className="rounded-2xl overflow-hidden overflow-x-auto" style={{ backgroundColor: 'rgba(255,255,255,0.60)', border: '1px solid rgba(255,255,255,0.80)' }}>
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-[#0b1c30]">Patients inscrits</h2>
            <span className="text-xs text-[#6f787e]">{patients.length} au total</span>
          </div>
          {loadingPat ? (
            <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-[#82d8ff] border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <table className="w-full min-w-[600px]">
              <thead className="bg-slate-50/50">
                <tr>{['Patient', 'Téléphone', 'Pays', 'Inscrit le', 'Onboarding'].map(h => (
                  <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-[#6f787e] uppercase tracking-wide">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(patients as { id: string; full_name: string; phone: string | null; country: string; created_at: string; onboarding_completed: boolean }[]).map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#e5eeff] flex items-center justify-center text-xs font-bold text-[#82d8ff]">{initials(p.full_name)}</div>
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
        <div className="rounded-2xl overflow-hidden overflow-x-auto" style={{ backgroundColor: 'rgba(255,255,255,0.60)', border: '1px solid rgba(255,255,255,0.80)' }}>
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-[#0b1c30]">Praticiens inscrits</h2>
            <span className="text-xs text-[#6f787e]">{practitioners.length} au total</span>
          </div>
          {loadingPract ? (
            <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-[#82d8ff] border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <table className="w-full min-w-[600px]">
              <thead className="bg-slate-50/50">
                <tr>{['Praticien', 'Spécialité', 'Type', 'Vérification', 'Inscrit le'].map(h => (
                  <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-[#6f787e] uppercase tracking-wide">{h}</th>
                ))}</tr>
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
                          <div className="w-8 h-8 rounded-full bg-[#82d8ff] flex items-center justify-center text-xs font-bold text-[#0b1c30]">{initials(name)}</div>
                          <span className="text-sm font-medium text-[#0b1c30]">{displayName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-[#6f787e]">{p.speciality}</td>
                      <td className="px-6 py-4 text-sm text-[#6f787e]">{p.practitioner_type === 'wellness' ? 'Bien-être' : 'Santé'}</td>
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

      {/* ── Secrétaires ── */}
      {tab === 'secretaries' && (
        <div className="rounded-2xl overflow-hidden overflow-x-auto" style={{ backgroundColor: 'rgba(255,255,255,0.60)', border: '1px solid rgba(255,255,255,0.80)' }}>
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-[#0b1c30]">Secrétaires invité(e)s par des praticiens</h2>
              <p className="text-xs text-[#6f787e] mt-0.5">Accès limité à la gestion des rendez-vous du praticien qui les a invité(e)s.</p>
            </div>
            <span className="text-xs text-[#6f787e]">{secretaries.length} au total</span>
          </div>
          {loadingSec ? (
            <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-[#82d8ff] border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <table className="w-full min-w-[600px]">
              <thead className="bg-slate-50/50">
                <tr>{['Secrétaire', 'Invité(e) par', 'Statut', 'Depuis', ''].map(h => (
                  <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-[#6f787e] uppercase tracking-wide">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {secretaries.map(sec => (
                  <tr key={sec.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#e5eeff] flex items-center justify-center text-xs font-bold text-[#005e7a]">{initials(sec.user?.full_name ?? '?')}</div>
                        <div>
                          <span className="text-sm font-medium text-[#0b1c30] block">{sec.user?.full_name ?? '—'}</span>
                          <span className="text-xs text-[#6f787e]">{sec.user?.email ?? ''}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-[#6f787e]">
                      {sec.practitioner?.users?.full_name ? `Dr. ${sec.practitioner.users.full_name}` : '—'}
                      {sec.practitioner?.speciality ? ` · ${sec.practitioner.speciality}` : ''}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        sec.status === 'active' ? 'bg-emerald-100 text-emerald-700'
                        : sec.status === 'pending' ? 'bg-amber-100 text-amber-700'
                        : sec.status === 'rejected' ? 'bg-red-100 text-red-700'
                        : 'bg-slate-100 text-slate-500'
                      }`}>
                        {sec.status === 'active' ? 'Actif' : sec.status === 'pending' ? 'En attente de validation' : sec.status === 'rejected' ? 'Refusé' : 'Révoqué'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-[#6f787e]">{new Date(sec.created_at).toLocaleDateString('fr-FR')}</td>
                    <td className="px-6 py-4">
                      {sec.status === 'pending' ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => decideSecretary.mutate({ sec, decision: 'active' })}
                            disabled={decideSecretary.isPending}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-50"
                            style={{ backgroundColor: '#1d7a3a' }}
                          >
                            Valider
                          </button>
                          <button
                            onClick={() => decideSecretary.mutate({ sec, decision: 'rejected' })}
                            disabled={decideSecretary.isPending}
                            className="px-3 py-1.5 rounded-lg border text-xs font-semibold disabled:opacity-50"
                            style={{ borderColor: '#ba1a1a', color: '#ba1a1a' }}
                          >
                            Rejeter
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => toggleSecretaryStatus.mutate(sec)}
                          disabled={toggleSecretaryStatus.isPending}
                          className="px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors disabled:opacity-50"
                          style={{ borderColor: sec.status === 'active' ? '#705d00' : '#1d7a3a', color: sec.status === 'active' ? '#705d00' : '#1d7a3a' }}
                        >
                          {sec.status === 'active' ? 'Révoquer' : 'Réactiver'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {secretaries.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-[#6f787e] text-sm">Aucun(e) secrétaire</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Modal Inviter ── */}
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
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#bec8ce] px-4 py-3 text-sm text-[#0b1c30] bg-white focus:outline-none focus:border-[#82d8ff] focus:ring-2 focus:ring-[#82d8ff]/10"
                  placeholder="collaborateur@email.com" />
              </div>
              <div>
                <label className="text-sm font-semibold text-[#0b1c30] mb-2 block">Rôle & permissions</label>
                <div className="space-y-2">
                  {COLLAB_ROLES.map(r => (
                    <label key={r.value} className={`flex items-start gap-3 cursor-pointer p-3 rounded-xl border transition-all ${role === r.value ? 'border-[#82d8ff] bg-[#e5eeff]' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                      <input type="radio" name="role" value={r.value} checked={role === r.value} onChange={() => setRole(r.value)} className="accent-[#82d8ff] mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="text-sm font-semibold text-[#0b1c30] block">{r.label}</span>
                        <span className="text-xs text-[#6f787e] leading-relaxed">{r.description}</span>
                      </div>
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
                className="flex-1 bg-[#82d8ff] text-[#0b1c30] rounded-xl py-2.5 text-sm font-semibold hover:shadow-lg hover:shadow-[#82d8ff]/20 transition disabled:opacity-50">
                {invite.isPending ? 'Envoi...' : "Envoyer l'invitation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Modifier rôle ── */}
      {editingMember && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-5 shadow-2xl">
            <h3 className="text-lg font-bold text-[#0b1c30]">Modifier le rôle</h3>
            <p className="text-sm text-[#6f787e]">{editingMember.full_name || editingMember.email}</p>
            <div className="space-y-2">
              {COLLAB_ROLES.map(r => (
                <label key={r.value} className={`flex items-start gap-3 cursor-pointer p-3 rounded-xl border transition-all ${editRole === r.value ? 'border-[#82d8ff] bg-[#e5eeff]' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                  <input type="radio" name="edit-role" value={r.value} checked={editRole === r.value} onChange={() => setEditRole(r.value)} className="accent-[#82d8ff] mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-sm font-semibold text-[#0b1c30] block">{r.label}</span>
                    <span className="text-xs text-[#6f787e] leading-relaxed">{r.description}</span>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditingMember(null)}
                className="flex-1 border border-[#bec8ce] text-[#6f787e] rounded-xl py-2.5 text-sm font-semibold hover:bg-slate-50 transition">
                Annuler
              </button>
              <button onClick={() => changeRoleMutation.mutate({ id: editingMember.id, sub_role: editRole })}
                disabled={changeRoleMutation.isPending}
                className="flex-1 bg-[#82d8ff] text-[#0b1c30] rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50 transition">
                {changeRoleMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Confirmer suppression ── */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-red-600">warning</span>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-[#0b1c30]">Supprimer ce compte ?</h3>
              <p className="text-sm text-[#6f787e] mt-1">{confirmDelete.full_name || confirmDelete.email}</p>
              <p className="text-xs text-red-600 mt-2">Cette action est irréversible. L&apos;utilisateur devra être supprimé manuellement dans Supabase Auth.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 border border-[#bec8ce] text-[#6f787e] rounded-xl py-2.5 text-sm font-semibold hover:bg-slate-50 transition">
                Annuler
              </button>
              <button onClick={() => deleteMutation.mutate(confirmDelete!)}
                disabled={deleteMutation.isPending}
                className="flex-1 bg-[#ba1a1a] text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50 transition">
                {deleteMutation.isPending ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
