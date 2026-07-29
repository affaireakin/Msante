import { View, Text, TouchableOpacity, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useAuthStore } from '@/features/auth/store/authStore'
import { useResponsive } from '@/hooks/useResponsive'

export default function OrganizationProfileScreen() {
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
      <View style={{ paddingHorizontal: px, paddingTop: scale(24), alignItems: 'center', gap: scale(16) }}>
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
        <TouchableOpacity
          onPress={handleSignOut}
          style={{
            marginTop: scale(24), flexDirection: 'row', alignItems: 'center', gap: scale(8),
            paddingHorizontal: scale(24), paddingVertical: scale(12), borderRadius: 9999,
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
