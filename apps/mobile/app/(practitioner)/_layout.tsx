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
      <MaterialIcons name={name} size={focused ? 24 : 22} color={focused ? '#82d8ff' : '#6f787e'} />
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

export default function PractitionerLayout() {
  const { isAuthenticated, profile } = useAuth()
  const insets = useSafeAreaInsets()
  if (!isAuthenticated || profile?.role !== 'practitioner') {
    return <Redirect href="/(auth)/welcome" />
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          // cf. (patient)/_layout.tsx — hauteur fixe = plus de padding de
          // zone de sécurité automatique, d'où le chevauchement avec la barre
          // système Android en navigation gestuelle.
          height: (Platform.OS === 'ios' ? 92 : 72) + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 8,
          backgroundColor: 'rgba(255,255,255,0.80)',
          borderTopColor: 'rgba(255,255,255,0.30)',
          borderTopWidth: 1,
          elevation: 0,
          shadowColor: '#82d8ff',
          shadowOpacity: 0.12,
          shadowOffset: { width: 0, height: -8 },
          shadowRadius: 24,
        },
        tabBarItemStyle: { paddingHorizontal: 2 },
      }}
    >
      {/* Agenda est l'écran d'accueil (index) — accessible immédiatement au
          lancement, sans navigation supplémentaire (section 1/12 du cahier
          des charges). L'ancien Dashboard (stats/revenus) reste disponible
          sur une route dédiée, cachée de la barre d'onglets. */}
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="calendar-today" label="Agenda" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="patients"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="group" label="Patients" focused={focused} />,
        }}
      />
      {/* QA finding: messages/ is a folder (index.tsx + [id].tsx) — Expo
          Router registers it under those full names, not "messages", so this
          Tabs.Screen never actually matched a route and messages/[id]
          (unhidden) surfaced as its own unlabeled tab bar button. */}
      <Tabs.Screen
        name="messages/index"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="chat-bubble-outline" label="Messages" focused={focused} />,
        }}
      />
      <Tabs.Screen name="messages/[id]" options={{ href: null }} />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="person" label="Profil" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="secretary"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="consultation"
        options={{
          href: null,
          tabBarStyle: { display: 'none' },
        }}
      />
      {/* Same folder/index naming mismatch as messages/ above — these three
          are folders each containing a single dynamic/new-style file, so the
          real route name includes that file, not just the folder. */}
      <Tabs.Screen
        name="patient-notes/[patientId]"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="prescription/new"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="analytics"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="notes-cliniques"
        options={{ href: null }}
      />
      {/* Was missing entirely (neither shown nor hidden) — auto-registered
          as the one extra unlabeled tab icon after "Profil". */}
      <Tabs.Screen
        name="availability"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="disputes"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="documents"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="notifications"
        options={{ href: null }}
      />
    </Tabs>
  )
}
