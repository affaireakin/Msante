import '../global.css'
import { useEffect } from 'react'
import { Stack, useRouter, useSegments, SplashScreen } from 'expo-router'
import {
  useFonts,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope'
import { Providers } from './_providers'
import { useAuthStore } from '@/features/auth/store/authStore'
import { usePushNotifications } from '@/features/notifications/hooks/usePushNotifications'
import { useMoodReminder } from '@/features/notifications/hooks/useMoodReminder'
import { supabase, fetchUserProfile, fetchPractitionerProfile, fetchPendingOrganization, withTimeout } from '@/services/supabase'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    // Named variants (expo-google-fonts)
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    // Android font-weight resolution: looks for 'Manrope-Bold' when fontWeight:'700'
    'Manrope': Manrope_400Regular,
    'Manrope-Medium': Manrope_500Medium,
    'Manrope-SemiBold': Manrope_600SemiBold,
    'Manrope-Bold': Manrope_700Bold,
    'Manrope-ExtraBold': Manrope_800ExtraBold,
  })

  const {
    isAuthenticated, profile, pendingOrganization, isLoading,
    setSession, setProfile, setPractitioner, setPendingOrganization, setLoading,
  } = useAuthStore()
  const router = useRouter()
  const segments = useSegments()
  usePushNotifications(isAuthenticated)
  useMoodReminder(isAuthenticated)

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync()
  }, [fontsLoaded])

  useEffect(() => {
    // QA finding: supabase-js awaits every onAuthStateChange callback to
    // completion before letting signInWithPassword/getSession's own promise
    // resolve. This callback used to `await` the profile fetches directly —
    // if either ever stalled (observed reliably after a background/foreground
    // cycle on RN), the hang propagated all the way back to the login
    // screen's `await`, and the button spun forever on every attempt after
    // that (the stuck state lives in the JS client, not on the screen, so it
    // didn't recover until the app was killed and relaunched). The callback
    // itself must stay synchronous; profile fetching now runs in its own
    // fire-and-forget block, bounded by withTimeout so it can't hang forever
    // either.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setSession(session.user)
          setLoading(true)
          void (async () => {
            const [userProfile, practitionerProfile, pendingOrg] = await Promise.all([
              withTimeout(fetchUserProfile(session.user.id), 12000, null),
              withTimeout(fetchPractitionerProfile(session.user.id), 12000, null),
              withTimeout(fetchPendingOrganization(session.user.id), 12000, null),
            ])
            setProfile(userProfile)
            setPractitioner(practitionerProfile)
            setPendingOrganization(pendingOrg)
            setLoading(false)
          })()
        } else {
          setSession(null)
          setProfile(null)
          setPractitioner(null)
          setPendingOrganization(null)
          setLoading(false)
        }
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

    // Secretaries (personal or org-invited) have a dedicated mobile tab group.
    if (profile?.role === 'secretary') {
      if (segments[0] !== '(secretary)') router.replace('/(secretary)/')
      return
    }

    // An organization-creation request is never tracked via role/
    // onboarding_completed — the requester stays role='patient' until a
    // Super Admin approves it (see fetchPendingOrganization) — so this has
    // to run before both the web-only-roles check and the onboarding_completed
    // check below, otherwise they'd be redirected into patient onboarding on
    // every fresh app launch instead of back to their organization's status.
    // Once approved, role flips to 'organization_admin' and pendingOrganization
    // is no longer enough on its own to keep matching this branch — falls
    // through to the web-only gate below (no mobile org-admin space yet).
    if (pendingOrganization && profile?.role === 'patient') {
      if (segments[0] !== '(onboarding)') router.replace('/(onboarding)/organization')
      return
    }

    // admin / organization_admin / organization_member have no mobile
    // experience (web-only). Without this guard, they fell through to the
    // "else" branch below and got silently routed into patient ONBOARDING
    // (onboarding_completed is never set for these accounts, since they're
    // created via web signup/invite, not the mobile onboarding flow) — which
    // looks exactly like being sent back to signup.
    if (profile && profile.role !== 'patient' && profile.role !== 'practitioner') {
      const path = (segments as string[]).join('/')
      if (path !== '(auth)/web-only') {
        router.replace('/(auth)/web-only')
      }
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

    // One-time "Demande envoyée !" confirmation shown right after onboarding
    // submits successfully — onboarding_completed is already true at this
    // point (set by completePractitionerOnboarding), so without this bypass
    // this effect would redirect straight to /(practitioner)/ before the
    // user ever sees it, exactly like the silent redirect this screen
    // exists to replace.
    if ((segments as string[]).join('/') === '(onboarding)/practitioner-submitted') return

    if (profile.role === 'practitioner') {
      if (segments[0] !== '(practitioner)') router.replace('/(practitioner)/')
    } else {
      if (segments[0] !== '(patient)') router.replace('/(patient)/home')
    }
  }, [isAuthenticated, profile, pendingOrganization, isLoading])

  if (!fontsLoaded) return null

  return (
    <Providers>
      <Stack screenOptions={{ headerShown: false }} />
    </Providers>
  )
}
