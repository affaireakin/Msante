import { Redirect, Tabs } from 'expo-router'
import { View, Text, Platform } from 'react-native'
import { useAuth } from '@/features/auth/hooks/useAuth'

interface TabIconProps {
  emoji: string
  label: string
  focused: boolean
}

function TabIcon({ emoji, label, focused }: TabIconProps) {
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
      <Text style={{ fontSize: focused ? 21 : 19 }}>{emoji}</Text>
      <Text
        style={{
          fontSize: 10,
          fontFamily: 'Manrope',
          color: focused ? '#006685' : '#6f787e',
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
          height: Platform.OS === 'ios' ? 86 : 66,
          backgroundColor: 'rgba(255,255,255,0.80)',
          borderTopColor: 'rgba(255,255,255,0.30)',
          borderTopWidth: 1,
          elevation: 0,
          shadowColor: '#82d8ff',
          shadowOpacity: 0.12,
          shadowOffset: { width: 0, height: -8 },
          shadowRadius: 24,
        },
      }}
    >
      {/* 5 visible tabs */}
      <Tabs.Screen
        name="home"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" label="Accueil" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="mental-health"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="🌿" label="Activités" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="assistant"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="💙" label="Assistant" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="find-practitioners"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="👨‍⚕️" label="Praticiens" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="support"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="🆘" label="Support" focused={focused} />,
        }}
      />

      {/* Hidden screens */}
      <Tabs.Screen name="booking" options={{ href: null }} />
      <Tabs.Screen name="booking-success" options={{ href: null }} />
      <Tabs.Screen name="confirm-session" options={{ href: null }} />
      <Tabs.Screen name="payment" options={{ href: null }} />
      <Tabs.Screen name="practitioner" options={{ href: null }} />
      <Tabs.Screen name="consultation" options={{ href: null }} />
    </Tabs>
  )
}
