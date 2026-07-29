import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/authStore'
import { supabase } from '@/services/supabase'

interface PermissionEntry {
  practitionerId: string
  fullName: string
  speciality: string
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

// Liste des praticiens pour lesquels le patient a un réglage d'autorisations
// (table patient_data_permissions) — permet d'accéder au détail par
// praticien (features/patient/hooks/useDataPermissions) sans devoir passer
// par chaque profil praticien individuellement.
function useMyPermissionEntries() {
  const { profile } = useAuthStore()
  return useQuery<PermissionEntry[]>({
    queryKey: ['my-permission-entries', profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patient_data_permissions')
        .select('practitioner_id, practitioners(id, speciality, users(full_name))')
        .eq('patient_id', profile!.id)
      if (error) throw error
      return (data ?? []).map(row => {
        const pract = row.practitioners as unknown as { id: string; speciality: string; users: { full_name: string } } | null
        return {
          practitionerId: row.practitioner_id,
          fullName: pract?.users?.full_name ?? 'Praticien',
          speciality: pract?.speciality ?? '',
        }
      })
    },
  })
}

export default function PatientPermissionsListScreen() {
  const router = useRouter()
  const { data: entries = [], isLoading } = useMyPermissionEntries()

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 8 }}>
          <MaterialIcons name="arrow-back" size={22} color="#82d8ff" />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'Manrope', fontSize: 20, fontWeight: '700', color: '#0b1c30' }}>Rôles & autorisations</Text>
        <Text style={{ fontFamily: 'Manrope', fontSize: 13, color: '#6f787e', marginTop: 4 }}>
          Ce que chaque praticien peut consulter de vos données
        </Text>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#82d8ff" size="large" />
        </View>
      ) : entries.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 40 }}>
          <MaterialIcons name="shield" size={36} color="#bec8ce" />
          <Text style={{ fontSize: 14, color: '#6f787e', fontFamily: 'Manrope', textAlign: 'center' }}>
            Aucune autorisation à gérer pour le moment — elles apparaissent après un premier rendez-vous.
          </Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={e => e.practitionerId}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8 }}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: 'rgba(226,232,240,0.5)' }} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/(patient)/permissions/[practitionerId]', params: { practitionerId: item.practitionerId, practitionerName: item.fullName } })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 }}
            >
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: 'Manrope', fontWeight: '800', fontSize: 15, color: '#82d8ff' }}>{getInitials(item.fullName)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope' }}>{item.fullName}</Text>
                <Text style={{ fontSize: 12, color: '#6f787e', fontFamily: 'Manrope' }}>{item.speciality}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color="#bec8ce" />
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  )
}
