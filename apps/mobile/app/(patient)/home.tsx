'use client'
import { useWindowDimensions, View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/authStore'
import { supabase } from '@/services/supabase'

const FEATURES: {
  icon: React.ComponentProps<typeof MaterialIcons>['name']
  title: string
  desc: string
  bg: string
  accent: string
  route: string
}[] = [
  { icon: 'psychology', title: 'Compagnon Bien-être IA', desc: 'Mounima vous écoute, analyse vos humeurs et propose des exercices 24/7.', bg: '#e5eeff', accent: '#006685', route: '/(patient)/assistant' },
  { icon: 'medical-services', title: "Réseau d'Experts", desc: '500+ psychologues, psychiatres et coachs certifiés au Sénégal.', bg: '#fff8e1', accent: '#705d00', route: '/(patient)/find-practitioners' },
  { icon: 'videocam', title: 'Téléconsultation', desc: 'Sessions vidéo chiffrées depuis chez vous, partout en Afrique.', bg: '#e8f5e9', accent: '#1d7a3a', route: '/(patient)/find-practitioners' },
  { icon: 'favorite', title: 'Bien-être quotidien', desc: 'Suivi humeur, méditation, journal émotionnel — construisez votre routine.', bg: '#fce4ec', accent: '#c2185b', route: '/(patient)/mental-health' },
]

const QUICK_ACTIONS = [
  { icon: 'search' as const, label: 'Praticiens', route: '/(patient)/find-practitioners', bg: '#006685', text: '#fff' },
  { icon: 'psychology' as const, label: 'Mounima', route: '/(patient)/assistant', bg: '#e5eeff', text: '#006685' },
  { icon: 'mood' as const, label: 'Humeur', route: '/(patient)/mental-health', bg: '#fff8e1', text: '#705d00' },
  { icon: 'calendar-today' as const, label: 'RDV', route: '/(patient)/appointments', bg: '#f0fdf4', text: '#1d7a3a' },
]

export default function PatientHome() {
  const router = useRouter()
  const { width } = useWindowDimensions()
  const { profile } = useAuthStore()
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

  const px = 20

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* Header */}
        <View style={{ paddingHorizontal: px, paddingTop: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: '#006685', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcons name="medical-services" size={19} color="#fff" />
            </View>
            <View>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope', letterSpacing: -0.3 }}>M-Santé</Text>
              <Text style={{ fontSize: 9, color: '#006685', fontFamily: 'Manrope', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Health Sanctuary</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={() => router.push('/(patient)/notifications')} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e5eeff' }}>
              <MaterialIcons name={unreadCount > 0 ? 'notifications' : 'notifications-none'} size={20} color="#0b1c30" />
              {unreadCount > 0 && <View style={{ position: 'absolute', top: 7, right: 7, width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#ba1a1a', borderWidth: 1.5, borderColor: '#f8f9ff' }} />}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/(patient)/profile' as never)} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#006685', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: 'Manrope', fontWeight: '800', fontSize: 13, color: '#fff' }}>{firstName.slice(0, 1).toUpperCase()}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Greeting Hero */}
        <View style={{ marginHorizontal: px, borderRadius: 22, overflow: 'hidden', backgroundColor: '#0b1c30', minHeight: 160 }}>
          {/* Background dots pattern */}
          <View style={{ position: 'absolute', top: -30, right: -30, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(0,102,133,0.4)' }} />
          <View style={{ position: 'absolute', bottom: -20, left: 40, width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(130,216,255,0.12)' }} />
          <View style={{ padding: 22, minHeight: 160, justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(74,222,128,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(74,222,128,0.3)' }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ade80' }} />
              <Text style={{ color: '#4ade80', fontSize: 10, fontWeight: '700', fontFamily: 'Manrope', letterSpacing: 0.5 }}>98% SATISFACTION</Text>
            </View>
            <View>
              <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, fontFamily: 'Manrope', marginBottom: 2 }}>{greeting},</Text>
              <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800', fontFamily: 'Manrope', letterSpacing: -0.5, marginBottom: 16 }}>
                {firstName} 👋
              </Text>
              <TouchableOpacity onPress={() => router.push('/(patient)/find-practitioners')} style={{ backgroundColor: '#006685', paddingHorizontal: 18, paddingVertical: 11, borderRadius: 13, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13, fontFamily: 'Manrope' }}>Trouver un praticien</Text>
                <MaterialIcons name="arrow-forward" size={15} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={{ paddingHorizontal: px, marginTop: 20 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope', marginBottom: 12 }}>Actions rapides</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {QUICK_ACTIONS.map(a => (
              <TouchableOpacity key={a.label} onPress={() => router.push(a.route as never)}
                style={{ flex: 1, backgroundColor: a.bg, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 6, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)' }}
              >
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: a.text === '#fff' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialIcons name={a.icon} size={22} color={a.text} />
                </View>
                <Text style={{ fontSize: 10, fontWeight: '700', color: a.text, textAlign: 'center', fontFamily: 'Manrope' }}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Partenaires */}
        <View style={{ marginHorizontal: px, marginTop: 18, backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: '#e5eeff' }}>
          <Text style={{ fontSize: 9, fontWeight: '700', color: '#6f787e', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10, fontFamily: 'Manrope' }}>PARTENAIRES DE CONFIANCE</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }}>
            {[['💙', 'Wave'], ['🟠', 'Orange Money'], ['🏛️', 'Min. Santé'], ['🛡️', 'Santevie']].map(([icon, name]) => (
              <View key={name} style={{ alignItems: 'center', gap: 3 }}>
                <Text style={{ fontSize: 20 }}>{icon}</Text>
                <Text style={{ fontSize: 9, color: '#6f787e', fontFamily: 'Manrope', fontWeight: '600', textAlign: 'center' }}>{name}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Features — gradient cards (no external images) */}
        <View style={{ paddingHorizontal: px, marginTop: 22 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope', marginBottom: 4 }}>Des solutions pour vous</Text>
          <Text style={{ fontSize: 12, color: '#6f787e', fontFamily: 'Manrope', marginBottom: 14 }}>Technologie au service de votre bien-être</Text>

          <View style={{ gap: 12 }}>
            {FEATURES.map((f, i) => (
              <TouchableOpacity key={f.title} onPress={() => router.push(f.route as never)} activeOpacity={0.85}
                style={{ borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: `${f.accent}20`, shadowColor: f.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 2 }}
              >
                {/* Gradient-like banner */}
                <View style={{ height: 110, backgroundColor: f.bg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  <View style={{ position: 'absolute', right: -25, top: -25, width: 130, height: 130, borderRadius: 65, backgroundColor: `${f.accent}18` }} />
                  <View style={{ position: 'absolute', left: -15, bottom: -15, width: 80, height: 80, borderRadius: 40, backgroundColor: `${f.accent}10` }} />
                  <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: `${f.accent}20`, alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialIcons name={f.icon} size={34} color={f.accent} />
                  </View>
                </View>
                {/* Content */}
                <View style={{ backgroundColor: '#fff', padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope', marginBottom: 2 }}>{f.title}</Text>
                    <Text style={{ fontSize: 12, color: '#6f787e', fontFamily: 'Manrope', lineHeight: 17 }}>{f.desc}</Text>
                  </View>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: f.bg, alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialIcons name="chevron-right" size={20} color={f.accent} />
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Stats */}
        <View style={{ marginHorizontal: px, marginTop: 20, flexDirection: 'row', gap: 10 }}>
          {[
            { value: '500+', label: 'Praticiens', icon: 'medical-services' as const, color: '#006685', bg: '#e5eeff' },
            { value: '24/7', label: 'Support IA', icon: 'smart-toy' as const, color: '#705d00', bg: '#fff8e1' },
            { value: '98%', label: 'Satisfaction', icon: 'star' as const, color: '#1d7a3a', bg: '#e8f5e9' },
          ].map(s => (
            <View key={s.label} style={{ flex: 1, backgroundColor: s.bg, borderRadius: 16, padding: 14, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: `${s.color}20` }}>
              <MaterialIcons name={s.icon} size={20} color={s.color} />
              <Text style={{ fontSize: 18, fontWeight: '800', color: s.color, fontFamily: 'Manrope' }}>{s.value}</Text>
              <Text style={{ fontSize: 10, color: s.color, fontFamily: 'Manrope', textAlign: 'center', opacity: 0.7, fontWeight: '600' }}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* CTA Final */}
        <View style={{ marginHorizontal: px, marginTop: 20, backgroundColor: '#006685', borderRadius: 22, padding: 22, overflow: 'hidden' }}>
          <View style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.08)' }} />
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, fontFamily: 'Manrope', marginBottom: 4 }}>Prêt à commencer ?</Text>
          <Text style={{ color: '#fff', fontSize: 19, fontWeight: '800', fontFamily: 'Manrope', letterSpacing: -0.5, marginBottom: 4 }}>Transformez votre rapport à la santé mentale.</Text>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontFamily: 'Manrope', marginBottom: 18 }}>Essai IA gratuit · Sans engagement</Text>
          <TouchableOpacity onPress={() => router.push('/(patient)/find-practitioners')} style={{ backgroundColor: '#fff', borderRadius: 13, paddingVertical: 13, alignItems: 'center' }}>
            <Text style={{ color: '#006685', fontWeight: '700', fontSize: 14, fontFamily: 'Manrope' }}>Commencer maintenant →</Text>
          </TouchableOpacity>
        </View>

        <View style={{ paddingHorizontal: px, marginTop: 20, alignItems: 'center' }}>
          <Text style={{ fontSize: 10, color: '#bec8ce', fontFamily: 'Manrope', textAlign: 'center' }}>© 2026 M-Santé · Innovation sénégalaise</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
