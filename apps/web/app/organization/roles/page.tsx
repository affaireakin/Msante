'use client'
import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span className="material-symbols-outlined" style={style}>{name}</span>
}

interface Permission { id: string; code: string; label: string; category: string }
interface OrgRole { id: string; name: string; description: string | null; is_system: boolean }

interface RolesData {
  roles: OrgRole[]
  permissions: Permission[]
  grantedByRole: Record<string, Set<string>> // roleId -> set of permissionId
  canManage: boolean
}

function useRolesData() {
  return useQuery<RolesData>({
    queryKey: ['org-roles-data'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return { roles: [], permissions: [], grantedByRole: {}, canManage: false }

      const { data: profile } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
      const organizationId = profile?.organization_id
      if (!organizationId) return { roles: [], permissions: [], grantedByRole: {}, canManage: false }

      const [{ data: roles }, { data: permissions }, { data: canManage }] = await Promise.all([
        supabase.from('org_roles').select('id, name, description, is_system').eq('organization_id', organizationId).order('is_system', { ascending: false }),
        supabase.from('permissions').select('id, code, label, category').order('category'),
        supabase.rpc('user_has_permission', { perm_code: 'roles.manage' }),
      ])

      const roleIds = (roles ?? []).map(r => r.id)
      const grantedByRole: Record<string, Set<string>> = {}
      for (const r of roleIds) grantedByRole[r] = new Set()

      if (roleIds.length > 0) {
        const { data: rolePerms } = await supabase.from('role_permissions').select('role_id, permission_id').in('role_id', roleIds)
        for (const rp of rolePerms ?? []) grantedByRole[rp.role_id]?.add(rp.permission_id)
      }

      return {
        roles: (roles ?? []) as OrgRole[],
        permissions: (permissions ?? []) as Permission[],
        grantedByRole,
        canManage: !!canManage,
      }
    },
    staleTime: 30_000,
  })
}

export default function OrganizationRolesPage() {
  const { data, isLoading, error } = useRolesData()
  const queryClient = useQueryClient()

  const toggle = useMutation({
    mutationFn: async ({ roleId, permissionId, grant }: { roleId: string; permissionId: string; grant: boolean }) => {
      if (grant) {
        const { error: insertError } = await supabase.from('role_permissions').insert({ role_id: roleId, permission_id: permissionId })
        if (insertError) throw insertError
      } else {
        const { error: deleteError } = await supabase.from('role_permissions').delete().eq('role_id', roleId).eq('permission_id', permissionId)
        if (deleteError) throw deleteError
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['org-roles-data'] }),
  })

  const categories = useMemo(() => {
    const set = new Set((data?.permissions ?? []).map(p => p.category))
    return [...set]
  }, [data])

  if (isLoading) {
    return <div className="space-y-4">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="rounded-2xl h-40 animate-pulse bg-white/40" />)}</div>
  }

  if (error) {
    return <div className="rounded-2xl px-5 py-4 bg-red-50 border border-red-100 text-sm text-red-700">Erreur de chargement : {(error as Error).message}</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0b1c30]">Rôles & permissions</h1>
        <p className="text-sm text-[#6f787e] mt-1">Gérez ce que chaque rôle peut faire dans votre organisation</p>
      </div>

      {!data?.canManage && (
        <div className="rounded-2xl px-5 py-4 bg-amber-50 border border-amber-100 text-sm text-amber-700">
          Vous consultez cet écran en lecture seule — la permission <strong>roles.manage</strong> est requise pour modifier les permissions.
        </div>
      )}

      <div className="space-y-6">
        {(data?.roles ?? []).map(role => (
          <div key={role.id} className="rounded-2xl p-6" style={{ backgroundColor: 'rgba(255,255,255,0.60)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.80)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#e5eeff] flex items-center justify-center flex-shrink-0">
                <Icon name={role.is_system ? 'verified_user' : 'badge'} style={{ fontSize: '20px', color: '#005e7a' }} />
              </div>
              <div>
                <p className="font-bold text-[#0b1c30]">{role.name}</p>
                <p className="text-xs text-[#6f787e]">{role.description || (role.is_system ? 'Rôle système' : 'Rôle personnalisé')}</p>
              </div>
              {role.is_system && (
                <span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-[#005e7a] bg-[#e5eeff] px-2 py-1 rounded-full">Système</span>
              )}
            </div>

            <div className="space-y-4">
              {categories.map(cat => {
                const perms = (data?.permissions ?? []).filter(p => p.category === cat)
                return (
                  <div key={cat}>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-[#6f787e] mb-2">{cat}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {perms.map(p => {
                        const granted = data?.grantedByRole[role.id]?.has(p.id) ?? false
                        return (
                          <label key={p.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors ${
                            granted ? 'bg-[#e5eeff] border-[#82d8ff] text-[#0b1c30]' : 'bg-white/50 border-slate-200 text-[#6f787e]'
                          } ${!data?.canManage ? 'cursor-not-allowed opacity-70' : ''}`}>
                            <input
                              type="checkbox"
                              checked={granted}
                              disabled={!data?.canManage || toggle.isPending}
                              onChange={() => toggle.mutate({ roleId: role.id, permissionId: p.id, grant: !granted })}
                              className="accent-[#82d8ff]"
                            />
                            {p.label}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {(data?.roles ?? []).length === 0 && (
          <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.60)', border: '1px solid rgba(255,255,255,0.80)' }}>
            <Icon name="admin_panel_settings" style={{ fontSize: '48px', color: '#bec8ce' }} />
            <p className="font-semibold text-[#0b1c30] mt-3">Aucun rôle trouvé</p>
          </div>
        )}
      </div>
    </div>
  )
}
