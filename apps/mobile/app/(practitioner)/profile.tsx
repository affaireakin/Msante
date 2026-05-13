import {
  View, Text, TouchableOpacity, StatusBar, Alert, ScrollView,
  Image, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useAuthStore } from '@/features/auth/store/authStore'
import { GlassCard } from '@/components/ui/GlassCard'
import { usePractitionerAssetUpload } from '@/features/practitioner/hooks/usePractitionerProfile'

// ── Asset tile ────────────────────────────────────────────────────────────────

function AssetTile({
  label,
  icon,
  url,
  loading,
  onUpload,
  onRemove,
  contain,
}: {
  label: string
  icon: string
  url: string | null
  loading: boolean
  onUpload: () => void
  onRemove: () => void
  contain?: boolean
}) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 8 }}>
      <TouchableOpacity
        onPress={onUpload}
        onLongPress={url ? onRemove : undefined}
        activeOpacity={0.75}
        style={{
          width: '100%',
          aspectRatio: 1,
          borderRadius: 16,
          borderWidth: url ? 1.5 : 1.5,
          borderStyle: url ? 'solid' : 'dashed',
          borderColor: url ? '#006685' : '#bec8ce',
          backgroundColor: url ? '#f0f9ff' : 'rgba(255,255,255,0.6)',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <ActivityIndicator color="#006685" />
        ) : url ? (
          <>
            <Image
              source={{ uri: url }}
              style={{ width: '100%', height: '100%' }}
              resizeMode={contain ? 'contain' : 'cover'}
            />
            {/* Edit overlay */}
            <View style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              backgroundColor: 'rgba(0,102,133,0.65)',
              paddingVertical: 4, alignItems: 'center',
            }}>
              <MaterialIcons name="edit" size={14} color="#fff" />
            </View>
          </>
        ) : (
          <View style={{ alignItems: 'center', gap: 4 }}>
            <MaterialIcons name={icon as 'photo-camera'} size={26} color="#bec8ce" />
            <Text style={{ fontFamily: 'Manrope', fontSize: 10, color: '#6f787e', textAlign: 'center' }}>
              Importer
            </Text>
          </View>
        )}
      </TouchableOpacity>
      <Text style={{ fontFamily: 'Manrope', fontSize: 11, fontWeight: '600', color: '#3f484d', textAlign: 'center' }}>
        {label}
      </Text>
    </View>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const router = useRouter()
  const { profile, practitioner } = useAuth()
  const signOut = useAuthStore((s) => s.signOut)
  const { upload, remove, uploading } = usePractitionerAssetUpload()

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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 24, gap: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ fontFamily: 'Manrope', fontSize: 22, fontWeight: '700', color: '#0b1c30' }}>
          Profil
        </Text>

        {/* ── Avatar + identité ── */}
        <View style={{ alignItems: 'center', gap: 12 }}>

          {/* Avatar tappable */}
          <TouchableOpacity
            onPress={() => void upload('avatar')}
            onLongPress={profile?.avatar_url ? () => remove('avatar') : undefined}
            activeOpacity={0.82}
            style={{ position: 'relative' }}
          >
            <View style={{
              width: 100, height: 100, borderRadius: 50,
              backgroundColor: '#006685',
              alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden',
              borderWidth: 3, borderColor: '#bee9ff',
            }}>
              {uploading === 'avatar' ? (
                <ActivityIndicator color="#fff" size="large" />
              ) : profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              ) : (
                <Text style={{ fontFamily: 'Manrope', fontWeight: '700', fontSize: 32, color: '#fff' }}>
                  {initials}
                </Text>
              )}
            </View>

            {/* Camera badge */}
            <View style={{
              position: 'absolute', bottom: 2, right: 2,
              width: 28, height: 28, borderRadius: 14,
              backgroundColor: '#006685',
              borderWidth: 2, borderColor: '#fff',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <MaterialIcons name="photo-camera" size={13} color="#fff" />
            </View>
          </TouchableOpacity>

          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: 20, fontWeight: '700', color: '#0b1c30' }}>
              Dr. {profile?.full_name ?? '—'}
            </Text>
            <Text style={{ fontFamily: 'Manrope', fontSize: 14, color: '#6f787e', marginTop: 2 }}>
              {practitioner?.speciality ?? '—'}
            </Text>
          </View>

          {/* Badge vérification */}
          <View style={{
            paddingHorizontal: 16, paddingVertical: 6, borderRadius: 999,
            backgroundColor: isApproved ? '#d1fae5' : '#fef3c7',
          }}>
            <Text style={{
              fontFamily: 'Manrope', fontSize: 12, fontWeight: '700',
              color: isApproved ? '#1d7a3a' : '#92400e',
            }}>
              {isApproved ? '✓ Compte vérifié' : 'Vérification en cours'}
            </Text>
          </View>
        </View>

        {/* ── Identité visuelle ── */}
        <GlassCard>
          <View style={{ gap: 14 }}>
            <View style={{ gap: 2 }}>
              <Text style={{ fontFamily: 'Manrope', fontSize: 12, fontWeight: '700', color: '#006685', textTransform: 'uppercase', letterSpacing: 1.2 }}>
                Identité professionnelle
              </Text>
              <Text style={{ fontFamily: 'Manrope', fontSize: 12, color: '#6f787e' }}>
                Apparaît sur vos ordonnances et comptes-rendus
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <AssetTile
                label="Photo"
                icon="photo-camera"
                url={profile?.avatar_url ?? null}
                loading={uploading === 'avatar'}
                onUpload={() => void upload('avatar')}
                onRemove={() => remove('avatar')}
              />
              <AssetTile
                label="Cachet"
                icon="verified"
                url={practitioner?.stamp_url ?? null}
                loading={uploading === 'stamp'}
                onUpload={() => void upload('stamp')}
                onRemove={() => remove('stamp')}
                contain
              />
              <AssetTile
                label="Signature"
                icon="draw"
                url={practitioner?.signature_url ?? null}
                loading={uploading === 'signature'}
                onUpload={() => void upload('signature')}
                onRemove={() => remove('signature')}
                contain
              />
            </View>

            <Text style={{ fontFamily: 'Manrope', fontSize: 10, color: '#6f787e', lineHeight: 15 }}>
              Appuyez pour importer · Maintenez pour supprimer · PNG recommandé pour cachet et signature
            </Text>
          </View>
        </GlassCard>

        {/* ── Stats ── */}
        <GlassCard>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            {[
              { label: 'Note', value: practitioner?.rating ? `${Number(practitioner.rating).toFixed(1)}/5` : '—' },
              { label: 'Avis', value: String(practitioner?.total_reviews ?? 0) },
              { label: 'Tarif', value: practitioner?.session_price ? `${practitioner.session_price} XOF` : '—' },
            ].map(({ label, value }) => (
              <View key={label} style={{ alignItems: 'center' }}>
                <Text style={{ fontFamily: 'Manrope', fontSize: 18, fontWeight: '700', color: '#0b1c30' }}>
                  {value}
                </Text>
                <Text style={{ fontFamily: 'Manrope', fontSize: 11, color: '#6f787e', marginTop: 2 }}>
                  {label}
                </Text>
              </View>
            ))}
          </View>
        </GlassCard>

        {/* ── Disponibilités ── */}
        <TouchableOpacity
          onPress={() => router.push('/(practitioner)/availability')}
          style={{
            paddingVertical: 16, borderRadius: 999,
            alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
            backgroundColor: '#e5eeff',
          }}
        >
          <MaterialIcons name="event-available" size={20} color="#006685" />
          <Text style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: '700', color: '#006685' }}>
            Gérer mes disponibilités
          </Text>
        </TouchableOpacity>

        {/* ── Déconnexion ── */}
        <TouchableOpacity
          onPress={handleSignOut}
          style={{ paddingVertical: 16, borderRadius: 999, alignItems: 'center', backgroundColor: '#ffdad6' }}
        >
          <Text style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: '700', color: '#ba1a1a' }}>
            Se déconnecter
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}
