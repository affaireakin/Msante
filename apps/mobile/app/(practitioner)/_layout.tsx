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
  if (!isAuthenticated || profile?.role !== 'practitioner') {
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
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="dashboard" label="Dashboard" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="agenda"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="calendar-today" label="Agenda" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="patients"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="group" label="Patients" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="chat-bubble-outline" label="Messages" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon name="person" label="Profil" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="services"
        options={{ tabBarButton: () => null }}
      />
      <Tabs.Screen
        name="consultation"
        options={{
          tabBarButton: () => null,
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="patient-notes"
        options={{ tabBarButton: () => null }}
      />
      <Tabs.Screen
        name="prescription"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="schedule-blocks"
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
    </Tabs>
  )
}
