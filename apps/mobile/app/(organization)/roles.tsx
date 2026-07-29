import { useMemo, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { useResponsive } from '@/hooks/useResponsive'

interface Permission { id: string; code: string; label: string; category: string; delegatable: boolean }
interface OrgRole { id: string; name: string; description: string | null; is_system: boolean }

interface RolesData {
  roles: OrgRole[]
  permissions: Permission[]
  grantedByRole: Record<string, Set<string>>
  canManage: boolean
}

function useRolesData() {
  return useQuery<RolesData>({
    queryKey: ['org-roles-data-mobile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return { roles: [], permissions: [], grantedByRole: {}, canManage: false }

      const { data: profile } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
      const organizationId = profile?.organization_id
      if (!organizationId) return { roles: [], permissions: [], grantedByRole: {}, canManage: false }

      const [{ data: roles }, { data: permissions }, { data: canManage }] = await Promise.all([
        supabase.from('org_roles').select('id, name, description, is_system').eq('organization_id', organizationId).order('is_system', { ascending: false }),
        supabase.from('permissions').select('id, code, label, category, delegatable').order('category'),
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

export default function OrganizationRolesScreen() {
  const router = useRouter()
  const { fs, scale } = useResponsive()
  const qc = useQueryClient()
  const { data, isLoading, isError } = useRolesData()
  const [expanded, setExpanded] = useState<string | null>(null)

  const toggle = useMutation({
    mutationFn: async ({ roleId, permissionId, grant }: { roleId: string; permissionId: string; grant: boolean }) => {
      if (grant) {
        const { error } = await supabase.from('role_permissions').insert({ role_id: roleId, permission_id: permissionId })
        if (error) throw error
      } else {
        const { error } = await supabase.from('role_permissions').delete().eq('role_id', roleId).eq('permission_id', permissionId)
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-roles-data-mobile'] }),
  })

  const categories = useMemo(() => {
    const set = new Set((data?.permissions ?? []).map(p => p.category))
    return [...set]
  }, [data])

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(12), paddingHorizontal: scale(20), paddingVertical: scale(14), backgroundColor: 'rgba(255,255,255,0.80)', borderBottomWidth: 1, borderBottomColor: 'rgba(229,238,255,0.6)' }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <MaterialIcons name="arrow-back" size={22} color="#0b1c30" />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontFamily: 'Manrope', fontSize: fs.lg, fontWeight: '800', color: '#0b1c30' }}>Rôles &amp; permissions</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: scale(20), gap: scale(12) }} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <ActivityIndicator color="#82d8ff" style={{ marginTop: scale(20) }} />
        ) : isError ? (
          <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, color: '#ba1a1a' }}>Erreur de chargement</Text>
        ) : (
          <>
            {!data?.canManage && (
              <View style={{ backgroundColor: '#fef3c7', borderRadius: scale(12), padding: scale(12) }}>
                <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#92400e' }}>
                  Lecture seule — la permission <Text style={{ fontWeight: '700' }}>roles.manage</Text> est requise pour modifier.
                </Text>
              </View>
            )}

            {(data?.roles ?? []).length === 0 ? (
              <View style={{ alignItems: 'center', gap: scale(8), paddingVertical: scale(40) }}>
                <MaterialIcons name="admin-panel-settings" size={scale(36)} color="#bec8ce" />
                <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, color: '#6f787e' }}>Aucun rôle trouvé</Text>
              </View>
            ) : (data?.roles ?? []).map(role => {
              const isOpen = expanded === role.id
              return (
                <View key={role.id} style={{ backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: scale(16), borderWidth: 1, borderColor: '#e5eeff', overflow: 'hidden' }}>
                  <TouchableOpacity
                    onPress={() => setExpanded(isOpen ? null : role.id)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: scale(12), padding: scale(14) }}
                  >
                    <View style={{ width: scale(38), height: scale(38), borderRadius: scale(10), backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}>
                      <MaterialIcons name={role.is_system ? 'verified-user' : 'badge'} size={scale(18)} color="#005e7a" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '700', color: '#0b1c30' }}>{role.name}</Text>
                      <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#6f787e' }}>
                        {role.description || (role.is_system ? 'Rôle système' : 'Rôle personnalisé')}
                      </Text>
                    </View>
                    <MaterialIcons name={isOpen ? 'expand-less' : 'expand-more'} size={22} color="#6f787e" />
                  </TouchableOpacity>

                  {isOpen && (
                    <View style={{ paddingHorizontal: scale(14), paddingBottom: scale(14), gap: scale(12) }}>
                      {categories.map(cat => {
                        const perms = (data?.permissions ?? []).filter(p => p.category === cat)
                        return (
                          <View key={cat} style={{ gap: scale(6) }}>
                            <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: '#6f787e', textTransform: 'uppercase', letterSpacing: 0.5 }}>{cat}</Text>
                            {perms.map(p => {
                              const granted = data?.grantedByRole[role.id]?.has(p.id) ?? false
                              const locked = !granted && !p.delegatable
                              const disabled = !data?.canManage || toggle.isPending || locked
                              return (
                                <TouchableOpacity
                                  key={p.id}
                                  onPress={() => !disabled && toggle.mutate({ roleId: role.id, permissionId: p.id, grant: !granted })}
                                  disabled={disabled}
                                  style={{
                                    flexDirection: 'row', alignItems: 'center', gap: scale(8),
                                    paddingHorizontal: scale(12), paddingVertical: scale(9), borderRadius: 10,
                                    backgroundColor: granted ? '#e5eeff' : '#f8f9ff',
                                    borderWidth: 1, borderColor: granted ? '#82d8ff' : '#e5eeff',
                                    opacity: disabled && !granted ? 0.6 : 1,
                                  }}
                                >
                                  <MaterialIcons name={granted ? 'check-box' : 'check-box-outline-blank'} size={18} color={granted ? '#82d8ff' : '#bec8ce'} />
                                  <Text style={{ flex: 1, fontFamily: 'Manrope', fontSize: fs.xs, color: granted ? '#0b1c30' : '#6f787e' }}>{p.label}</Text>
                                  {locked && <MaterialIcons name="lock" size={14} color="#bec8ce" />}
                                </TouchableOpacity>
                              )
                            })}
                          </View>
                        )
                      })}
                    </View>
                  )}
                </View>
              )
            })}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
