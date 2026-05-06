import { View, Text, TouchableOpacity, StatusBar, Alert, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useAuthStore } from '@/features/auth/store/authStore'
import { GlassCard } from '@/components/ui/GlassCard'

export default function ProfileScreen() {
  const router = useRouter()
  const { profile, practitioner } = useAuth()
  const signOut = useAuthStore((s) => s.signOut)

  const initials = (profile?.full_name ?? 'P')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const isApproved = practitioner?.verification_status === 'approved'

  const handleSignOut = () => {
    Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnecter', style: 'destructive', onPress: () => signOut() },
    ])
  }

  return (
    <SafeAreaView className="flex-1 bg-[#f8f9ff]" edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 24, gap: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={{
            fontFamily: 'Manrope',
            fontSize: 22,
            fontWeight: '700',
            color: '#0b1c30',
          }}
        >
          Profil
        </Text>

        {/* Avatar + identité */}
        <View style={{ alignItems: 'center', gap: 12 }}>
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              backgroundColor: '#006685',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{ fontFamily: 'Manrope', fontWeight: '700', fontSize: 32, color: '#fff' }}
            >
              {initials}
            </Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text
              style={{
                fontFamily: 'Manrope',
                fontSize: 20,
                fontWeight: '700',
                color: '#0b1c30',
              }}
            >
              Dr. {profile?.full_name ?? '—'}
            </Text>
            <Text
              style={{ fontFamily: 'Manrope', fontSize: 14, color: '#6f787e', marginTop: 2 }}
            >
              {practitioner?.speciality ?? '—'}
            </Text>
          </View>

          {/* Badge vérification */}
          <View
            style={{
              paddingHorizontal: 16,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: isApproved ? '#d1fae5' : '#fef3c7',
            }}
          >
            <Text
              style={{
                fontFamily: 'Manrope',
                fontSize: 12,
                fontWeight: '700',
                color: isApproved ? '#1d7a3a' : '#92400e',
              }}
            >
              {isApproved ? '✓ Compte vérifié' : '⏳ Vérification en cours'}
            </Text>
          </View>
        </View>

        {/* Stats */}
        <GlassCard>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            {[
              {
                label: 'Note',
                value: practitioner?.rating
                  ? `${Number(practitioner.rating).toFixed(1)}/5`
                  : '—',
              },
              {
                label: 'Avis',
                value: String(practitioner?.total_reviews ?? 0),
              },
              {
                label: 'Tarif',
                value: practitioner?.session_price
                  ? `${practitioner.session_price} XOF`
                  : '—',
              },
            ].map(({ label, value }) => (
              <View key={label} style={{ alignItems: 'center' }}>
                <Text
                  style={{
                    fontFamily: 'Manrope',
                    fontSize: 18,
                    fontWeight: '700',
                    color: '#0b1c30',
                  }}
                >
                  {value}
                </Text>
                <Text
                  style={{
                    fontFamily: 'Manrope',
                    fontSize: 11,
                    color: '#6f787e',
                    marginTop: 2,
                  }}
                >
                  {label}
                </Text>
              </View>
            ))}
          </View>
        </GlassCard>

        {/* Disponibilités */}
        <TouchableOpacity
          onPress={() => router.push('/(practitioner)/availability')}
          style={{
            paddingVertical: 16,
            borderRadius: 999,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: '#e5eeff',
            marginTop: 8,
          }}
        >
          <Text style={{ fontSize: 16 }}>🗓️</Text>
          <Text
            style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: '700', color: '#006685' }}
          >
            Gérer mes disponibilités
          </Text>
        </TouchableOpacity>

        {/* Déconnexion */}
        <TouchableOpacity
          onPress={handleSignOut}
          style={{
            paddingVertical: 16,
            borderRadius: 999,
            alignItems: 'center',
            backgroundColor: '#ffdad6',
            marginTop: 8,
          }}
        >
          <Text
            style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: '700', color: '#ba1a1a' }}
          >
            Se déconnecter
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}
