import { Redirect, Tabs } from 'expo-router'
import { View, Text, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useAuth } from '@/features/auth/hooks/useAuth'

interface TabIconProps {
  name: React.ComponentProps<typeof MaterialIcons>['name']
  label: string
  focused: boolean
}

function TabIcon({ name, label, focused }: TabIconProps) {
  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: focused ? 'rgba(0,102,133,0.08)' : 'transparent',
        minWidth: 58,
      }}
    >
      <MaterialIcons
        name={name}
        size={focused ? 24 : 22}
        color={focused ? '#82d8ff' : '#6f787e'}
      />
      <Text
        style={{
          fontSize: 10,
          fontFamily: 'Manrope',
          color: focused ? '#82d8ff' : '#6f787e',
          fontWeight: focused ? '700' : '400',
          marginTop: 2,
          letterSpacing: 0.3,
        }}
      >
        {label}
      </Text>
    </View>
  )
}

export default function PatientLayout() {
  const { isAuthenticated, profile } = useAuth()
  const insets = useSafeAreaInsets()
  if (!isAuthenticated || profile?.role !== 'patient') {
    return <Redirect href="/(auth)/welcome" />
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          // Une hauteur fixe désactive le padding de zone de sécurité que
          // @react-navigation/bottom-tabs ajoute normalement tout seul — sur
          // Android en navigation gestuelle, la barre chevauchait donc celle
          // du système. On rajoute insets.bottom explicitement (constat
          // identique sur les 5 layouts par rôle).
          height: (Platform.OS === 'ios' ? 92 : 72) + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 8,
          backgroundColor: 'rgba(255,255,255,0.92)',
          borderTopColor: 'rgba(130,216,255,0.15)',
          borderTopWidth: 1,
          elevation: 0,
          shadowColor: '#82d8ff',
          shadowOpacity: 0.18,
          shadowOffset: { width: 0, height: -6 },
          shadowRadius: 20,
        },
        tabBarItemStyle: { paddingHorizontal: 2 },
      }}
    >
      {/* 5 onglets : HOME · ASSISTANT · ACTIVITIES · RENDEZ-VOUS · MESSAGERIE
          — Praticiens et Support ont été retirés de la barre (accessibles
          depuis le bandeau d'accueil et le profil respectivement) pour
          laisser la place à Rendez-vous et Messagerie, plus utilisés au
          quotidien. */}
      <Tabs.Screen
        name="home"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="home" label="Accueil" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="assistant"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="psychology" label="Assistant" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="mental-health"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="self-improvement" label="Activités" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="appointments"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="calendar-today" label="Rendez-vous" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="messages/index"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="chat-bubble-outline" label="Messagerie" focused={focused} />,
        }}
      />

      {/* Hidden screens — QA finding: these used to be listed by folder name
          ("messages", "booking", "payment", "practitioner", "permissions",
          "prescriptions"), but Expo Router registers folder+index/dynamic
          routes under their full nested name ("messages/index",
          "booking/[practitionerId]", etc.). A href:null whose `name` doesn't
          exactly match a real route name silently does nothing — each of
          those nested screens was rendering as its own unlabeled, icon-less
          tab bar button instead of being hidden (visible as a row of extra
          "tofu" icons after the 5 real tabs). */}
      <Tabs.Screen name="find-practitioners" options={{ href: null }} />
      <Tabs.Screen name="support" options={{ href: null }} />
      <Tabs.Screen name="messages/[id]" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="booking/[practitionerId]" options={{ href: null }} />
      <Tabs.Screen name="booking-success" options={{ href: null }} />
      <Tabs.Screen name="confirm-session" options={{ href: null }} />
      <Tabs.Screen name="payment/mock-checkout" options={{ href: null }} />
      <Tabs.Screen name="payment/processing" options={{ href: null }} />
      <Tabs.Screen name="practitioner/[id]" options={{ href: null }} />
      <Tabs.Screen name="consultation" options={{ href: null }} />
      <Tabs.Screen name="referring-doctor" options={{ href: null }} />
      <Tabs.Screen name="dossier" options={{ href: null }} />
      <Tabs.Screen name="permissions/index" options={{ href: null }} />
      <Tabs.Screen name="permissions/[practitionerId]" options={{ href: null }} />
      <Tabs.Screen name="disputes" options={{ href: null }} />
      <Tabs.Screen name="prescriptions/index" options={{ href: null }} />
      <Tabs.Screen name="prescriptions/[id]" options={{ href: null }} />
    </Tabs>
  )
}
