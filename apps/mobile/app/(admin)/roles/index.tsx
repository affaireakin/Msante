import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { useResponsive } from '@/hooks/useResponsive'

interface ProfessionPermission {
  id: string
  profession_key: string
  profession_label: string
  category: 'healthcare' | 'wellness'
  description: string | null
}

function useProfessionPermissions() {
  return useQuery<ProfessionPermission[]>({
    queryKey: ['profession-permissions-mobile'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profession_permissions')
        .select('id, profession_key, profession_label, category, description')
        .order('profession_label', { ascending: true })
      if (error) throw error
      return (data ?? []) as ProfessionPermission[]
    },
    staleTime: 30_000,
  })
}

export default function AdminRolesScreen() {
  const router = useRouter()
  const { fs, scale } = useResponsive()
  const { data: professions = [], isLoading, isError } = useProfessionPermissions()

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(12), paddingHorizontal: scale(20), paddingVertical: scale(14), backgroundColor: 'rgba(255,255,255,0.80)', borderBottomWidth: 1, borderBottomColor: 'rgba(229,238,255,0.6)' }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <MaterialIcons name="arrow-back" size={22} color="#0b1c30" />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontFamily: 'Manrope', fontSize: fs.lg, fontWeight: '800', color: '#0b1c30' }}>Rôles &amp; Permissions</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: scale(20), gap: scale(16) }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: scale(8), backgroundColor: '#e5eeff', borderRadius: scale(12), padding: scale(12) }}>
          <MaterialIcons name="info-outline" size={scale(16)} color="#82d8ff" />
          <Text style={{ flex: 1, fontFamily: 'Manrope', fontSize: fs.xs, color: '#005e7a', lineHeight: scale(17) }}>
            Droits cliniques par défaut par profession — le patient affine ensuite individuellement par praticien.
          </Text>
        </View>

        {isLoading ? (
          <ActivityIndicator color="#82d8ff" style={{ marginTop: scale(20) }} />
        ) : isError ? (
          <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, color: '#ba1a1a' }}>Erreur de chargement</Text>
        ) : professions.length === 0 ? (
          <View style={{ alignItems: 'center', gap: scale(8), paddingVertical: scale(40) }}>
            <MaterialIcons name="badge" size={scale(36)} color="#bec8ce" />
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, color: '#6f787e' }}>Aucune profession configurée</Text>
          </View>
        ) : (
          <View style={{ gap: scale(8) }}>
            {professions.map(prof => (
              <TouchableOpacity
                key={prof.id}
                onPress={() => router.push({ pathname: '/(admin)/roles/[key]', params: { key: prof.profession_key } })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: scale(12), backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: scale(14), borderWidth: 1, borderColor: '#e5eeff', padding: scale(14) }}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(6) }}>
                    <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '700', color: '#0b1c30' }}>{prof.profession_label}</Text>
                    <View style={{ paddingHorizontal: scale(7), paddingVertical: scale(2), borderRadius: 999, backgroundColor: prof.category === 'wellness' ? '#e8f5e9' : '#e5eeff' }}>
                      <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: prof.category === 'wellness' ? '#1d7a3a' : '#005e7a' }}>
                        {prof.category === 'wellness' ? 'Bien-être' : 'Santé'}
                      </Text>
                    </View>
                  </View>
                  {prof.description ? (
                    <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#6f787e', marginTop: 2 }} numberOfLines={1}>{prof.description}</Text>
                  ) : null}
                </View>
                <MaterialIcons name="chevron-right" size={20} color="#bec8ce" />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
