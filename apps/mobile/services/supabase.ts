import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'
import { AppState } from 'react-native'
import type { UserProfile, Practitioner } from '@/types/database'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

// QA finding: on React Native, supabase-js's auto-refresh ticker runs even
// while the app is backgrounded (it only skips this on web, where it can
// listen for visibility natively) — a refresh that stalls mid-background can
// wedge the client's internal lock, which then blocks every future auth call
// (login included) since the re-entrant lock path has no timeout. Official
// Supabase RN guidance: pause/resume the ticker with AppState.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh()
  } else {
    supabase.auth.stopAutoRefresh()
  }
})

// A stalled request (common right after a background/foreground cycle on
// RN) never rejects on its own — without a ceiling, callers awaiting it hang
// forever. Used to bound the profile fetches that run inside the
// onAuthStateChange callback (see app/_layout.tsx), since auth-js awaits
// that callback before resolving signInWithPassword/getSession.
export function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms)),
  ])
}

export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) return null
  return data as UserProfile
}

export async function fetchPractitionerProfile(userId: string): Promise<Practitioner | null> {
  const { data, error } = await supabase
    .from('practitioners')
    .select('*')
    .eq('user_id', userId)
    .single()
  if (error) return null
  return data as Practitioner
}
