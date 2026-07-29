import { View, Text, TouchableOpacity, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useAuthStore } from '@/features/auth/store/authStore'
import { useResponsive } from '@/hooks/useResponsive'

export default function OrganizationProfileScreen() {
  const router = useRouter()
  const { profile } = useAuth()
  const { signOut } = useAuthStore()
  const { px, fs, scale } = useResponsive()
  const initials = (profile?.full_name ?? 'O').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  const handleSignOut = () => {
    Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnecter', style: 'destructive', onPress: () => void signOut() },
    ])
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }} edges={['top']}>
      <View style={{ paddingHorizontal: px, paddingTop: scale(24), gap: scale(20) }}>
        <View style={{ alignItems: 'center', gap: scale(16) }}>
          <View style={{ width: scale(80), height: scale(80), borderRadius: scale(40), backgroundColor: '#82d8ff', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.xxl, fontWeight: '800', color: '#005e7a' }}>{initials}</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.lg, fontWeight: '800', color: '#0b1c30' }}>
              {profile?.full_name ?? 'Administrateur'}
            </Text>
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, color: '#6f787e', marginTop: 2 }}>
              Administrateur d&apos;organisation
            </Text>
          </View>
        </View>

        <View style={{ borderRadius: scale(20), backgroundColor: 'rgba(255,255,255,0.70)', padding: scale(20), borderWidth: 1, borderColor: 'rgba(255,255,255,0.80)' }}>
          <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: '#0b1c30', marginBottom: 4 }}>
            Outils
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(organization)/messages')}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: scale(14), borderBottomWidth: 1, borderBottomColor: 'rgba(190,200,206,0.25)' }}
          >
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <MaterialIcons name="forum" size={18} color="#82d8ff" />
            </View>
            <Text style={{ flex: 1, fontFamily: 'Manrope', fontSize: fs.sm, color: '#0b1c30', fontWeight: '500' }}>Messages</Text>
            <MaterialIcons name="chevron-right" size={20} color="#bec8ce" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/(organization)/roles')}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: scale(14) }}
          >
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <MaterialIcons name="admin-panel-settings" size={18} color="#82d8ff" />
            </View>
            <Text style={{ flex: 1, fontFamily: 'Manrope', fontSize: fs.sm, color: '#0b1c30', fontWeight: '500' }}>Rôles &amp; permissions</Text>
            <MaterialIcons name="chevron-right" size={20} color="#bec8ce" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={handleSignOut}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: scale(8),
            paddingVertical: scale(14), borderRadius: 999,
            backgroundColor: 'rgba(255,255,255,0.85)', borderWidth: 1, borderColor: '#ffdad6',
          }}
        >
          <MaterialIcons name="logout" size={scale(18)} color="#ba1a1a" />
          <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '700', color: '#ba1a1a' }}>Se déconnecter</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}
