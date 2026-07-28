'use client'
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/authStore'
import { supabase } from '@/services/supabase'
import { useResponsive } from '@/hooks/useResponsive'

const QUICK_ACTIONS = [
  { icon: 'search' as const, label: 'Praticiens', route: '/(patient)/find-practitioners', bg: '#82d8ff', text: '#0b1c30' },
  { icon: 'psychology' as const, label: 'Mounima', route: '/(patient)/assistant', bg: '#e5eeff', text: '#006685' },
  { icon: 'mood' as const, label: 'Humeur', route: '/(patient)/mental-health', bg: '#fff8e1', text: '#705d00' },
  { icon: 'calendar-today' as const, label: 'RDV', route: '/(patient)/appointments', bg: '#f0fdf4', text: '#1d7a3a' },
  { icon: 'folder-shared' as const, label: 'Mon dossier', route: '/(patient)/dossier', bg: '#f3e8ff', text: '#6b21a8' },
]

export default function PatientHome() {
  const router = useRouter()
  const { profile } = useAuthStore()
  const { px, fs, scale, width } = useResponsive()
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Patient'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'

  const { data: unreadCount = 0 } = useQuery<number>({
    queryKey: ['notifications-unread', profile?.id],
    enabled: !!profile?.id,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', profile!.id).is('read_at', null)
      return count ?? 0
    },
  })

  const heroHeight = Math.max(150, width * 0.42)
  const avatarBtn = scale(38)
  const iconSize = scale(20)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* Header */}
        <View style={{ paddingHorizontal: px, paddingTop: scale(16), paddingBottom: scale(12), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(10) }}>
            <Image
              source={require('../../assets/icon.png')}
              style={{ width: scale(38), height: scale(38), borderRadius: scale(10) }}
              resizeMode="cover"
            />
            <Text style={{ fontSize: fs.lg, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope', letterSpacing: -0.3 }}>M-Santé</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: scale(8) }}>
            <TouchableOpacity onPress={() => router.push('/(patient)/notifications')}
              style={{ width: avatarBtn, height: avatarBtn, borderRadius: avatarBtn / 2, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e5eeff' }}>
              <MaterialIcons name={unreadCount > 0 ? 'notifications' : 'notifications-none'} size={iconSize} color="#0b1c30" />
              {unreadCount > 0 && <View style={{ position: 'absolute', top: 7, right: 7, width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#ba1a1a', borderWidth: 1.5, borderColor: '#f8f9ff' }} />}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/(patient)/profile' as never)}
              style={{ width: avatarBtn, height: avatarBtn, borderRadius: avatarBtn / 2, backgroundColor: '#82d8ff', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: 'Manrope', fontWeight: '800', fontSize: fs.sm, color: '#fff' }}>{firstName.slice(0, 1).toUpperCase()}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Greeting Hero */}
        <View style={{ marginHorizontal: px, borderRadius: scale(22), overflow: 'hidden', backgroundColor: '#0b1c30', minHeight: heroHeight }}>
          <View style={{ position: 'absolute', top: -30, right: -30, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(0,102,133,0.4)' }} />
          <View style={{ position: 'absolute', bottom: -20, left: 40, width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(130,216,255,0.12)' }} />
          <View style={{ padding: scale(22), minHeight: heroHeight, justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(74,222,128,0.2)', paddingHorizontal: scale(10), paddingVertical: scale(4), borderRadius: 20, borderWidth: 1, borderColor: 'rgba(74,222,128,0.3)' }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ade80' }} />
              <Text style={{ color: '#4ade80', fontSize: fs.xs, fontWeight: '700', fontFamily: 'Manrope', letterSpacing: 0.5 }}>98% SATISFACTION</Text>
            </View>
            <View>
              <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: fs.sm, fontFamily: 'Manrope', marginBottom: 2 }}>{greeting},</Text>
              <Text style={{ color: '#fff', fontSize: fs.xxl, fontWeight: '800', fontFamily: 'Manrope', letterSpacing: -0.5, marginBottom: scale(16) }}>
                {firstName} 👋
              </Text>
              <TouchableOpacity onPress={() => router.push('/(patient)/find-practitioners')}
                style={{ backgroundColor: '#82d8ff', paddingHorizontal: scale(18), paddingVertical: scale(11), borderRadius: scale(13), alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ color: '#0b1c30', fontWeight: '800', fontSize: fs.sm, fontFamily: 'Manrope' }}>Trouver un praticien</Text>
                <MaterialIcons name="arrow-forward" size={scale(15)} color="#0b1c30" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={{ paddingHorizontal: px, marginTop: scale(30) }}>
          <Text style={{ fontSize: fs.md, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope', marginBottom: scale(12) }}>Actions rapides</Text>
          <View style={{ flexDirection: 'row', gap: scale(10) }}>
            {QUICK_ACTIONS.map(a => (
              <TouchableOpacity key={a.label} onPress={() => router.push(a.route as never)}
                style={{ flex: 1, backgroundColor: a.bg, borderRadius: scale(16), paddingVertical: scale(14), paddingHorizontal: scale(6), alignItems: 'center', gap: scale(6), borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)' }}
              >
                <View style={{ width: scale(38), height: scale(38), borderRadius: scale(12), backgroundColor: a.text === '#fff' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialIcons name={a.icon} size={scale(22)} color={a.text} />
                </View>
                <Text style={{ fontSize: fs.xs, fontWeight: '700', color: a.text, textAlign: 'center', fontFamily: 'Manrope' }}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Une seule mise en avant — le compagnon IA, différenciant de l'app.
            Les autres cartes "solutions" retirées faisaient doublon avec les
            Actions rapides ci-dessus (mêmes destinations), et les blocs
            Partenaires/Stats/CTA final ont été retirés pour désencombrer
            l'accueil (inspiré de Doctolib : un seul appel à l'action à la
            fois, beaucoup de respiration). */}
        <View style={{ paddingHorizontal: px, marginTop: scale(30) }}>
          <TouchableOpacity onPress={() => router.push('/(patient)/assistant')} activeOpacity={0.85}
            style={{ borderRadius: scale(20), overflow: 'hidden', borderWidth: 1, borderColor: '#00668520', shadowColor: '#006685', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 2 }}
          >
            <View style={{ height: scale(100), backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <View style={{ position: 'absolute', right: -25, top: -25, width: 130, height: 130, borderRadius: 65, backgroundColor: '#00668518' }} />
              <View style={{ position: 'absolute', left: -15, bottom: -15, width: 80, height: 80, borderRadius: 40, backgroundColor: '#00668510' }} />
              <View style={{ width: scale(60), height: scale(60), borderRadius: scale(18), backgroundColor: '#00668520', alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcons name="psychology" size={scale(32)} color="#006685" />
              </View>
            </View>
            <View style={{ backgroundColor: '#fff', padding: scale(14), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, marginRight: scale(10) }}>
                <Text style={{ fontSize: fs.md, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope', marginBottom: 2 }}>Compagnon Bien-être IA</Text>
                <Text style={{ fontSize: fs.sm, color: '#6f787e', fontFamily: 'Manrope', lineHeight: scale(17) }}>Mounima vous écoute, analyse vos humeurs et propose des exercices 24/7.</Text>
              </View>
              <View style={{ width: scale(32), height: scale(32), borderRadius: scale(16), backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcons name="chevron-right" size={scale(20)} color="#006685" />
              </View>
            </View>
          </TouchableOpacity>
        </View>

        <View style={{ paddingHorizontal: px, marginTop: scale(30), alignItems: 'center' }}>
          <Text style={{ fontSize: scale(10), color: '#bec8ce', fontFamily: 'Manrope', textAlign: 'center' }}>© 2026 M-Santé · Innovation sénégalaise</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
