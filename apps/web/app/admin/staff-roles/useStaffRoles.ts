'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface AdminRole {
  id: string
  name: string
  description: string | null
  is_system: boolean
}

export interface AdminPermission {
  id: string
  key: string
  label: string
  category: string
}

export interface AdminTeamMember {
  id: string
  full_name: string
  sub_role: string | null
  roleIds: string[]
}

export function useStaffRoles() {
  const qc = useQueryClient()

  const roles = useQuery<AdminRole[]>({
    queryKey: ['admin-roles-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('admin_roles').select('*').order('is_system', { ascending: false }).order('name')
      if (error) throw error
      return data ?? []
    },
  })

  const permissions = useQuery<AdminPermission[]>({
    queryKey: ['admin-permissions-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('admin_permissions').select('*').order('category').order('label')
      if (error) throw error
      return data ?? []
    },
  })

  const teamMembers = useQuery<AdminTeamMember[]>({
    queryKey: ['admin-team-members-full'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, sub_role, user_admin_roles(role_id)')
        .eq('role', 'admin')
        .order('full_name')
      if (error) throw error
      return (data ?? []).map(u => ({
        id: u.id,
        full_name: u.full_name,
        sub_role: u.sub_role,
        roleIds: ((u.user_admin_roles ?? []) as { role_id: string }[]).map(r => r.role_id),
      }))
    },
  })

  const createRole = useMutation({
    mutationFn: async (input: { name: string; description: string }) => {
      const { error } = await supabase.from('admin_roles').insert({ name: input.name, description: input.description || null })
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-roles-list'] }),
  })

  const deleteRole = useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await supabase.from('admin_roles').delete().eq('id', roleId)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-roles-list'] })
      void qc.invalidateQueries({ queryKey: ['admin-team-members-full'] })
    },
  })

  const setRolePermissions = useMutation({
    mutationFn: async ({ roleId, permissionIds }: { roleId: string; permissionIds: string[] }) => {
      const { error: delError } = await supabase.from('admin_role_permissions').delete().eq('role_id', roleId)
      if (delError) throw delError
      if (permissionIds.length > 0) {
        const { error: insError } = await supabase.from('admin_role_permissions').insert(
          permissionIds.map(permission_id => ({ role_id: roleId, permission_id }))
        )
        if (insError) throw insError
      }
    },
    onSuccess: (_, vars) => void qc.invalidateQueries({ queryKey: ['admin-role-permissions', vars.roleId] }),
  })

  // A collaborator can hold several roles at once — assigning/unassigning
  // one role no longer touches any other role they already have.
  const assignMember = useMutation({
    mutationFn: async ({ userId, roleId, assign }: { userId: string; roleId: string; assign: boolean }) => {
      if (assign) {
        const { error } = await supabase.from('user_admin_roles').insert({ user_id: userId, role_id: roleId })
        if (error) throw error
      } else {
        const { error } = await supabase.from('user_admin_roles').delete().eq('user_id', userId).eq('role_id', roleId)
        if (error) throw error
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-team-members-full'] }),
  })

  return { roles, permissions, teamMembers, createRole, deleteRole, setRolePermissions, assignMember }
}

export function useRolePermissionIds(roleId: string | null) {
  return useQuery<string[]>({
    queryKey: ['admin-role-permissions', roleId],
    enabled: !!roleId,
    queryFn: async () => {
      const { data, error } = await supabase.from('admin_role_permissions').select('permission_id').eq('role_id', roleId!)
      if (error) throw error
      return (data ?? []).map(r => r.permission_id)
    },
  })
}
