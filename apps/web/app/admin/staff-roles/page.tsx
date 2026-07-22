'use client'
import { useMemo, useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useStaffRoles, useRolePermissionIds } from './useStaffRoles'

interface SecretaryPermission { id: string; key: string; label: string; description: string | null; delegatable: boolean }

// Section 23 : plafond fixé par l'administrateur général sur ce qu'un
// praticien peut déléguer à ses secrétaires — un praticien ne peut jamais
// accorder une permission désactivée ici (contrainte également imposée
// côté RLS, cette bascule n'est pas la seule ligne de défense).
function SecretaryDelegationSection() {
  const qc = useQueryClient()
  const { data: perms, isLoading } = useQuery<SecretaryPermission[]>({
    queryKey: ['secretary-permissions-catalog'],
    queryFn: async () => {
      const { data, error } = await supabase.from('secretary_permissions_catalog').select('*').order('key')
      if (error) throw error
      return data ?? []
    },
  })

  const toggle = useMutation({
    mutationFn: async ({ key, delegatable }: { key: string; delegatable: boolean }) => {
      const { error } = await supabase.from('secretary_permissions_catalog').update({ delegatable }).eq('key', key)
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['secretary-permissions-catalog'] }),
  })

  return (
    <div className="rounded-2xl p-6 space-y-4" style={{ backgroundColor: 'rgba(255,255,255,0.60)', border: '1px solid rgba(255,255,255,0.80)' }}>
      <div>
        <h2 className="text-lg font-bold text-[#0b1c30]">Délégation aux secrétaires (praticiens)</h2>
        <p className="text-sm text-[#6f787e] mt-0.5">
          Permissions que les praticiens indépendants peuvent accorder à leurs secrétaires. Désactiver une permission ici
          l&apos;empêche d&apos;être déléguée, même si un praticien l&apos;avait déjà accordée.
        </p>
      </div>
      {isLoading ? (
        <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-14 rounded-xl bg-white/40 animate-pulse" />)}</div>
      ) : (
        <div className="space-y-2">
          {(perms ?? []).map(p => (
            <label key={p.key} className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-slate-200 cursor-pointer">
              <div>
                <p className="text-sm font-semibold text-[#0b1c30]">{p.label}</p>
                {p.description && <p className="text-xs text-[#6f787e] mt-0.5">{p.description}</p>}
              </div>
              <input type="checkbox" checked={p.delegatable} disabled={toggle.isPending}
                onChange={e => toggle.mutate({ key: p.key, delegatable: e.target.checked })}
                className="w-5 h-5 accent-[#82d8ff] flex-shrink-0" />
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

interface OrgPermission { id: string; code: string; label: string; category: string; delegatable: boolean }

// Section 24 : plafond fixé par l'administrateur général sur ce qu'un admin
// d'organisation peut déléguer à un rôle de son organisation (ex-secteur.
// users.manage / roles.manage pouvaient jusqu'ici être accordés à n'importe
// quel rôle personnalisé sans aucun garde-fou platform-level).
function OrgPermissionDelegationSection() {
  const qc = useQueryClient()
  const { data: perms, isLoading } = useQuery<OrgPermission[]>({
    queryKey: ['org-permissions-catalog'],
    queryFn: async () => {
      const { data, error } = await supabase.from('permissions').select('*').order('category').order('label')
      if (error) throw error
      return data ?? []
    },
  })

  const toggle = useMutation({
    mutationFn: async ({ id, delegatable }: { id: string; delegatable: boolean }) => {
      const { error } = await supabase.from('permissions').update({ delegatable }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['org-permissions-catalog'] }),
  })

  const categories = useMemo(() => [...new Set((perms ?? []).map(p => p.category))], [perms])

  return (
    <div className="rounded-2xl p-6 space-y-4" style={{ backgroundColor: 'rgba(255,255,255,0.60)', border: '1px solid rgba(255,255,255,0.80)' }}>
      <div>
        <h2 className="text-lg font-bold text-[#0b1c30]">Délégation aux organisations</h2>
        <p className="text-sm text-[#6f787e] mt-0.5">
          Permissions que les administrateurs d&apos;organisation peuvent accorder à leurs propres rôles (page Rôles &amp; permissions
          de l&apos;espace organisation). Désactiver une permission ici l&apos;empêche d&apos;être déléguée, même si un admin
          d&apos;organisation l&apos;avait déjà accordée à un rôle.
        </p>
      </div>
      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-14 rounded-xl bg-white/40 animate-pulse" />)}</div>
      ) : (
        <div className="space-y-4">
          {categories.map(cat => (
            <div key={cat}>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#6f787e] mb-2">{cat}</p>
              <div className="space-y-2">
                {(perms ?? []).filter(p => p.category === cat).map(p => (
                  <label key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-slate-200 cursor-pointer">
                    <span className="text-sm font-semibold text-[#0b1c30]">{p.label}</span>
                    <input type="checkbox" checked={p.delegatable} disabled={toggle.isPending}
                      onChange={e => toggle.mutate({ id: p.id, delegatable: e.target.checked })}
                      className="w-5 h-5 accent-[#82d8ff] flex-shrink-0" />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span className="material-symbols-outlined" style={style}>{name}</span>
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function StaffRolesPage() {
  const { roles, permissions, teamMembers, createRole, deleteRole, setRolePermissions, assignMember } = useStaffRoles()
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [addMemberId, setAddMemberId] = useState('')

  const { data: rolePermIds } = useRolePermissionIds(selectedRoleId)

  useEffect(() => {
    if (!selectedRoleId && (roles.data ?? []).length > 0) setSelectedRoleId(roles.data![0].id)
  }, [roles.data, selectedRoleId])

  useEffect(() => {
    setChecked(new Set(rolePermIds ?? []))
  }, [rolePermIds])

  const selectedRole = (roles.data ?? []).find(r => r.id === selectedRoleId) ?? null

  const permissionsData = permissions.data
  const grouped = useMemo(() => {
    const map = new Map<string, typeof permissionsData>()
    for (const p of permissionsData ?? []) {
      if (!map.has(p.category)) map.set(p.category, [])
      map.get(p.category)!.push(p)
    }
    return Array.from(map.entries())
  }, [permissionsData])

  const members = (teamMembers.data ?? []).filter(m => selectedRoleId && m.roleIds.includes(selectedRoleId))
  const nonMembers = (teamMembers.data ?? []).filter(m => !selectedRoleId || !m.roleIds.includes(selectedRoleId))

  const togglePerm = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const handleSavePermissions = () => {
    if (!selectedRoleId) return
    setRolePermissions.mutate({ roleId: selectedRoleId, permissionIds: Array.from(checked) })
  }

  const handleCreateRole = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    createRole.mutate({ name: newName.trim(), description: newDesc.trim() }, {
      onSuccess: () => { setShowCreate(false); setNewName(''); setNewDesc('') },
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0b1c30]">Rôles admin granulaires</h1>
        <p className="text-sm text-[#6f787e] mt-0.5">Créez des rôles sur-mesure pour votre équipe avec des permissions précises</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
        {/* Roles list */}
        <div className="space-y-3">
          <button onClick={() => setShowCreate(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-[#0b1c30]"
            style={{ backgroundColor: '#82d8ff' }}>
            <Icon name="add" style={{ fontSize: '18px' }} />
            Nouveau rôle
          </button>
          <div className="space-y-2">
            {(roles.data ?? []).map(role => (
              <button key={role.id} onClick={() => setSelectedRoleId(role.id)}
                className="w-full text-left px-4 py-3 rounded-xl transition-all"
                style={{
                  backgroundColor: selectedRoleId === role.id ? 'rgba(130,216,255,0.15)' : 'rgba(255,255,255,0.70)',
                  border: selectedRoleId === role.id ? '1px solid #82d8ff' : '1px solid rgba(255,255,255,0.80)',
                }}>
                <p className="text-sm font-bold text-[#0b1c30]">{role.name}</p>
                {role.description && <p className="text-xs text-[#6f787e] mt-0.5 line-clamp-1">{role.description}</p>}
                {role.is_system && <span className="text-[10px] font-semibold text-[#82d8ff] uppercase tracking-wide">Rôle par défaut</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Detail */}
        {selectedRole && (
          <div className="space-y-5">
            <div className="rounded-2xl p-5 flex items-center justify-between" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
              <div>
                <h2 className="text-lg font-bold text-[#0b1c30]">{selectedRole.name}</h2>
                {selectedRole.description && <p className="text-sm text-[#6f787e] mt-0.5">{selectedRole.description}</p>}
              </div>
              {!selectedRole.is_system && (
                <button onClick={() => { if (confirm('Supprimer ce rôle ? Les membres assignés perdront leurs permissions.')) deleteRole.mutate(selectedRole.id) }}
                  className="text-[#ba1a1a] hover:bg-red-50 p-2 rounded-lg">
                  <Icon name="delete" style={{ fontSize: '18px' }} />
                </button>
              )}
            </div>

            {/* Permissions */}
            <div className="rounded-2xl p-5 space-y-4" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
              <h3 className="text-sm font-bold text-[#0b1c30]">Permissions</h3>
              {grouped.map(([category, perms]) => (
                <div key={category} className="space-y-2">
                  <p className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">{category}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(perms ?? []).map(p => (
                      <label key={p.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 cursor-pointer">
                        <input type="checkbox" checked={checked.has(p.id)} onChange={() => togglePerm(p.id)}
                          className="w-4 h-4 accent-[#82d8ff]" />
                        <span className="text-sm text-[#0b1c30]">{p.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              <button onClick={handleSavePermissions} disabled={setRolePermissions.isPending}
                className="px-4 py-2 rounded-xl text-sm font-bold text-[#0b1c30] disabled:opacity-50"
                style={{ backgroundColor: '#82d8ff' }}>
                {setRolePermissions.isPending ? 'Sauvegarde...' : 'Sauvegarder les permissions'}
              </button>
            </div>

            {/* Members */}
            <div className="rounded-2xl p-5 space-y-3" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
              <h3 className="text-sm font-bold text-[#0b1c30]">Membres ({members.length})</h3>
              <div className="space-y-2">
                {members.map(m => (
                  <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#82d8ff] flex items-center justify-center text-[9px] font-bold text-[#0b1c30]">
                        {initials(m.full_name)}
                      </div>
                      <span className="text-sm text-[#0b1c30]">{m.full_name}</span>
                    </div>
                    <button onClick={() => assignMember.mutate({ userId: m.id, roleId: selectedRole.id, assign: false })}
                      className="text-xs font-semibold text-[#ba1a1a] hover:underline">
                      Retirer
                    </button>
                  </div>
                ))}
                {members.length === 0 && <p className="text-sm text-[#bec8ce] text-center py-3">Aucun membre assigné</p>}
              </div>
              <div className="flex gap-2 pt-2">
                <select value={addMemberId} onChange={e => setAddMemberId(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl text-sm border border-slate-200 text-[#0b1c30]">
                  <option value="">Choisir un membre de l&apos;équipe...</option>
                  {nonMembers.map(m => (
                    <option key={m.id} value={m.id}>{m.full_name}{m.roleIds.length > 0 ? ` (${m.roleIds.length} autre${m.roleIds.length > 1 ? 's' : ''} rôle${m.roleIds.length > 1 ? 's' : ''})` : ''}</option>
                  ))}
                </select>
                <button
                  onClick={() => { if (addMemberId) { assignMember.mutate({ userId: addMemberId, roleId: selectedRole.id, assign: true }); setAddMemberId('') } }}
                  disabled={!addMemberId}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-[#0b1c30] disabled:opacity-50"
                  style={{ backgroundColor: '#82d8ff' }}>
                  Ajouter
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <SecretaryDelegationSection />

      <OrgPermissionDelegationSection />

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-[#0b1c30]">Nouveau rôle</h3>
            <form onSubmit={handleCreateRole} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-[#0b1c30] mb-1.5">Nom du rôle</label>
                <input value={newName} onChange={e => setNewName(e.target.value)}
                  className="w-full rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm text-[#0b1c30] focus:outline-none focus:border-[#82d8ff]"
                  placeholder="Ex : Responsable réseaux sociaux" />
              </div>
              <div>
                <label className="block text-sm font-bold text-[#0b1c30] mb-1.5">Description</label>
                <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2}
                  className="w-full rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm text-[#0b1c30] focus:outline-none focus:border-[#82d8ff] resize-none" />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 border-2 border-slate-200 text-[#0b1c30] rounded-xl py-2.5 text-sm font-bold hover:bg-slate-50">
                  Annuler
                </button>
                <button type="submit" disabled={createRole.isPending} className="flex-1 bg-[#82d8ff] text-[#0b1c30] rounded-xl py-2.5 text-sm font-bold disabled:opacity-50">
                  {createRole.isPending ? 'Création...' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
