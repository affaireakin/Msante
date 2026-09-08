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
        paddingHorizontal: 4,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: focused ? 'rgba(0,102,133,0.08)' : 'transparent',
        minWidth: 46,
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
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  )
}

export default function AdminLayout() {
  const { isAuthenticated, profile } = useAuth()
  const insets = useSafeAreaInsets()
  if (!isAuthenticated || profile?.role !== 'admin') {
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
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="dashboard" label="Accueil" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="verifications"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="fact-check" label="Vérifs" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="group" label="Comptes" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="disputes"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="gavel" label="Litiges" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="person" label="Profil" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="notifications"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="audit"
        options={{ href: null }}
      />
      <Tabs.Screen name="messages/index" options={{ href: null }} />
      <Tabs.Screen name="messages/[id]" options={{ href: null }} />
      <Tabs.Screen name="roles/index" options={{ href: null }} />
      <Tabs.Screen name="roles/[key]" options={{ href: null }} />
      <Tabs.Screen name="delegation" options={{ href: null }} />
      <Tabs.Screen name="analytics" options={{ href: null }} />
      <Tabs.Screen name="finance" options={{ href: null }} />
    </Tabs>
  )
}
