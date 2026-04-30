import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'
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
