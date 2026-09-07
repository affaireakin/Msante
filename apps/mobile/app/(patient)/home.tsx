'use client'
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/authStore'
import { supabase } from '@/services/supabase'
import { useResponsive } from '@/hooks/useResponsive'

// 4 raccourcis en grille 2x2 — "Humeur" retiré car doublon exact de l'onglet
// Activités (même route /mental-health) ; "Praticiens" retiré car déjà
// couvert par le bouton "Trouver un praticien" du bandeau ci-dessus.
const QUICK_ACTIONS = [
  { icon: 'calendar-today' as const, label: 'Rendez-vous', route: '/(patient)/appointments', bg: '#e5eeff', text: '#006685' },
  { icon: 'chat-bubble-outline' as const, label: 'Messagerie', route: '/(patient)/messages', bg: '#f0fdf4', text: '#1d7a3a' },
  { icon: 'psychology' as const, label: 'Mounima', route: '/(patient)/assistant', bg: '#fff8e1', text: '#705d00' },
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
            {/* icon.png (icône de lancement) a un fond bleu opaque intégré —
                rendait un carré bleu autour du logo dans ce header. Même fix
                que welcome.tsx : logo-mark.png, fond transparent. */}
            <Image
              source={require('../../assets/logo-mark.png')}
              style={{ width: scale(38), height: scale(38) }}
              resizeMode="contain"
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

        {/* Quick Actions — grille 2x2 aérée (au lieu de 5 cartes serrées sur
            une seule ligne), inspirée de la référence fournie. */}
        <View style={{ paddingHorizontal: px, marginTop: scale(30) }}>
          <Text style={{ fontSize: fs.md, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope', marginBottom: scale(12) }}>Actions rapides</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: scale(12) }}>
            {QUICK_ACTIONS.map(a => (
              <TouchableOpacity key={a.label} onPress={() => router.push(a.route as never)}
                style={{ width: '47%', backgroundColor: '#fff', borderRadius: scale(18), padding: scale(16), gap: scale(10), borderWidth: 1, borderColor: 'rgba(226,232,240,0.6)', shadowColor: '#82d8ff', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 1 }}
              >
                <View style={{ width: scale(44), height: scale(44), borderRadius: scale(14), backgroundColor: a.bg, alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialIcons name={a.icon} size={scale(22)} color={a.text} />
                </View>
                <Text style={{ fontSize: fs.sm, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope' }}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* La carte "Compagnon Bien-être IA" (mise en avant Mounima) a été
            retirée — retour terrain : elle faisait doublon avec le raccourci
            Mounima des Actions rapides ci-dessus (même route /assistant),
            jugé suffisant et plus pertinent seul. */}

        <View style={{ paddingHorizontal: px, marginTop: scale(30), alignItems: 'center' }}>
          <Text style={{ fontSize: scale(10), color: '#bec8ce', fontFamily: 'Manrope', textAlign: 'center' }}>© 2026 M-Santé · Innovation sénégalaise</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
