import { View, Text, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useAuthStore } from '@/features/auth/store/authStore'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrateur',
  organization_admin: "Administrateur d'organisation",
  organization_member: 'Collaborateur',
}

export default function WebOnlyScreen() {
  const { profile, signOut } = useAuthStore()
  const roleLabel = ROLE_LABELS[profile?.role ?? ''] ?? 'Ce type de compte'

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 20 }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}>
          <MaterialIcons name="computer" size={36} color="#005e7a" />
        </View>
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope', textAlign: 'center' }}>
            Espace non disponible sur mobile
          </Text>
          <Text style={{ fontSize: 14, color: '#6f787e', fontFamily: 'Manrope', textAlign: 'center', lineHeight: 20 }}>
            {roleLabel} se gère depuis le portail web M-Santé, pas depuis l&apos;application mobile.
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => void signOut()}
          style={{ marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999, backgroundColor: '#82d8ff' }}
        >
          <Text style={{ color: '#0b1c30', fontWeight: '800', fontFamily: 'Manrope', fontSize: 14 }}>Se déconnecter</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}
