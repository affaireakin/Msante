'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span className="material-symbols-outlined" style={style}>{name}</span>
}

interface Collaborator { id: string; full_name: string; email: string | null; created_at: string }
interface OrgRole { id: string; name: string }

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

function useCollaborators(organizationId: string | null) {
  return useQuery<Collaborator[]>({
    queryKey: ['org-collaborators', organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, created_at')
        .eq('organization_id', organizationId as string)
        .eq('role', 'organization_member')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Collaborator[]
    },
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

function InviteModal({ organizationId, onClose }: { organizationId: string; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [firstname, setFirstname] = useState('')
  const [lastname, setLastname] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [roleId, setRoleId] = useState('')
  const [sent, setSent] = useState(false)

  const { data: roles } = useQuery<OrgRole[]>({
    queryKey: ['org-roles-for-invite', organizationId],
    queryFn: async () => {
      const { data } = await supabase.from('org_roles').select('id, name').eq('organization_id', organizationId).order('is_system', { ascending: false })
      return (data ?? []) as OrgRole[]
    },
  })

  const invite = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('invite-practitioner', {
        body: { firstname, lastname, email, phone, account_type: 'collaborator', role_id: roleId || undefined },
      })
      if (error) throw error
    },
    onSuccess: () => {
      setSent(true)
      queryClient.invalidateQueries({ queryKey: ['org-collaborators'] })
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
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
            <h3 className="text-lg font-bold text-[#0b1c30] mb-4">Inviter un collaborateur</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input value={firstname} onChange={e => setFirstname(e.target.value)} placeholder="Prénom"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#82d8ff]" />
                <input value={lastname} onChange={e => setLastname(e.target.value)} placeholder="Nom"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#82d8ff]" />
              </div>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email"
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#82d8ff]" />
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Téléphone (optionnel)"
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#82d8ff]" />
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Rôle (optionnel)</label>
                <select value={roleId} onChange={e => setRoleId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#82d8ff]">
                  <option value="">Aucun rôle pour l&apos;instant</option>
                  {(roles ?? []).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
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

export default function OrganizationCollaboratorsPage() {
  const { data: organizationId } = useMyOrgId()
  const { data: collaborators, isLoading, error } = useCollaborators(organizationId ?? null)
  const queryClient = useQueryClient()
  const [showInvite, setShowInvite] = useState(false)

  const userIds = (collaborators ?? []).map(c => c.id)
  const { data: roleData } = useOrgRoleAssignments(userIds, organizationId ?? null)

  const assignRole = useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: string }) => {
      if (!organizationId) return
      await supabase.from('user_roles').delete().eq('user_id', userId).eq('organization_id', organizationId)
      if (roleId) {
        const { error: insertError } = await supabase.from('user_roles').insert({ user_id: userId, role_id: roleId, organization_id: organizationId })
        if (insertError) throw insertError
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['org-role-assignments'] }),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1c30]">Collaborateurs</h1>
          <p className="text-sm text-[#6f787e] mt-1">Administrateurs secondaires, modérateurs, comptables, secrétaires…</p>
        </div>
        <button onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#82d8ff] text-[#0b1c30] text-sm font-bold rounded-xl hover:shadow-lg transition-all">
          <Icon name="person_add" style={{ fontSize: '18px' }} />
          Inviter un collaborateur
        </button>
      </div>

      {error && (
        <div className="rounded-2xl px-5 py-4 bg-red-50 border border-red-100 text-sm text-red-700">
          Erreur de chargement : {(error as Error).message}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="rounded-2xl h-20 animate-pulse bg-white/40" />)}
        </div>
      ) : (collaborators ?? []).length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.60)', border: '1px solid rgba(255,255,255,0.80)' }}>
          <Icon name="groups" style={{ fontSize: '48px', color: '#bec8ce' }} />
          <p className="font-semibold text-[#0b1c30] mt-3">Aucun collaborateur pour le moment</p>
          <p className="text-sm text-[#6f787e] mt-1">Invitez votre premier collaborateur pour commencer.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(collaborators ?? []).map(c => (
            <div key={c.id} className="rounded-2xl p-5 flex items-center gap-4 flex-wrap"
              style={{ backgroundColor: 'rgba(255,255,255,0.60)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.80)' }}>
              <div className="w-11 h-11 rounded-full bg-[#e5eeff] flex items-center justify-center text-[#005e7a] font-bold text-sm flex-shrink-0">
                {(c.full_name ?? 'C').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#0b1c30] truncate">{c.full_name ?? '—'}</p>
                <p className="text-sm text-[#6f787e] truncate">{c.email ?? '—'}</p>
              </div>
              {roleData?.roles && roleData.roles.length > 0 && (
                <select
                  value={roleData.assignments[c.id] ?? ''}
                  onChange={e => assignRole.mutate({ userId: c.id, roleId: e.target.value })}
                  disabled={assignRole.isPending}
                  className="text-xs border border-slate-200 rounded-full px-3 py-1.5 bg-white/60 text-[#0b1c30] outline-none focus:border-[#82d8ff]"
                >
                  <option value="">Aucun rôle</option>
                  {roleData.roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              )}
            </div>
          ))}
        </div>
      )}

      {showInvite && organizationId && <InviteModal organizationId={organizationId} onClose={() => setShowInvite(false)} />}
    </div>
  )
}
