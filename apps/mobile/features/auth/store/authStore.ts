import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'
import type { UserProfile, Practitioner } from '@/types/database'
import { supabase } from '@/services/supabase'

interface AuthState {
  user: User | null
  profile: UserProfile | null
  practitioner: Practitioner | null
  isLoading: boolean
  isAuthenticated: boolean
  setSession: (user: User | null) => void
  setProfile: (profile: UserProfile | null) => void
  setPractitioner: (practitioner: Practitioner | null) => void
  setLoading: (loading: boolean) => void
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  practitioner: null,
  isLoading: true,
  isAuthenticated: false,

  setSession: (user) => set({ user, isAuthenticated: !!user }),
  setProfile: (profile) => set({ profile }),
  setPractitioner: (practitioner) => set({ practitioner }),
  setLoading: (isLoading) => set({ isLoading }),

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, profile: null, practitioner: null, isAuthenticated: false })
  },
}))
