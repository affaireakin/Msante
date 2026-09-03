import { useMemo } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Switch } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { useResponsive } from '@/hooks/useResponsive'

interface SecretaryPermission { id: string; key: string; label: string; description: string | null; delegatable: boolean }
interface OrgPermission { id: string; code: string; label: string; category: string; delegatable: boolean }

// Plafond fixé par l'administrateur général sur ce que les praticiens
// peuvent déléguer à leurs secrétaires, et ce que les admins d'organisation
// peuvent déléguer à leurs propres rôles — désactiver ici empêche la
// délégation même si déjà accordée en aval.
function useSecretaryPermissions() {
  return useQuery<SecretaryPermission[]>({
    queryKey: ['secretary-permissions-catalog-mobile'],
    queryFn: async () => {
      const { data, error } = await supabase.from('secretary_permissions_catalog').select('*').order('key')
      if (error) throw error
      return data ?? []
    },
  })
}

function useOrgPermissions() {
  return useQuery<OrgPermission[]>({
    queryKey: ['org-permissions-catalog-mobile'],
    queryFn: async () => {
      const { data, error } = await supabase.from('permissions').select('*').order('category').order('label')
      if (error) throw error
      return data ?? []
    },
  })
}

export default function AdminDelegationScreen() {
  const router = useRouter()
  const { fs, scale } = useResponsive()
  const qc = useQueryClient()

  const { data: secretaryPerms = [], isLoading: loadingSec } = useSecretaryPermissions()
  const { data: orgPerms = [], isLoading: loadingOrg } = useOrgPermissions()

  const toggleSecretary = useMutation({
    mutationFn: async ({ key, delegatable }: { key: string; delegatable: boolean }) => {
      const { error } = await supabase.from('secretary_permissions_catalog').update({ delegatable }).eq('key', key)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['secretary-permissions-catalog-mobile'] }),
  })

  const toggleOrg = useMutation({
    mutationFn: async ({ id, delegatable }: { id: string; delegatable: boolean }) => {
      const { error } = await supabase.from('permissions').update({ delegatable }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-permissions-catalog-mobile'] }),
  })

  const orgCategories = useMemo(() => [...new Set(orgPerms.map(p => p.category))], [orgPerms])

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(12), paddingHorizontal: scale(20), paddingVertical: scale(14), backgroundColor: 'rgba(255,255,255,0.80)', borderBottomWidth: 1, borderBottomColor: 'rgba(229,238,255,0.6)' }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <MaterialIcons name="arrow-back" size={22} color="#0b1c30" />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontFamily: 'Manrope', fontSize: fs.lg, fontWeight: '800', color: '#0b1c30' }}>Délégation</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: scale(20), gap: scale(16), paddingBottom: scale(100) }} showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: scale(16), borderWidth: 1, borderColor: '#e5eeff', padding: scale(16), gap: scale(10) }}>
          <Text style={{ fontFamily: 'Manrope', fontSize: fs.md, fontWeight: '700', color: '#0b1c30' }}>Délégation aux secrétaires</Text>
          <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#6f787e', lineHeight: scale(17) }}>
            Permissions que les praticiens peuvent accorder à leurs secrétaires. Désactivée ici, une permission ne peut plus être déléguée.
          </Text>
          {loadingSec ? (
            <ActivityIndicator color="#82d8ff" />
          ) : secretaryPerms.map(p => (
            <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: scale(8), borderTopWidth: 1, borderTopColor: 'rgba(190,200,206,0.2)' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '600', color: '#0b1c30' }}>{p.label}</Text>
                {p.description ? <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#6f787e' }}>{p.description}</Text> : null}
              </View>
              <Switch
                value={p.delegatable}
                onValueChange={v => toggleSecretary.mutate({ key: p.key, delegatable: v })}
                disabled={toggleSecretary.isPending}
                trackColor={{ false: '#e2e8f0', true: '#82d8ff' }}
                thumbColor={p.delegatable ? '#82d8ff' : '#fff'}
              />
            </View>
          ))}
        </View>

        <View style={{ backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: scale(16), borderWidth: 1, borderColor: '#e5eeff', padding: scale(16), gap: scale(10) }}>
          <Text style={{ fontFamily: 'Manrope', fontSize: fs.md, fontWeight: '700', color: '#0b1c30' }}>Délégation aux organisations</Text>
          <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#6f787e', lineHeight: scale(17) }}>
            Permissions que les admins d&apos;organisation peuvent accorder à leurs propres rôles.
          </Text>
          {loadingOrg ? (
            <ActivityIndicator color="#82d8ff" />
          ) : orgCategories.map(cat => (
            <View key={cat} style={{ gap: scale(6) }}>
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: '#6f787e', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: scale(6) }}>{cat}</Text>
              {orgPerms.filter(p => p.category === cat).map(p => (
                <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: scale(6) }}>
                  <Text style={{ flex: 1, fontFamily: 'Manrope', fontSize: fs.sm, color: '#0b1c30' }}>{p.label}</Text>
                  <Switch
                    value={p.delegatable}
                    onValueChange={v => toggleOrg.mutate({ id: p.id, delegatable: v })}
                    disabled={toggleOrg.isPending}
                    trackColor={{ false: '#e2e8f0', true: '#82d8ff' }}
                    thumbColor={p.delegatable ? '#82d8ff' : '#fff'}
                  />
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
