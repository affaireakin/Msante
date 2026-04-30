import { useAuthStore } from '../store/authStore'

export function useAuth() {
  const { user, profile, practitioner, isLoading, isAuthenticated } = useAuthStore()
  return { user, profile, practitioner, isLoading, isAuthenticated }
}
