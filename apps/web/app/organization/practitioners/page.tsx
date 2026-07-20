'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span className="material-symbols-outlined" style={style}>{name}</span>
}

type VerifStatus = 'pending' | 'under_review' | 'approved' | 'rejected'

interface OrgPractitioner {
  id: string
  user_id: string
  speciality: string
  verification_status: VerifStatus
  account_status: string | null
  org_validated_at: string | null
  created_at: string
  users: { full_name: string } | null
}

interface OrgRole { id: string; name: string }

const STATUS_LABELS: Record<VerifStatus, string> = {
  pending: 'En attente',
  under_review: 'En revue',
  approved: 'Validé',
  rejected: 'Rejeté',
}
const STATUS_COLORS: Record<VerifStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  under_review: 'bg-blue-100 text-blue-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
}

function useOrgPractitioners() {
  return useQuery<OrgPractitioner[]>({
    queryKey: ['org-practitioners'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []
      const { data: profile } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
      if (!profile?.organization_id) return []

      const { data, error } = await supabase
        .from('practitioners')
        .select('id, user_id, speciality, verification_status, account_status, org_validated_at, created_at, users!user_id(full_name)')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as OrgPractitioner[]
    },
    staleTime: 30_000,
  })
}

function useOrgRoleAssignments(userIds: string[], organizationId: string | null) {
  return useQuery<{ roles: OrgRole[]; assignments: Record<string, string> }>({
    queryKey: ['org-role-assignments', organizationId, userIds],
    enabled: !!organizationId && userIds.length > 0,
    queryFn: async () => {
      const [{ data: roles }, { data: userRoles }] = await Promise.all([
        supabase.from('org_roles').select('id, name').eq('organization_id', organizationId as string).order('is_system', { ascending: false }),
        supabase.from('user_roles').select('user_id, role_id').eq('organization_id', organizationId as string).in('user_id', userIds),
      ])
      const assignments: Record<string, string> = {}
      for (const ur of userRoles ?? []) assignments[ur.user_id] = ur.role_id
      return { roles: (roles ?? []) as OrgRole[], assignments }
    },
  })
}

function InviteModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [firstname, setFirstname] = useState('')
  const [lastname, setLastname] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [sent, setSent] = useState(false)

  const invite = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('invite-practitioner', {
        body: { firstname, lastname, email, phone },
      })
      if (error) throw error
    },
    onSuccess: () => {
      setSent(true)
      queryClient.invalidateQueries({ queryKey: ['org-practitioners'] })
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Inviter un praticien" className="relative bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
        {sent ? (
          <div className="text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
              <Icon name="check_circle" style={{ fontSize: '28px', color: '#059669' }} />
            </div>
            <h3 className="text-lg font-bold text-[#0b1c30]">Invitation envoyée !</h3>
            <p className="text-sm text-[#6f787e]">{firstname} recevra un email avec un code de vérification.</p>
            <button onClick={onClose} className="w-full py-2.5 bg-[#82d8ff] text-[#0b1c30] rounded-full text-sm font-semibold">
              Fermer
            </button>
          </div>
        ) : (
          <>
            <h3 className="text-lg font-bold text-[#0b1c30] mb-4">Inviter un praticien</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input aria-label="Prénom" value={firstname} onChange={e => setFirstname(e.target.value)} placeholder="Prénom"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#82d8ff]" />
                <input aria-label="Nom" value={lastname} onChange={e => setLastname(e.target.value)} placeholder="Nom"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#82d8ff]" />
              </div>
              <input aria-label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email"
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#82d8ff]" />
              <input aria-label="Téléphone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Téléphone (optionnel)"
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#82d8ff]" />
            </div>
            {invite.isError && <p className="text-sm text-red-500 mt-3">{(invite.error as Error).message}</p>}
            <div className="flex gap-3 mt-6">
              <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-full text-sm font-medium text-[#6f787e] hover:bg-slate-50">
                Annuler
              </button>
              <button
                onClick={() => invite.mutate()}
                disabled={!firstname.trim() || !lastname.trim() || !email.trim() || invite.isPending}
                className="flex-1 py-2.5 bg-[#82d8ff] text-[#0b1c30] rounded-full text-sm font-semibold disabled:opacity-50"
              >
                {invite.isPending ? 'Envoi...' : 'Envoyer l\'invitation'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function useMyOrgId() {
  return useQuery<string | null>({
    queryKey: ['my-org-id'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const { data: profile } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
      return profile?.organization_id ?? null
    },
    staleTime: 5 * 60_000,
  })
}

export default function OrganizationPractitionersPage() {
  const { data: practitioners, isLoading, error } = useOrgPractitioners()
  const { data: organizationId } = useMyOrgId()
  const queryClient = useQueryClient()
  const [showInvite, setShowInvite] = useState(false)
  const [validateError, setValidateError] = useState<string | null>(null)
  const [assignRoleError, setAssignRoleError] = useState<string | null>(null)
  const [detachError, setDetachError] = useState<string | null>(null)

  const userIds = (practitioners ?? []).map(p => p.user_id)
  const { data: roleData } = useOrgRoleAssignments(userIds, organizationId ?? null)

  const validate = useMutation({
    mutationFn: async (practitionerId: string) => {
      const { error: fnError } = await supabase.functions.invoke('validate-org-practitioner', {
        body: { practitioner_id: practitionerId },
      })
      if (fnError) throw fnError
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['org-practitioners'] }),
    onError: (e: Error) => setValidateError(e.message),
  })

  const assignRole = useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: string }) => {
      if (!organizationId) return
      // v1: one role per member — replace any existing assignment in this org.
      await supabase.from('user_roles').delete().eq('user_id', userId).eq('organization_id', organizationId)
      if (roleId) {
        const { error: insertError } = await supabase.from('user_roles').insert({ user_id: userId, role_id: roleId, organization_id: organizationId })
        if (insertError) throw insertError
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['org-role-assignments'] }),
    onError: (e: Error) => setAssignRoleError(e.message),
  })

  const detach = useMutation({
    mutationFn: async (practitionerId: string) => {
      const { data: { session } } = await supabase.auth.getSession()
      const { error } = await supabase.functions.invoke('detach-org-practitioner', {
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: { practitioner_id: practitionerId },
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['org-practitioners'] }),
    onError: (e: Error) => setDetachError(e.message),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1c30]">Praticiens</h1>
          <p className="text-sm text-[#6f787e] mt-1">Membres de votre organisation</p>
        </div>
        <button onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#82d8ff] text-[#0b1c30] text-sm font-bold rounded-xl hover:shadow-lg transition-all">
          <Icon name="person_add" style={{ fontSize: '18px' }} />
          Inviter un praticien
        </button>
      </div>

      {error && (
        <div className="rounded-2xl px-5 py-4 bg-red-50 border border-red-100 text-sm text-red-700">
          Erreur de chargement : {(error as Error).message}
        </div>
      )}
      {validateError && (
        <div className="rounded-2xl px-5 py-4 bg-red-50 border border-red-100 text-sm text-red-700">
          Impossible de valider : {validateError}
        </div>
      )}
      {assignRoleError && (
        <div className="rounded-2xl px-5 py-4 bg-red-50 border border-red-100 text-sm text-red-700">
          Impossible de changer le rôle : {assignRoleError}
        </div>
      )}
      {detachError && (
        <div className="rounded-2xl px-5 py-4 bg-red-50 border border-red-100 text-sm text-red-700">
          Impossible de retirer ce praticien : {detachError}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="rounded-2xl h-24 animate-pulse bg-white/40" />)}
        </div>
      ) : (practitioners ?? []).length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.60)', border: '1px solid rgba(255,255,255,0.80)' }}>
          <Icon name="group" style={{ fontSize: '48px', color: '#bec8ce' }} />
          <p className="font-semibold text-[#0b1c30] mt-3">Aucun praticien pour le moment</p>
          <p className="text-sm text-[#6f787e] mt-1">Invitez votre premier praticien pour commencer.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(practitioners ?? []).map(p => (
            <div key={p.id} className="rounded-2xl p-5 flex items-center gap-4 flex-wrap"
              style={{ backgroundColor: 'rgba(255,255,255,0.60)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.80)' }}>
              <div className="w-11 h-11 rounded-full bg-[#82d8ff] flex items-center justify-center text-[#0b1c30] font-bold text-sm flex-shrink-0">
                {(p.users?.full_name ?? 'P').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#0b1c30] truncate">{p.users?.full_name ?? '—'}</p>
                <p className="text-sm text-[#6f787e] truncate">{p.speciality || 'Spécialité non renseignée'}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-semibold px-3 py-1 rounded-full flex-shrink-0 ${STATUS_COLORS[p.verification_status]}`}>
                  M-Santé : {STATUS_LABELS[p.verification_status]}
                </span>
                <span className={`text-xs font-semibold px-3 py-1 rounded-full flex-shrink-0 ${p.org_validated_at ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  Organisation : {p.org_validated_at ? 'Validé' : 'En attente'}
                </span>
                {roleData?.roles && roleData.roles.length > 0 && (
                  <select
                    value={roleData.assignments[p.user_id] ?? ''}
                    onChange={e => {
                      const nextRoleId = e.target.value
                      const nextName = roleData.roles.find(r => r.id === nextRoleId)?.name ?? 'Aucun rôle'
                      if (window.confirm(`Confirmer le changement de rôle vers "${nextName}" pour ${p.users?.full_name ?? 'ce praticien'} ?`)) {
                        setAssignRoleError(null)
                        assignRole.mutate({ userId: p.user_id, roleId: nextRoleId })
                      }
                    }}
                    disabled={assignRole.isPending}
                    className="text-xs border border-slate-200 rounded-full px-3 py-1.5 bg-white/60 text-[#0b1c30] outline-none focus:border-[#82d8ff]"
                  >
                    <option value="">Aucun rôle</option>
                    {roleData.roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                )}
                <button
                  onClick={() => {
                    if (window.confirm(`Retirer ${p.users?.full_name ?? 'ce praticien'} de votre organisation ? Il/elle exercera ensuite en indépendant.`)) {
                      setDetachError(null)
                      detach.mutate(p.id)
                    }
                  }}
                  disabled={detach.isPending}
                  className="text-xs font-semibold text-red-600 hover:text-red-800 disabled:opacity-50"
                >
                  Retirer de l&apos;organisation
                </button>
                {!p.org_validated_at && (
                  <button
                    onClick={() => validate.mutate(p.id)}
                    disabled={validate.isPending}
                    className="px-3 py-1.5 bg-emerald-500 text-white text-xs font-semibold rounded-full hover:bg-emerald-600 transition-colors disabled:opacity-50"
                  >
                    Valider
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
    </div>
  )
}
