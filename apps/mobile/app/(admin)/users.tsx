import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, TextInput, Modal, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { useResponsive } from '@/hooks/useResponsive'

type Role = 'all' | 'patient' | 'practitioner' | 'admin' | 'organization_admin' | 'organization_pending' | 'secretary'
type AccountStatus = 'active' | 'suspended' | 'blocked'

interface UserRow {
  id: string
  full_name: string
  role: string
  email: string | null
  phone: string | null
  account_status: AccountStatus | null
  created_at: string
  // PostgREST renvoie l'embed en tableau (pas d'objet unique typé côté client
  // ici) même si user_id est unique côté base — un seul élément en pratique.
  practitioners: { speciality: string; prefix: { prefix: string }[] }[]
  // organizations a DEUX clés étrangères vers users (created_by, validated_by)
  // — l'embed doit être désambiguïsé explicitement (!created_by).
  organizations: { name: string; status: string }[]
}

// Affichait "Praticien" pour tout le monde au lieu de la vraie profession
// (Infirmier, Psychologue, Médecin...) — la spécialité existe pourtant déjà
// en base (practitioners.speciality), simplement jamais récupérée ici.
function roleLabel(user: UserRow): string {
  const practitioner = user.practitioners?.[0]
  if (user.role === 'practitioner' && practitioner?.speciality) {
    const prefix = practitioner.prefix?.[0]?.prefix
    return prefix ? `${prefix} · ${practitioner.speciality}` : practitioner.speciality
  }
  // Un créateur d'organisation reste role='patient' en base tant que sa
  // demande n'est pas validée (le rôle réel n'existe qu'après approbation) —
  // l'afficher comme un simple "Patient" côté admin était trompeur.
  const org = user.organizations?.[0]
  if ((user.role === 'organization_pending' || user.role === 'patient') && org) {
    return org.status === 'pending'
      ? `Organisation en attente · ${org.name}`
      : `Organisation · ${org.name}`
  }
  return ROLE_LABELS[user.role] ?? user.role
}

const ROLE_TABS: { value: Role; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'patient', label: 'Patients' },
  { value: 'practitioner', label: 'Praticiens' },
  { value: 'organization_admin', label: 'Orgs' },
  { value: 'organization_pending', label: 'Orgs en attente' },
  { value: 'secretary', label: 'Secrétaires' },
  { value: 'admin', label: 'Admins' },
]

const ROLE_LABELS: Record<string, string> = {
  patient: 'Patient', practitioner: 'Praticien', admin: 'Admin',
  organization_admin: "Admin d'org", organization_member: 'Collaborateur',
  organization_pending: 'Organisation (en attente)', secretary: 'Secrétaire',
}

const STATUS_META: Record<AccountStatus, { label: string; bg: string; color: string }> = {
  active: { label: 'Actif', bg: '#dcfce7', color: '#166534' },
  suspended: { label: 'Suspendu', bg: '#fef3c7', color: '#92400e' },
  blocked: { label: 'Bloqué', bg: '#ffdad6', color: '#ba1a1a' },
}

function useUsers(role: Role, search: string) {
  return useQuery<UserRow[]>({
    queryKey: ['admin-users-mobile', role, search],
    queryFn: async () => {
      // AUCUN embed ici, volontairement. `practitioners` (user_id,
      // org_validated_by) comme `organizations` (created_by, validated_by)
      // ont chacune DEUX clés étrangères vers `users` : un embed inverse est
      // alors ambigu et PostgREST rejette TOUTE la requête
      // ("more than one relationship was found"). La liste entière
      // disparaissait pour un simple libellé de spécialité. Les données
      // annexes sont donc récupérées par des requêtes séparées, insensibles
      // au nommage des contraintes et à l'ajout futur d'une clé étrangère.
      let query = supabase
        .from('users')
        .select('id, full_name, role, email, phone, account_status, created_at')
        .order('created_at', { ascending: false })
        .limit(100)
      if (role !== 'all') query = query.eq('role', role)
      if (search.trim()) query = query.ilike('full_name', `%${search.trim()}%`)
      const { data, error } = await query
      if (error) throw error
      const rows = (data ?? []) as UserRow[]
      for (const r of rows) { r.practitioners = []; r.organizations = [] }

      // Spécialité + préfixe des praticiens
      const practitionerIds = rows.filter(r => r.role === 'practitioner').map(r => r.id)
      if (practitionerIds.length > 0) {
        const { data: practs } = await supabase
          .from('practitioners')
          .select('user_id, speciality')
          .in('user_id', practitionerIds)
        const { data: withPrefix } = await supabase
          .from('users')
          .select('id, prefix_id, professional_prefixes(prefix)')
          .in('id', practitionerIds)
        const prefixById = new Map<string, string>()
        for (const u of withPrefix ?? []) {
          const p = (u.professional_prefixes as unknown as { prefix: string }[] | { prefix: string } | null)
          const value = Array.isArray(p) ? p[0]?.prefix : p?.prefix
          if (value) prefixById.set(u.id as string, value)
        }
        const byUser = new Map<string, string>()
        for (const p of practs ?? []) {
          if (p.user_id) byUser.set(p.user_id as string, p.speciality as string)
        }
        for (const r of rows) {
          const speciality = byUser.get(r.id)
          if (speciality) {
            const prefix = prefixById.get(r.id)
            r.practitioners = [{ speciality, prefix: prefix ? [{ prefix }] : [] }]
          }
        }
      }

      // Organisation rattachée : un créateur d'organisation garde le rôle
      // 'patient' tant que sa demande n'est pas validée — l'afficher comme un
      // simple patient côté admin était trompeur.
      // 'patient' reste inclus pour les comptes antérieurs à la migration
      // 20260909000001 (demande refusée, donc non régularisée).
      const candidateIds = rows.filter(r => r.role === 'organization_pending' || r.role === 'patient').map(r => r.id)
      if (candidateIds.length > 0) {
        const { data: orgs } = await supabase
          .from('organizations')
          .select('name, status, created_by')
          .in('created_by', candidateIds)
        const byCreator = new Map<string, { name: string; status: string }>()
        for (const o of orgs ?? []) {
          if (o.created_by && !byCreator.has(o.created_by)) {
            byCreator.set(o.created_by, { name: o.name as string, status: o.status as string })
          }
        }
        for (const r of rows) {
          const org = byCreator.get(r.id)
          if (org) r.organizations = [org]
        }
      }
      return rows
    },
  })
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

function UserDetailModal({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const { fs, scale } = useResponsive()
  const qc = useQueryClient()
  const [showReasonFor, setShowReasonFor] = useState<AccountStatus | null>(null)
  const [reason, setReason] = useState('')
  const status = user.account_status ?? 'active'

  const setStatus = useMutation({
    mutationFn: async ({ newStatus, reason: r }: { newStatus: AccountStatus; reason: string }) => {
      const { data, error } = await supabase.functions.invoke('set-account-status', {
        body: { user_id: user.id, new_status: newStatus, reason: r },
      })
      if (error) throw error
      if ((data as { error?: string })?.error) throw new Error((data as { error?: string }).error)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users-mobile'] })
      setShowReasonFor(null)
      setReason('')
      onClose()
    },
    onError: (e: Error) => Alert.alert('Erreur', e.message),
  })

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: scale(20), paddingVertical: scale(16), borderBottomWidth: 1, borderBottomColor: 'rgba(226,232,240,0.5)' }}>
          <Text style={{ fontSize: fs.lg, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope' }}>Détails</Text>
          <TouchableOpacity onPress={onClose}><MaterialIcons name="close" size={22} color="#6f787e" /></TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: scale(20), gap: scale(16), paddingBottom: scale(100) }}>
          <View style={{ alignItems: 'center', gap: scale(10) }}>
            <View style={{ width: scale(64), height: scale(64), borderRadius: scale(32), backgroundColor: '#82d8ff', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.lg, fontWeight: '800', color: '#005e7a' }}>{getInitials(user.full_name)}</Text>
            </View>
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.lg, fontWeight: '800', color: '#0b1c30' }}>{user.full_name}</Text>
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, color: '#6f787e' }}>{roleLabel(user)}</Text>
            <View style={{ paddingHorizontal: scale(12), paddingVertical: scale(5), borderRadius: 999, backgroundColor: STATUS_META[status].bg }}>
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: STATUS_META[status].color }}>{STATUS_META[status].label}</Text>
            </View>
          </View>

          <View style={{ backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: scale(14), borderWidth: 1, borderColor: '#e5eeff', padding: scale(14), gap: scale(8) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(8) }}>
              <MaterialIcons name="email" size={16} color="#82d8ff" />
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, color: '#0b1c30' }}>{user.email ?? '—'}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(8) }}>
              <MaterialIcons name="phone" size={16} color="#82d8ff" />
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, color: '#0b1c30' }}>{user.phone ?? '—'}</Text>
            </View>
          </View>

          {showReasonFor ? (
            <View style={{ gap: scale(10) }}>
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '700', color: '#0b1c30' }}>
                Motif ({showReasonFor === 'active' ? 'réactivation' : 'suspension'})
              </Text>
              <TextInput
                value={reason} onChangeText={setReason} placeholder="Expliquez la raison..." multiline numberOfLines={3}
                style={{ fontFamily: 'Manrope', fontSize: fs.sm, color: '#0b1c30', borderWidth: 1, borderColor: '#e5eeff', borderRadius: 10, padding: scale(12), minHeight: scale(70), textAlignVertical: 'top' }}
              />
              <View style={{ flexDirection: 'row', gap: scale(10) }}>
                <TouchableOpacity onPress={() => setShowReasonFor(null)} style={{ flex: 1, paddingVertical: scale(12), borderRadius: 999, borderWidth: 1, borderColor: '#bec8ce', alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '700', color: '#6f787e' }}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => reason.trim() && setStatus.mutate({ newStatus: showReasonFor, reason: reason.trim() })}
                  disabled={!reason.trim() || setStatus.isPending}
                  style={{ flex: 1, paddingVertical: scale(12), borderRadius: 999, backgroundColor: showReasonFor === 'active' ? '#82d8ff' : '#ba1a1a', alignItems: 'center', opacity: reason.trim() ? 1 : 0.5 }}
                >
                  {setStatus.isPending ? <ActivityIndicator size="small" color="#fff" /> : (
                    <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '800', color: showReasonFor === 'active' ? '#0b1c30' : '#fff' }}>
                      Confirmer
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => setShowReasonFor(status === 'suspended' ? 'active' : 'suspended')}
              style={{ paddingVertical: scale(14), borderRadius: 999, alignItems: 'center', backgroundColor: status === 'suspended' ? '#82d8ff' : '#ffdad6' }}
            >
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '800', color: status === 'suspended' ? '#0b1c30' : '#ba1a1a' }}>
                {status === 'suspended' ? 'Réactiver le compte' : 'Suspendre le compte'}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

export default function AdminUsersScreen() {
  const { fs, scale } = useResponsive()
  const [role, setRole] = useState<Role>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<UserRow | null>(null)
  const { data: users = [], isLoading, error: queryError, refetch } = useUsers(role, search)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }} edges={['top']}>
      {selected && <UserDetailModal user={selected} onClose={() => setSelected(null)} />}

      <View style={{ paddingHorizontal: scale(20), paddingTop: scale(14), paddingBottom: scale(10), backgroundColor: 'rgba(255,255,255,0.80)', borderBottomWidth: 1, borderBottomColor: 'rgba(229,238,255,0.6)', gap: scale(10) }}>
        <Text style={{ fontFamily: 'Manrope', fontSize: fs.lg, fontWeight: '800', color: '#0b1c30' }}>Utilisateurs</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: '#e5eeff', backgroundColor: '#fff' }}>
          <MaterialIcons name="search" size={18} color="#6f787e" />
          <TextInput value={search} onChangeText={setSearch} placeholder="Rechercher un nom..."
            style={{ flex: 1, fontFamily: 'Manrope', fontSize: fs.sm, color: '#0b1c30' }} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: scale(8) }}>
          {ROLE_TABS.map(t => (
            <TouchableOpacity key={t.value} onPress={() => setRole(t.value)}
              style={{ paddingHorizontal: scale(14), paddingVertical: scale(8), borderRadius: 999, backgroundColor: role === t.value ? '#82d8ff' : '#e5eeff' }}>
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: role === t.value ? '#fff' : '#82d8ff' }}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ padding: scale(20), gap: scale(8), paddingBottom: scale(100) }} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <ActivityIndicator color="#82d8ff" style={{ marginTop: scale(20) }} />
        ) : queryError ? (
          // Sans ceci, une requête en échec s'affichait comme une liste vide :
          // impossible de distinguer "aucun résultat" de "la requête a planté".
          <View style={{ padding: scale(14), borderRadius: scale(14), backgroundColor: '#ffdad6', borderWidth: 1, borderColor: 'rgba(186,26,26,0.25)', gap: scale(6) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(8) }}>
              <MaterialIcons name="error-outline" size={scale(18)} color="#ba1a1a" />
              <Text style={{ flex: 1, fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '700', color: '#ba1a1a' }}>
                Impossible de charger les utilisateurs
              </Text>
            </View>
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#ba1a1a' }}>
              {(queryError as Error).message}
            </Text>
            <TouchableOpacity onPress={() => refetch()} style={{ alignSelf: 'flex-start', marginTop: scale(4), paddingHorizontal: scale(14), paddingVertical: scale(8), borderRadius: 999, backgroundColor: '#ba1a1a' }}>
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '800', color: '#fff' }}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        ) : users.length === 0 ? (
          <View style={{ alignItems: 'center', gap: scale(8), paddingVertical: scale(40) }}>
            <MaterialIcons name="person-search" size={scale(36)} color="#bec8ce" />
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, color: '#6f787e' }}>Aucun utilisateur trouvé</Text>
          </View>
        ) : users.map(u => {
          const status = u.account_status ?? 'active'
          return (
            <TouchableOpacity key={u.id} onPress={() => setSelected(u)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: scale(12), backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: scale(14), borderWidth: 1, borderColor: '#e5eeff', padding: scale(12) }}>
              <View style={{ width: scale(38), height: scale(38), borderRadius: scale(19), backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: 'Manrope', fontWeight: '800', fontSize: fs.xs, color: '#82d8ff' }}>{getInitials(u.full_name)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '700', color: '#0b1c30' }}>{u.full_name}</Text>
                <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#6f787e' }}>{roleLabel(u)}</Text>
              </View>
              {status !== 'active' && (
                <View style={{ paddingHorizontal: scale(8), paddingVertical: scale(3), borderRadius: 999, backgroundColor: STATUS_META[status].bg }}>
                  <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: STATUS_META[status].color }}>{STATUS_META[status].label}</Text>
                </View>
              )}
              <MaterialIcons name="chevron-right" size={20} color="#bec8ce" />
            </TouchableOpacity>
          )
        })}
      </ScrollView>
    </SafeAreaView>
  )
}
