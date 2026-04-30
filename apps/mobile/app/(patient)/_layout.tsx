import { Redirect, Stack } from 'expo-router'
import { useAuth } from '@/features/auth/hooks/useAuth'

export default function PatientLayout() {
  const { isAuthenticated, profile } = useAuth()
  if (!isAuthenticated || profile?.role !== 'patient') {
    return <Redirect href="/(auth)/welcome" />
  }
  return <Stack screenOptions={{ headerShown: false }} />
}
