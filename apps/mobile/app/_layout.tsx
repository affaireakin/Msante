import '../global.css'
import { useEffect } from 'react'
import { Stack, useRouter, useSegments, SplashScreen } from 'expo-router'
import { useFonts,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope'
import { Providers } from './_providers'
import { useAuthStore } from '@/features/auth/store/authStore'
import { usePushNotifications } from '@/features/notifications/hooks/usePushNotifications'
import { supabase, fetchUserProfile, fetchPractitionerProfile } from '@/services/supabase'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    // NativeWind resolves 'Manrope' → map to the weights it will request
    Manrope: Manrope_400Regular,
  })

  const {
    isAuthenticated, profile, isLoading,
    setSession, setProfile, setPractitioner, setLoading,
  } = useAuthStore()
  const router = useRouter()
  const segments = useSegments()
  usePushNotifications(isAuthenticated)

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync()
  }, [fontsLoaded])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setLoading(true)
        if (session?.user) {
          setSession(session.user)
          const [userProfile, practitionerProfile] = await Promise.all([
            fetchUserProfile(session.user.id),
            fetchPractitionerProfile(session.user.id),
          ])
          setProfile(userProfile)
          setPractitioner(practitionerProfile)
        } else {
          setSession(null)
          setProfile(null)
          setPractitioner(null)
        }
        setLoading(false)
      }
    )
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (isLoading) return

    const inAuth = segments[0] === '(auth)'
    const inOnboarding = segments[0] === '(onboarding)'

    if (!isAuthenticated) {
      if (!inAuth) router.replace('/(auth)/welcome')
      return
    }

    if (!profile?.onboarding_completed) {
      if (!inOnboarding) {
        const route = profile?.role === 'practitioner'
          ? '/(onboarding)/practitioner'
          : '/(onboarding)/patient'
        router.replace(route)
      }
      return
    }

    if (profile.role === 'practitioner') {
      if (segments[0] !== '(practitioner)') router.replace('/(practitioner)/')
    } else {
      if (segments[0] !== '(patient)') router.replace('/(patient)/home')
    }
  }, [isAuthenticated, profile, isLoading])

  if (!fontsLoaded) return null

  return (
    <Providers>
      <Stack screenOptions={{ headerShown: false }} />
    </Providers>
  )
}
