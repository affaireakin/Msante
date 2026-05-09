import {
  View, Text, ScrollView, TouchableOpacity, Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useAuthStore } from '@/features/auth/store/authStore'

const FEATURES: {
  icon: React.ComponentProps<typeof MaterialIcons>['name']
  title: string
  desc: string
  bg: string
  accent: string
  route: string
  image: string
}[] = [
  {
    icon: 'psychology',
    title: 'Compagnon Bien-être IA',
    desc: 'Écoute, analyse vos humeurs et propose des exercices 24/7.',
    bg: '#e5eeff',
    accent: '#006685',
    route: '/(patient)/assistant',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAM6TBzewiJgWqmsibg9IuY14FbBSXBLNMtOYagP_lhYGq6vZMGfZsQmp2J5-GLzmQeufDzL5ewf3myh5maCMmjorFSPu3-M6Ii7Y6MHv6Ay5lMcQ4Nv_bcMuMyx8UvRAJsJNlPnGh3iSQJZ9FnQU2HOHrtkkm4pJk2EVslNEX-UyDXAo1SmuZOZzg1U33PaSdRlxsGMLjWzUwbXo1aG-mgUb4mELpadEedwC0Jdc_BHJUGfvPYTGjwOR1EPLuYeLKu029_elD83J5E',
  },
  {
    icon: 'medical-services',
    title: "Réseau d'Experts",
    desc: 'Psychologues, psychiatres et coachs certifiés.',
    bg: '#fff8e1',
    accent: '#705d00',
    route: '/(patient)/find-practitioners',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAI77arCiIsfQJVkT0Xhha3i-m679T75vCTnsFyCl-NhRJaIkf6f8ZiCoFST_Ixbh2knzh0-RrGFQ-aROHml9iUfSswqpucnj0kifscu8KsT3xfGdaa7GCanK-JrvHYkux0oUHSUxEPrVHevCEkB5-2OeBkVV93wEoY3uKLUIOjU6WGysvuxe3A_Pw2diCWV30vd5nDd904MvsKPlznwuzRHjfVrqFpxFKCwd5dXsX6daDHXcFHSkNvgjD0iveL1GeX-YNb2pHwhf20',
  },
  {
    icon: 'videocam',
    title: 'Téléconsultation',
    desc: 'Sessions vidéo chiffrées depuis chez vous.',
    bg: '#e8f5e9',
    accent: '#1d7a3a',
    route: '/(patient)/find-practitioners',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB3FbpHzBwtGIPcoVoliz8dIKQ0C59v5cJAUezNbcXASar35AL6iY1mp9breIqfRqAT-RWVe47lgfTp4N5wp2pcxqpz5oq_kN6ZcHXfnWr_V4QEZrT8Qo_XbefziKoh9D6VHofL23QJXBlq7LsAxXkR6hbpQMTbWgfmTriWrTLdryn2-aB7gNKRZffQow1ihgb3oTDyoKrUmGeRoMYl4rf4HdLcVvRIBhx4CViBUDguSrh65IRIENHusdkZrVPW2wNnBu_wVmjRz61r',
  },
]

const QUICK_ACTIONS: {
  icon: React.ComponentProps<typeof MaterialIcons>['name']
  label: string
  route: string
  bg: string
  text: string
}[] = [
  { icon: 'search', label: 'Trouver\nun praticien', route: '/(patient)/find-practitioners', bg: '#006685', text: '#fff' },
  { icon: 'psychology', label: 'Assistant\nIA', route: '/(patient)/assistant', bg: '#e5eeff', text: '#006685' },
  { icon: 'mood', label: 'Mon\nhumeur', route: '/(patient)/mental-health', bg: '#fff8e1', text: '#705d00' },
  { icon: 'calendar-today', label: 'Rendez-\nvous', route: '/(patient)/appointments', bg: '#f8f9ff', text: '#0b1c30' },
]

export default function PatientHome() {
  const router = useRouter()
  const { profile, signOut } = useAuthStore()
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Patient'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* ── Header ── */}
        <View style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ fontSize: 13, color: '#6f787e', fontFamily: 'Manrope' }}>{greeting},</Text>
            <Text style={{ fontSize: 24, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope', letterSpacing: -0.5 }}>
              {firstName} 👋
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e5eeff' }}
            >
              <MaterialIcons name="notifications-none" size={22} color="#0b1c30" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => signOut()}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e5eeff' }}
            >
              <MaterialIcons name="logout" size={20} color="#6f787e" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Hero Banner ── */}
        <View style={{ marginHorizontal: 24, marginTop: 16, borderRadius: 24, overflow: 'hidden', minHeight: 180 }}>
          <Image
            source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDyq-rcaOffx7_eOt0SbTRG3ZUSPw_eoOCyf8W6WsE95ix7GgX4jU4y0Z85jrSxzJz9ffeOpCs8nVSbKxYMUxo7jxTQPzVyp88zfY0EoqlnG-uD3yiS9qDJER8wWe4bxDt_YPaAnZ76LfJjLRc8HbN182ZqVxlKpWgK9RJEmvLrSwn8pM1POWdbLxv73CwaRJ4PrnJMUFoiWOz_-vNkhLsOOqfgp2GXUiqa1gnnjX3xF-CFmwDSe_MrL3CH_Gr88GVi32Vuj3cmJnCL' }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }}
            resizeMode="cover"
          />
          {/* Overlay */}
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,30,50,0.55)' }} />
          {/* Content */}
          <View style={{ padding: 24, justifyContent: 'space-between', minHeight: 180 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(130,216,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(130,216,255,0.3)' }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ade80' }} />
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700', fontFamily: 'Manrope', letterSpacing: 0.5 }}>98% SATISFACTION</Text>
            </View>
            <View>
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, fontFamily: 'Manrope' }}>Votre sanctuaire de santé mentale,</Text>
              <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', fontFamily: 'Manrope', letterSpacing: -0.5, marginBottom: 16 }}>
                réinventé. ✨
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/(patient)/find-practitioners')}
                style={{ backgroundColor: '#006685', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6 }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14, fontFamily: 'Manrope' }}>Trouver un praticien</Text>
                <Text style={{ color: '#fff', fontSize: 14 }}>→</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Partenaires ── */}
        <View style={{ marginHorizontal: 24, marginTop: 20, backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e5eeff' }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: '#6f787e', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12, fontFamily: 'Manrope' }}>
            NOS PARTENAIRES DE CONFIANCE
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }}>
            {[['💙', 'Wave'], ['🟠', 'Orange Money'], ['🏛️', 'Ministère Santé'], ['🛡️', 'Santevie']].map(([icon, name]) => (
              <View key={name} style={{ alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: 18 }}>{icon}</Text>
                <Text style={{ fontSize: 9, color: '#6f787e', fontFamily: 'Manrope', fontWeight: '600', textAlign: 'center' }}>{name}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Actions Rapides ── */}
        <View style={{ paddingHorizontal: 24, marginTop: 24 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope', marginBottom: 12 }}>
            Actions rapides
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {QUICK_ACTIONS.map(a => (
              <TouchableOpacity
                key={a.label}
                onPress={() => router.push(a.route as never)}
                style={{ flex: 1, backgroundColor: a.bg, borderRadius: 16, padding: 14, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)' }}
              >
                <MaterialIcons name={a.icon} size={24} color={a.text} />
                <Text style={{ fontSize: 10, fontWeight: '700', color: a.text, textAlign: 'center', fontFamily: 'Manrope', lineHeight: 14 }}>
                  {a.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Features ── */}
        <View style={{ paddingHorizontal: 24, marginTop: 28 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope', marginBottom: 4 }}>
            Des solutions pensées pour vous
          </Text>
          <Text style={{ fontSize: 13, color: '#6f787e', fontFamily: 'Manrope', marginBottom: 16 }}>
            Technologie de pointe au service de votre bien-être
          </Text>

          <View style={{ gap: 14 }}>
            {FEATURES.map(f => (
              <TouchableOpacity
                key={f.title}
                onPress={() => router.push(f.route as never)}
                activeOpacity={0.9}
                style={{
                  backgroundColor: '#fff',
                  borderRadius: 20,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: '#e5eeff',
                  shadowColor: '#006685',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.06,
                  shadowRadius: 16,
                  elevation: 2,
                }}
              >
                {/* Image */}
                <View style={{ height: 140, overflow: 'hidden' }}>
                  <Image
                    source={{ uri: f.image }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                  />
                  <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,10,20,0.25)' }} />
                  <View style={{ position: 'absolute', top: 14, left: 14, width: 40, height: 40, borderRadius: 12, backgroundColor: f.bg, alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialIcons name={f.icon} size={22} color={f.accent} />
                  </View>
                </View>
                {/* Content */}
                <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope', marginBottom: 4 }}>
                      {f.title}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#6f787e', fontFamily: 'Manrope', lineHeight: 18 }}>
                      {f.desc}
                    </Text>
                  </View>
                  <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: f.bg, alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialIcons name="chevron-right" size={22} color={f.accent} />
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Stats ── */}
        <View style={{ marginHorizontal: 24, marginTop: 24, flexDirection: 'row', gap: 12 }}>
          {([
            { value: '500+', label: 'Praticiens certifiés', icon: 'medical-services' as const },
            { value: '24/7', label: 'Support IA illimité', icon: 'smart-toy' as const },
            { value: '98%', label: 'Satisfaction patient', icon: 'star' as const },
          ] as { value: string; label: string; icon: React.ComponentProps<typeof MaterialIcons>['name'] }[]).map(s => (
            <View key={s.label} style={{ flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 16, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#e5eeff' }}>
              <MaterialIcons name={s.icon} size={22} color="#006685" />
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#006685', fontFamily: 'Manrope' }}>{s.value}</Text>
              <Text style={{ fontSize: 10, color: '#6f787e', fontFamily: 'Manrope', textAlign: 'center', lineHeight: 14 }}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* ── CTA Final ── */}
        <View style={{ marginHorizontal: 24, marginTop: 24, backgroundColor: '#0b1c30', borderRadius: 24, padding: 24, overflow: 'hidden' }}>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontFamily: 'Manrope', marginBottom: 4 }}>
            Prêt à commencer ?
          </Text>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', fontFamily: 'Manrope', letterSpacing: -0.5, marginBottom: 4 }}>
            Transformez votre rapport à la santé mentale.
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: 'Manrope', marginBottom: 20 }}>
            Essai IA gratuit · Sans engagement
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(patient)/find-practitioners')}
            style={{ backgroundColor: '#006685', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15, fontFamily: 'Manrope' }}>
              Commencer maintenant →
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Footer ── */}
        <View style={{ paddingHorizontal: 24, marginTop: 24, alignItems: 'center' }}>
          <Text style={{ fontSize: 11, color: '#bec8ce', fontFamily: 'Manrope', textAlign: 'center' }}>
            © 2026 M-Santé · Propulsé par l&apos;innovation sénégalaise
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
