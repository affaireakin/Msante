import { Redirect, Tabs } from 'expo-router'
import { View, Text, Platform } from 'react-native'
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
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: focused ? 'rgba(0,102,133,0.08)' : 'transparent',
        minWidth: 52,
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
  if (!isAuthenticated || profile?.role !== 'patient') {
    return <Redirect href="/(auth)/welcome" />
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          height: Platform.OS === 'ios' ? 88 : 68,
          backgroundColor: 'rgba(255,255,255,0.92)',
          borderTopColor: 'rgba(130,216,255,0.15)',
          borderTopWidth: 1,
          elevation: 0,
          shadowColor: '#82d8ff',
          shadowOpacity: 0.18,
          shadowOffset: { width: 0, height: -6 },
          shadowRadius: 20,
        },
      }}
    >
      {/* 5 onglets : HOME · ASSISTANT · ACTIVITIES · PROVIDERS · SUPPORT */}
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
        name="find-practitioners"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="medical-services" label="Praticiens" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="support"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="support-agent" label="Support" focused={focused} />,
        }}
      />

      {/* Hidden screens */}
      <Tabs.Screen name="appointments" options={{ href: null }} />
      <Tabs.Screen name="messages" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="booking" options={{ href: null }} />
      <Tabs.Screen name="booking-success" options={{ href: null }} />
      <Tabs.Screen name="confirm-session" options={{ href: null }} />
      <Tabs.Screen name="payment" options={{ href: null }} />
      <Tabs.Screen name="practitioner" options={{ href: null }} />
      <Tabs.Screen name="consultation" options={{ href: null }} />
      <Tabs.Screen name="referring-doctor" options={{ href: null }} />
      <Tabs.Screen name="dossier" options={{ href: null }} />
      <Tabs.Screen name="permissions" options={{ href: null }} />
      <Tabs.Screen name="disputes" options={{ href: null }} />
      <Tabs.Screen name="prescriptions" options={{ href: null }} />
    </Tabs>
  )
}
